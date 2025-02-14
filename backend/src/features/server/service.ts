import { Request, Response } from "express";
import {
  stopContainer,
  createContainer,
  deleteContainer,
} from "../../docker/client";
import { logger } from "../../log";
import { v4 as uuidv4 } from "uuid";
import { addTaskToQueue, getTaskStatus } from "../../queue/task-queue-service";
import { executeQuery, serverManagerPool } from "../../databases/clients";
import {
  getNewPort,
  getParsedRequesterRoles,
  parseMinecraftProperties,
} from "./utils";
import { serverConfig } from "./config";
import fs from "fs";

const { dockerData } = serverConfig;

export const getAllServersController = async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const childLogger = logger.child({
    extra: { requestId },
  });
  try {
    const {
      query: { requesterId = "", requesterRoles = [] },
    } = req;
    const parsedRoles = getParsedRequesterRoles(requesterRoles as string[]);

    childLogger.debug("Received", {
      filename: "service.ts",
      func: "getAllServersController",
      extra: {
        query: req.query,
        params: req.params,
        body: req.body,
      },
    });

    childLogger.info("Getting all servers", {
      filename: "service.ts",
      func: "getAllServersController",
    });

    const userSql = `
      SELECT
        u.is_admin as isAdmin
      FROM users u
      WHERE u.id = ?;
    `;
    const { result: userResult } = await executeQuery(
      userSql,
      [requesterId],
      serverManagerPool
    );
    const [{ isAdmin = false } = {}] = userResult || [];

    const adminSql = `
      SELECT
        s.id,
        s.name,
        s.version,
        s.port,
        s.status,
        s.role_name as roleName
      FROM servers s
      WHERE s.status != 'DELETED'
      ORDER BY s.created_at ASC;
    `;
    let normalSql = `
      SELECT
        s.id,
        s.name,
        s.version,
        s.port,
        s.status,
        s.role_name as roleName
      FROM servers s
      WHERE
        s.status != 'DELETED'
        AND s.creator_id = ?
    `;
    if (parsedRoles.length > 0) {
      normalSql += `
            UNION
              SELECT
              s.id,
              s.name,
              s.version,
              s.port,
              s.status,
              s.role_name as roleName
            FROM servers s
            WHERE
              s.status != 'DELETED'
              AND s.role_name IN (${parsedRoles
                .map((role) => `'${role}'`)
                .join(", ")})
              `;
    }
    normalSql += "ORDER BY s.created_at ASC;";

    const sql = isAdmin ? adminSql : normalSql;
    const values = isAdmin ? [] : [requesterId];
    const { result } = await executeQuery(sql, values, serverManagerPool);

    childLogger.info("Servers gotten successfully", {
      filename: "service.ts",
      func: "getAllServersController",
    });

    const response = {
      requestId,
      statusCode: 200,
      message: "Servers gotten successfully",
      payload: {
        items: result,
        total: result.length,
      },
    };

    res.status(200).json(response);
  } catch (error: any) {
    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;
    childLogger.error(`Error while getting all servers`, {
      filename: "service.ts",
      func: "getAllServersController",
      extra: { error: message },
    });
    const response = {
      requestId,
      statusCode: statusCode || 500,
      message: message || "Internal server error",
      payload: {
        error: specificMessage,
      },
    };
    res.status(statusCode || 500).json(response);
  }
};

export const createServerController = async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const childLogger = logger.child({
    extra: { requestId },
  });
  let connection;

  try {
    connection = await serverManagerPool.getConnection();
    connection.beginTransaction();
    const {
      body: { requesterId, requesterUser, serverProperties = {} },
    } = req;

    childLogger.debug("Received", {
      filename: "service.ts",
      func: "createServerController",
      extra: {
        query: req.query,
        params: req.params,
        body: req.body,
      },
    });

    const userSql = `
      SELECT
        u.id as userId,
        u.username
      FROM users u
      WHERE u.id = ?;
    `;
    const { result: userResult } = await executeQuery(
      userSql,
      [requesterId],
      serverManagerPool
    );
    if (userResult.length === 0) {
      childLogger.info("User not found", {
        filename: "service.ts",
        func: "createServerController",
      });
      const response = {
        requestId,
        statusCode: 404,
        message: "Not authorized",
        payload: {
          requesterId,
        },
      };
      const notFoundLogSql = `
        INSERT INTO server_logs (request_id, server_id, username, action, status)
        VALUES (?, ?, ?, ?, ?);
      `;
      connection.execute(notFoundLogSql, [
        requestId,
        requesterId,
        requesterUser,
        "create-server",
        "FAILED",
      ]);

      connection.commit();
      res.status(404).json(response);
      return;
    }

    const [{ username = "" } = {}] = userResult || [];
    const userWorldSql = `
      SELECT COUNT(*) as count
      FROM servers s
      WHERE
        s.creator_id = ?
        AND s.status != 'DELETED';
    `;
    const { result: userWorld } = await executeQuery(
      userWorldSql,
      [requesterId],
      serverManagerPool
    );
    const [{ count: userWorldCount }] = userWorld;
    if (userWorldCount > 2) {
      childLogger.info("User has reached the world limit", {
        filename: "service.ts",
        func: "createServerController",
      });
      const response = {
        requestId,
        statusCode: 409,
        message: "User has reached the world limit",
        payload: {
          requesterId,
        },
      };
      const limitLogSql = `
        INSERT INTO server_logs (request_id, server_id, username, action, status)
        VALUES (?, ?, ?, ?, ?);
      `;
      connection.execute(limitLogSql, [
        requestId,
        requesterId,
        username,
        "create-server",
        "FAILED",
      ]);
      connection.commit();
      res.status(409).json(response);
      return;
    }

    childLogger.info("Creating Minecraft Server", {
      filename: "service.ts",
      func: "createServerController",
    });

    const portSql = `
      SELECT s.port
      FROM servers s
      WHERE s.status != 'DELETED'
      ORDER BY s.port ASC;
    `;
    const { result: portResult } = await executeQuery(
      portSql,
      [],
      serverManagerPool
    );
    const newPort = getNewPort(
      portResult.length === 0
        ? []
        : portResult.map((port: Record<string, number>) => port.port)
    );

    childLogger.info(`Port assigned ${newPort}`, {
      filename: "service.ts",
      func: "createServerController",
    });

    const serverId = await createContainer(newPort, serverProperties);

    childLogger.info(`Minecraft server created with ID ${serverId}`, {
      filename: "service.ts",
      func: "createServerController",
    });

    const insertSql = `
      INSERT INTO servers (id, name, version, port, status, volume_path, creator_id)
      VALUES (?, ?, ?, ?, 'DOWN', ?, ?);
    `;
    const { serverName = "world", version = "LATEST" } = serverProperties || {};
    const serverPath = `${dockerData}/servers/minecraft-${newPort}`;
    const values = [
      serverId,
      serverName,
      version,
      newPort,
      serverPath,
      requesterId,
    ];
    await executeQuery(insertSql, values, serverManagerPool);

    const logSQl = `
      INSERT INTO server_logs (request_id, server_id, username, action, status)
      VALUES (?, ?, ?, ?, ?);
    `;
    connection.execute(logSQl, [
      requestId,
      serverId,
      username,
      "create-server",
      "SUCCESS",
    ]);

    childLogger.info("Minecraft server saved in database", {
      filename: "service.ts",
      func: "createServerController",
    });

    const job = await addTaskToQueue(
      { serverId, requestId, date: Date.now() },
      "server"
    );
    childLogger.info(`Enqueued task with ID: ${job}`, {
      filename: "service.ts",
      func: "createServerController",
    });

    const response = {
      requestId,
      statusCode: 200,
      message: "Minecraft server created successfully",
      payload: {
        serverId,
        jobId: job,
      },
    };

    connection.commit();
    res.status(200).json(response);
  } catch (error: any) {
    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;

    childLogger.error(`Error while creating a Minecraft Server`, {
      filename: "service.ts",
      func: "createServerController",
      extra: {
        error: message,
      },
    });

    const response = {
      requestId,
      statusCode: statusCode || 500,
      message: message || "Internal Server Error",
      payload: {
        error: specificMessage,
      },
    };

    if (connection) {
      connection.rollback();
    }
    res.status(statusCode || 500).json(response);
  }
};

export const getServerInfoController = async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const childLogger = logger.child({
    extra: { requestId },
  });

  try {
    const {
      params: { serverId },
    } = req;

    childLogger.debug("Received", {
      filename: "service.ts",
      func: "getServerInfoController",
      extra: {
        query: req.query,
        params: req.params,
        body: req.body,
      },
    });

    childLogger.info(`Getting server status with ID: ${serverId}`, {
      filename: "service.ts",
      func: "getServerStatusController",
    });

    const infoSql = `
      SELECT
        s.id,
        s.name,
        s.version,
        s.port,
        s.status,
        s.name,
        u.username as creator,
        u.id as creatorId,
        s.role_name as roleName
      FROM servers s
      LEFT JOIN users u ON s.creator_id = u.id
      WHERE s.id = ?;
    `;
    const { result: infoResult } = await executeQuery(
      infoSql,
      [serverId],
      serverManagerPool
    );
    const [info] = infoResult;

    const response = {
      requestId,
      statusCode: 200,
      message: "Server status gotten successfully",
      payload: {
        ...info,
      },
    };

    res.status(200).json(response);
  } catch (error: any) {
    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;
    childLogger.error(`Error while getting server status`, {
      filename: "service.ts",
      func: "getServerStatusController",
      extra: {
        error: message,
      },
    });
    const response = {
      requestId,
      statusCode: statusCode || 500,
      message: message || "Internal Server Error",
      payload: {
        error: specificMessage,
      },
    };
    res.status(statusCode || 500).json(response);
  }
};

export const updateServerInfoController = async (
  req: Request,
  res: Response
) => {
  const requestId = uuidv4();
  const childLogger = logger.child({
    extra: { requestId },
  });
  let connection;

  try {
    connection = await serverManagerPool.getConnection();
    connection.beginTransaction();
    const {
      params: { serverId },
      body: { roleName, requesterId, requesterUser },
    } = req;

    childLogger.debug("Received", {
      filename: "service.ts",
      func: "updateServerInfoController",
      extra: {
        query: req.query,
        params: req.params,
        body: req.body,
      },
    });

    const roleServerSql = `
      SELECT
        s.creator_id as creatorId
      FROM servers s
      WHERE s.id = ?;
    `;
    const { result: roleServerResult } = await executeQuery(
      roleServerSql,
      [serverId],
      serverManagerPool
    );
    const [{ creatorId = "" } = {}] = roleServerResult || [];

    console.log("creatorId", creatorId, requesterId);

    if (requesterId !== creatorId) {
      childLogger.info("Not authorized", {
        filename: "service.ts",
        func: "updateServerInfoController",
      });

      const response = {
        requestId,
        statusCode: 403,
        message: "Only the creator can update the server.",
        payload: {},
      };

      const unauthorizedLogSql = `
        INSERT INTO server_logs (request_id, server_id, username, action, status)
        VALUES (?, ?, ?, ?, ?);
      `;
      connection.execute(unauthorizedLogSql, [
        requestId,
        serverId,
        requesterUser,
        "update-server",
        "FAILED",
      ]);

      connection.commit();
      res.status(403).json(response);
      return;
    }

    childLogger.info(`Updating server with ID: ${serverId}`, {
      filename: "service.ts",
      func: "updateServerInfoController",
    });

    const updateSql = `
      UPDATE servers
      SET role_name = ?
      WHERE id = ?;
    `;
    await executeQuery(updateSql, [roleName, serverId], serverManagerPool);

    const logSql = `
      INSERT INTO server_logs (request_id, server_id, username, action, status)
      VALUES (?, ?, ?, ?, ?);
    `;

    connection.execute(logSql, [
      requestId,
      serverId,
      requesterUser,
      "update-server",
      "SUCCESS",
    ]);

    connection.commit();

    const response = {
      requestId,
      statusCode: 200,
      message: "Server updated successfully",
      payload: {},
    };
    res.status(200).json(response);
  } catch (error: any) {
    if (connection) {
      connection.rollback();
    }

    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;
    childLogger.error(`Error while updating server`, {
      filename: "service.ts",
      func: "updateServerInfoController",
      extra: { error: message },
    });
    const response = {
      requestId,
      statusCode: statusCode || 500,
      message: message || "Internal Server Error",
      payload: {
        error: specificMessage,
      },
    };
    res.status(statusCode || 500).json(response);
  }
};

export const deleteServerController = async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const childLogger = logger.child({
    extra: { requestId },
  });
  let connection;

  try {
    connection = await serverManagerPool.getConnection();
    connection.beginTransaction();
    const {
      params: { serverId },
      body: { requesterId, requesterUser },
    } = req;

    childLogger.debug("Received", {
      filename: "service.ts",
      func: "deleteServerController",
      extra: {
        query: req.query,
        params: req.params,
        body: req.body,
      },
    });

    const roleServerSql = `
      SELECT
        s.status,
        s.creator_id as creatorId
      FROM servers s
      WHERE s.id = ?;
    `;
    const { result: roleServerResult } = await executeQuery(
      roleServerSql,
      [serverId],
      serverManagerPool
    );
    const [{ creatorId, status }] = roleServerResult;
    if (requesterId !== creatorId) {
      childLogger.info("Not authorized", {
        filename: "service.ts",
        func: "deleteServerController",
      });

      const response = {
        requestId,
        statusCode: 403,
        message: "Only the creator can delete the server.",
        payload: {},
      };

      const unauthorizedLogSql = `
        INSERT INTO server_logs (request_id, server_id, username, action, status)
        VALUES (?, ?, ?, ?, ?);
      `;
      connection.execute(unauthorizedLogSql, [
        requestId,
        serverId,
        requesterUser,
        "delete-server",
        "FAILED",
      ]);

      connection.commit();
      res.status(403).json(response);
      return;
    }

    childLogger.info(`Deleting server with ID: ${serverId}`, {
      filename: "service.ts",
      func: "deleteServerController",
    });
    await deleteContainer(serverId);
    childLogger.info("Minecraft server deleted successfully", {
      filename: "service.ts",
      func: "deleteServerController",
    });

    const deleteSql = `
      UPDATE servers
      SET status = 'DELETED'
      WHERE id = ?;
    `;
    await executeQuery(deleteSql, [serverId], serverManagerPool);

    const logSql = `
      INSERT INTO server_logs (request_id, server_id, username, action, status)
      VALUES (?, ?, ?, ?, ?);
    `;
    connection.execute(logSql, [
      requestId,
      serverId,
      requesterUser,
      "delete-server",
      "SUCCESS",
    ]);

    const response = {
      requestId,
      statusCode: 200,
      message: "Server deleted successfully",
      payload: {},
    };
    await connection.commit();
    res.status(200).json(response);
  } catch (error: any) {
    if (connection) {
      connection.rollback();
    }

    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;

    childLogger.error("Error while deleting Minecraft Server", {
      filename: "service.ts",
      func: "deleteServerController",
      extra: { error: message },
    });

    const response = {
      requestId,
      statusCode: statusCode || 500,
      message: message || "Internal Server Error",
      payload: {
        error: specificMessage,
      },
    };
    res.status(statusCode || 500).json(response);
  }
};

export const startServerController = async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const childLogger = logger.child({
    extra: { requestId },
  });
  let connection;

  try {
    connection = await serverManagerPool.getConnection();
    connection.beginTransaction();
    const {
      params: { serverId },
      body: { requesterId = "", requesterRoles = [] },
    } = req;

    childLogger.debug("Received", {
      filename: "service.ts",
      func: "startServerController",
      extra: {
        query: req.query,
        params: req.params,
        body: req.body,
      },
    });

    const roleServerSql = `
      SELECT
        s.name,
        s.status,
        s.role_name as roleName,
        s.creator_id as creatorId
      FROM servers s
      WHERE s.id = ?;
    `;
    const { result: roleServerResult } = await executeQuery(
      roleServerSql,
      [serverId],
      serverManagerPool
    );
    const [{ roleName, creatorId, name, status }] = roleServerResult;

    if (status === "INITIALIZING" || status === "READY") {
      childLogger.info("Server is already running or initializing", {
        filename: "service.ts",
        func: "startServerController",
      });

      const response = {
        requestId,
        statusCode: 409,
        message: "Server is already running or initializing.",
        payload: {},
      };

      const initializingLogSql = `
        INSERT INTO server_logs (request_id, server_id, username, action, status)
        VALUES (?, ?, ?, ?, ?);
      `;
      connection.execute(initializingLogSql, [
        requestId,
        serverId,
        requesterId,
        "start-server",
        "FAILED",
      ]);

      connection.commit();
      res.status(409).json(response);
      return;
    }

    childLogger.info(`Server role ${roleName}`, {
      filename: "service.ts",
      func: "startServerController",
    });

    const parsedRoles = getParsedRequesterRoles(requesterRoles as string[]);

    const hasRole = parsedRoles.some((role: string) => role === roleName);

    if (!hasRole && requesterId !== creatorId) {
      childLogger.info("Not authorized", {
        filename: "service.ts",
        func: "startServerController",
      });

      const response = {
        requestId,
        statusCode: 403,
        message: "User not authorized to start the server",
        payload: {},
      };

      const unauthorizedLogSql = `
        INSERT INTO server_logs (request_id, server_id, username, action, status)
        VALUES (?, ?, ?, ?, ?);
      `;
      connection.execute(unauthorizedLogSql, [
        requestId,
        serverId,
        requesterId,
        "start-server",
        "FAILED",
      ]);

      connection.commit();
      res.status(403).json(response);
      return;
    }

    childLogger.info(`Starting server with ID: ${serverId}`, {
      filename: "service.ts",
      func: "startServerController",
    });

    const jobId = await addTaskToQueue(
      { serverId, requestId, date: Date.now() },
      "server"
    );

    childLogger.info(`Enqueued task with ID: ${jobId}`, {
      filename: "service.ts",
      func: "startServerController",
    });

    const logSql = `
      INSERT INTO server_logs (request_id, server_id, username, action, status)
      VALUES (?, ?, ?, ?, ?);
    `;
    connection.execute(logSql, [
      requestId,
      serverId,
      requesterId,
      "start-server",
      "SUCCESS",
    ]);

    const response = {
      requestId,
      statusCode: 200,
      message: "Server started successfully",
      payload: {
        jobId,
        serverName: name,
      },
    };

    connection.commit();
    res.status(200).json(response);
  } catch (error: any) {
    if (connection) {
      connection.rollback();
    }

    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;

    childLogger.error(`Error al iniciar el servidor de Minecraft: ${error}`, {
      filename: "service.ts",
      func: "startServerController",
      extra: { error: message },
    });

    const response = {
      requestId,
      statusCode: statusCode || 500,
      message: message || "Error al iniciar el servidor de Minecraft",
      payload: {
        error: specificMessage,
      },
    };

    res.status(statusCode || 500).json(response);
  }
};

export const stopServerController = async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const childLogger = logger.child({
    extra: { requestId },
  });
  let connection;

  try {
    connection = await serverManagerPool.getConnection();
    connection.beginTransaction();
    const {
      params: { serverId },
      body: { requesterId = "", requesterRoles = [] },
    } = req;

    childLogger.debug("Received", {
      filename: "service.ts",
      func: "stopServerController",
      extra: {
        query: req.query,
        params: req.params,
        body: req.body,
      },
    });

    const roleServerSql = `
      SELECT
        s.name,
        s.status,
        s.role_name as roleName,
        s.creator_id as creatorId
      FROM servers s
      WHERE s.id = ?;
    `;
    const { result: roleServerResult } = await executeQuery(
      roleServerSql,
      [serverId],
      serverManagerPool
    );
    const [{ roleName, creatorId, name, status }] = roleServerResult;
    if (status === "DOWN") {
      childLogger.info("Server is already stopped", {
        filename: "service.ts",
        func: "stopServerController",
      });

      const response = {
        requestId,
        statusCode: 409,
        message: "Server is already stopped.",
        payload: {},
      };

      const initializingLogSql = `
        INSERT INTO server_logs (request_id, server_id, username, action, status)
        VALUES (?, ?, ?, ?, ?);
      `;
      connection.execute(initializingLogSql, [
        requestId,
        serverId,
        requesterId,
        "stop-server",
        "FAILED",
      ]);

      connection.commit();
      res.status(409).json(response);
      return;
    }

    childLogger.info(`Server role ${roleName}`, {
      filename: "service.ts",
      func: "stopServerController",
    });

    const parsedRoles = getParsedRequesterRoles(requesterRoles as string[]);
    const hasRole = parsedRoles.some((role: string) => role === roleName);

    console.log("hasRole", hasRole);

    if (!hasRole && requesterId !== creatorId) {
      childLogger.info("Not authorized", {
        filename: "service.ts",
        func: "stopServerController",
      });

      const response = {
        requestId,
        statusCode: 403,
        message: "User not authorized to stop the server",
        payload: {
          wordlName: name,
        },
      };

      const unauthorizedLogSql = `
        INSERT INTO server_logs (request_id, server_id, username, action, status)
        VALUES (?, ?, ?, ?, ?);
      `;
      connection.execute(unauthorizedLogSql, [
        requestId,
        serverId,
        requesterId,
        "stop-server",
        "FAILED",
      ]);

      connection.commit();
      res.status(403).json(response);
      return;
    }

    childLogger.info(`Stopping server with ID: ${serverId}`, {
      filename: "service.ts",
      func: "stopServerController",
    });
    await stopContainer(serverId);
    childLogger.info(`Server stopped successfully`, {
      filename: "service.ts",
      func: "stopServerController",
    });

    const updateStatusSql = `
      UPDATE servers
      SET status = 'DOWN'
      WHERE id = ?;
    `;

    await executeQuery(updateStatusSql, [serverId], serverManagerPool);

    const logSql = `
      INSERT INTO server_logs (request_id, server_id, username, action, status)
      VALUES (?, ?, ?, ?, ?);
    `;
    connection.execute(logSql, [
      requestId,
      serverId,
      requesterId,
      "stop-server",
      "SUCCESS",
    ]);

    const response = {
      requestId,
      statusCode: 200,
      message: "Server stopped successfully",
      payload: {
        serverName: name,
      },
    };

    connection.commit();
    res.status(200).json(response);
  } catch (error: any) {
    if (connection) {
      connection.rollback();
    }

    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;

    childLogger.error("Error while stopping server", {
      filename: "service.ts",
      func: "stopServerController",
      extra: { error: message },
    });

    const response = {
      requestId,
      statusCode: statusCode || 500,
      message: message || "Internal Server Error",
      payload: {
        error: specificMessage,
      },
    };
    res.status(statusCode || 500).json(response);
  }
};

export const restartServerController = async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const childLogger = logger.child({
    extra: { requestId },
  });
  let connection;

  try {
    connection = await serverManagerPool.getConnection();
    connection.beginTransaction();
    const {
      params: { serverId },
      body: { requesterRoles, requesterId },
    } = req;

    childLogger.debug("Received", {
      filename: "service.ts",
      func: "restartServerController",
      extra: {
        query: req.query,
        params: req.params,
        body: req.body,
      },
    });

    const roleServerSql = `
      SELECT
        s.name,
        s.status,
        s.role_name as roleName,
        s.creator_id as creatorId
      FROM servers s
      WHERE s.id = ?;
    `;
    const { result: roleServerResult } = await executeQuery(
      roleServerSql,
      [serverId],
      serverManagerPool
    );
    const [{ roleName, creatorId, name }] = roleServerResult;

    childLogger.info(`Server role ${roleName}`, {
      filename: "service.ts",
      func: "restartServerController",
    });

    const parsedRoles = getParsedRequesterRoles(requesterRoles as string[]);
    const hasRole = parsedRoles.some((role: string) => role === roleName);

    if (!hasRole && requesterId !== creatorId) {
      childLogger.info("Not authorized", {
        filename: "service.ts",
        func: "restartServerController",
      });

      const response = {
        requestId,
        statusCode: 403,
        message: "User not authorized to restart the server",
        payload: {
          wordlName: name,
        },
      };

      const unauthorizedLogSql = `
        INSERT INTO server_logs (request_id, server_id, username, action, status)
        VALUES (?, ?, ?, ?, ?);
      `;
      connection.execute(unauthorizedLogSql, [
        requestId,
        serverId,
        requesterId,
        "restart-server",
        "FAILED",
      ]);

      connection.commit();
      res.status(403).json(response);
      return;
    }

    childLogger.info(`Restarting server with ID: ${serverId}`, {
      filename: "service.ts",
      func: "restartServerController",
    });
    await stopContainer(serverId);
    const jobId = await addTaskToQueue(
      { serverId, requestId, date: Date.now() },
      "server"
    );
    childLogger.info(`Enqueued task with ID: ${jobId}`, {
      filename: "service.ts",
      func: "startServerController",
    });

    const logSql = `
      INSERT INTO server_logs (request_id, server_id, username, action, status)
      VALUES (?, ?, ?, ?, ?);
    `;
    connection.execute(logSql, [
      requestId,
      serverId,
      requesterId,
      "start-server",
      "SUCCESS",
    ]);

    const response = {
      requestId,
      statusCode: 200,
      message: "Server restarted successfully",
      payload: {
        jobId,
        serverName: name,
      },
    };

    connection.commit();
    res.status(200).json(response);
  } catch (error: any) {
    if (connection) {
      connection.rollback();
    }

    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;

    childLogger.error(`Error while restarting Minecraft Server`, {
      filename: "service.ts",
      func: "restartServerController",
      extra: { error: message },
    });

    const response = {
      requestId,
      statusCode: statusCode || 500,
      message: message || "Internal Server Error",
      payload: {
        error: specificMessage,
      },
    };

    res.status(statusCode || 500).json(response);
  }
};

export const getTaskStatusController = async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const childLogger = logger.child({
    extra: { requestId },
  });

  try {
    const {
      params: { jobId },
    } = req;
    childLogger.info(`Get status of task with ID: ${jobId}`, {
      filename: "service.ts",
      func: "getServerStatusController",
    });

    const job = await getTaskStatus(jobId, "server");

    if (!job || job.status === "failed") {
      childLogger.info(`Task with ${jobId} not found`, {
        filename: "service.ts",
        func: "getServerStatusController",
      });

      const response = {
        requestId,
        statusCode: 404,
        message: "Task not found",
        payload: {
          jobId,
        },
      };

      res.status(404).json(response);
      return;
    }

    childLogger.info(`Task status ${job?.status}`, {
      filename: "service.ts",
      func: "getServerStatusController",
    });

    const response = {
      requestId,
      statusCode: 200,
      message: "Task status gotten successfully",
      payload: {
        ...job,
      },
    };

    res.status(200).json(response);
  } catch (error: any) {
    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;

    childLogger.error(`Error while getting task status`, {
      filename: "service.ts",
      func: "getServerStatusController",
      extra: {
        error: message,
      },
    });

    const response = {
      requestId,
      statusCode: statusCode || 500,
      message: message || "Internal Server Error",
      payload: {
        error: specificMessage,
      },
    };

    res.status(statusCode || 500).json(response);
  }
};

export const getServerPropertiesController = async (
  req: Request,
  res: Response
) => {
  const requestId = uuidv4();
  const childLogger = logger.child({
    extra: { requestId },
  });

  try {
    const {
      params: { serverId },
    } = req;

    childLogger.debug("Received", {
      filename: "service.ts",
      func: "getServerPropertiesController",
      extra: {
        query: req.query,
        params: req.params,
        body: req.body,
      },
    });

    childLogger.info(`Getting server properties with ID: ${serverId}`, {
      filename: "service.ts",
      func: "getServerStatusController",
    });

    const infoSql = `
      SELECT
        s.port
      FROM servers s
      WHERE s.id = ?;
    `;
    const { result: infoResult } = await executeQuery(
      infoSql,
      [serverId],
      serverManagerPool
    );
    const [{ port } = {}] = infoResult || [];

    const serverPath = `${dockerData}/servers/minecraft-${port}`;
    const propertiesPath = `${serverPath}/server.properties`;
    const properties = parseMinecraftProperties(propertiesPath);

    const response = {
      requestId,
      statusCode: 200,
      message: "Server properties gotten successfully",
      payload: {
        ...properties,
      },
    };

    res.status(200).json(response);
  } catch (error: any) {
    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;

    childLogger.error(`Error while getting server properties`, {
      filename: "service.ts",
      func: "getServerPropertiesController",
      extra: {
        error: message,
      },
    });

    const response = {
      requestId,
      statusCode: statusCode || 500,
      message: message || "Internal Server Error",
      payload: {
        error: specificMessage,
      },
    };

    res.status(statusCode || 500).json(response);
  }
};
