import { Request, Response } from "express";
import {
  checkStatusContainer,
  createContainer,
  stopContainer,
} from "../../docker/client";
import { logger } from "../../log";
import { v4 as uuidv4 } from "uuid";
import { addTaskToQueue, getTaskStatus } from "../../queue/task-queue-service";
import { executeQuery, serverManagerPool } from "../../databases/clients";

export const getAllServersController = async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const childLogger = logger.child({
    extra: { requestId },
  });
  try {
    childLogger.info("Obteniendo todos los servidores", {
      filename: "service.ts",
      func: "getAllServersController",
    });

    const sql = `
      SELECT
        id,
        name,
        version,
        port,
        status
      FROM servers
      WHERE status != 'DELETED';
    `;
    const { result } = await executeQuery(sql, [], serverManagerPool);

    childLogger.info("Servidores obtenidos correctamente", {
      filename: "service.ts",
      func: "getAllServersController",
    });

    const response = {
      requestId,
      statusCode: 200,
      message: "Servidores obtenidos correctamente",
      payload: result,
    };

    res.status(200).json(response);
  } catch (error) {
    childLogger.error(`Error al obtener los servidores: ${error}`, {
      filename: "service.ts",
      func: "getAllServersController",
    });

    const response = {
      requestId,
      statusCode: 500,
      message: "Error al obtener los servidores",
      payload: {
        error,
      },
    };

    res.status(500).json(response);
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
      body: {
        motd = "A simple server",
        worldName = "world",
        version = "LATEST",
        requesterId,
        requesterUser,
      },
    } = req;

    childLogger.debug("Received", {
      filename: "service.ts",
      func: "createServerController",
      extra: req.body,
    });

    const userSql = `
      SELECT
        id as userId,
        username
      FROM users
      WHERE id = ?;
    `;
    const { result: userResult } = await executeQuery(
      userSql,
      [requesterId],
      serverManagerPool
    );
    if (userResult.length === 0) {
      childLogger.info("Usuario no encontrado", {
        filename: "service.ts",
        func: "createServerController",
      });
      const response = {
        requestId,
        statusCode: 404,
        message: "Usuario no encontrado.",
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
    const [{ username }] = userResult;

    const userWorldSql = `
      SELECT COUNT(*) as count
      FROM servers
      WHERE
        creator_id = ?
        AND status != 'DELETED';
    `;
    const { result: userWorld } = await executeQuery(
      userWorldSql,
      [requesterId],
      serverManagerPool
    );
    const [{ count: userWorldCount }] = userWorld;
    if (userWorldCount > 5) {
      childLogger.info("Usuario ya tiene un mundo", {
        filename: "service.ts",
        func: "createServerController",
      });
      const response = {
        requestId,
        statusCode: 409,
        message: "El usuario ya superó el límite de mundos.",
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

    childLogger.info("Creando servidor de Minecraft", {
      filename: "service.ts",
      func: "createServerController",
    });

    const portSql = `
      SELECT COUNT(*) as count
      FROM servers
      WHERE status != 'DELETED';
    `;
    const { result: portResult } = await executeQuery(
      portSql,
      [],
      serverManagerPool
    );
    const [{ count }] = portResult;
    const newPort = 25565 + count;

    childLogger.info(`Puerto asignado ${newPort}`, {
      filename: "service.ts",
      func: "createServerController",
    });

    const serverId = await createContainer(version, newPort, {
      motd,
      maxPlayers: 20,
      difficulty: "easy",
      worldName,
    });

    childLogger.info(`Servidor Minecraft creado con id ${serverId}`, {
      filename: "service.ts",
      func: "createServerController",
    });

    const insertSql = `
      INSERT INTO servers (id, name, version, port, status, creator_id)
      VALUES (?, ?, ?, ?, 'DOWN', ?);
    `;
    const values = [serverId, worldName, version, newPort, requesterId];
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

    childLogger.info(`Servidor guardado en la base de datos`, {
      filename: "service.ts",
      func: "createServerController",
    });

    const job = await addTaskToQueue(
      { serverId, requestId, date: Date.now() },
      "server"
    );
    childLogger.info(`Tarea agregada a la cola con ID: ${job}`, {
      filename: "service.ts",
      func: "createServerController",
    });

    const response = {
      requestId,
      statusCode: 201,
      message: "Servidor de Minecraft creado correctamente.",
      payload: {
        serverId,
        jobId: job,
      },
    };

    connection.commit();
    res.status(201).json(response);
  } catch (error: any) {
    childLogger.error(`Error al crear el servidor de Minecraft: ${error}`, {
      filename: "service.ts",
      func: "createServerController",
    });
    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;

    const response = {
      requestId,
      statusCode: statusCode || 500,
      message: message || "Error al crear el servidor de Minecraft.",
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
      body: { requesterRoles, requesterId },
    } = req;

    const roleServerSql = `
      SELECT
        name,
        status,
        role_name as roleName,
        creator_id as creatorId
      FROM servers
      WHERE id = ?;
    `;
    const { result: roleServerResult } = await executeQuery(
      roleServerSql,
      [serverId],
      serverManagerPool
    );
    const [{ roleName, creatorId, name, status }] = roleServerResult;

    if (status === "INITIALIZING" || status === "READY") {
      childLogger.info("Servidor en proceso de inicialización o listo", {
        filename: "service.ts",
        func: "startServerController",
      });

      const response = {
        requestId,
        statusCode: 409,
        message: "El servidor está en proceso de inicialización o listo.",
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

    childLogger.info(`Rol del servidor ${roleName}`, {
      filename: "service.ts",
      func: "startServerController",
    });

    const hasRole = roleName
      ? requesterRoles.some((role: string) => role === roleName)
      : false;

    if (hasRole || requesterId !== creatorId) {
      childLogger.info("Usuario no autorizado", {
        filename: "service.ts",
        func: "startServerController",
      });

      const response = {
        requestId,
        statusCode: 403,
        message: "Usuario no autorizado para iniciar el servidor.",
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

    childLogger.info(`Iniciando servidor con ID: ${serverId}`, {
      filename: "service.ts",
      func: "startServerController",
      extra: {
        params: req.params,
        body: req.body,
      },
    });

    const jobId = await addTaskToQueue(
      { serverId, requestId, date: Date.now() },
      "server"
    );

    childLogger.info(`Tarea agregada a la cola con ID: ${jobId}`, {
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
      statusCode: 201,
      message: "Servidor de Minecraft iniciado correctamente",
      payload: {
        jobId,
        worldName: name,
      },
    };

    connection.commit();
    res.status(201).json(response);
  } catch (error: any) {
    childLogger.error(`Error al iniciar el servidor de Minecraft: ${error}`, {
      filename: "service.ts",
      func: "startServerController",
    });

    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;

    const response = {
      requestId,
      statusCode: statusCode || 500,
      message: message || "Error al iniciar el servidor de Minecraft",
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
      body: { requesterRoles, requesterId },
    } = req;

    const roleServerSql = `
      SELECT
        name,
        status,
        role_name as roleName,
        creator_id as creatorId
      FROM servers
      WHERE id = ?;
    `;
    const { result: roleServerResult } = await executeQuery(
      roleServerSql,
      [serverId],
      serverManagerPool
    );
    const [{ roleName, creatorId, name, status }] = roleServerResult;

    if (status === "DOWN") {
      childLogger.info("Servidor en proceso de inicialización", {
        filename: "service.ts",
        func: "startServerController",
      });

      const response = {
        requestId,
        statusCode: 409,
        message: "El servidor está en proceso de inicialización.",
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

    childLogger.info(`Rol del servidor ${roleName}`, {
      filename: "service.ts",
      func: "startServerController",
    });

    const hasRole = roleName
      ? requesterRoles.some((role: string) => role === roleName)
      : false;

    if (hasRole || requesterId !== creatorId) {
      childLogger.info("Usuario no autorizado", {
        filename: "service.ts",
        func: "startServerController",
      });

      const response = {
        requestId,
        statusCode: 403,
        message: "Usuario no autorizado para iniciar el servidor.",
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
        "stop-server",
        "FAILED",
      ]);

      connection.commit();
      res.status(403).json(response);
      return;
    }

    childLogger.info(`Deteniendo servidor con ID: ${serverId}`, {
      filename: "service.ts",
      func: "stopServerController",
      extra: {
        params: req.params,
        body: req.body,
      },
    });

    await stopContainer(serverId);

    childLogger.info(`Servidor de Minecraft detenido correctamente`, {
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
      statusCode: 201,
      message: "Servidor de Minecraft detenido correctamente",
      payload: {
        worldName: name,
      },
    };

    connection.commit();
    res.status(201).json(response);
  } catch (error: any) {
    childLogger.error(`Error al detener el servidor de Minecraft: ${error}`, {
      filename: "service.ts",
      func: "stopServerController",
    });

    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;

    const response = {
      requestId,
      statusCode: statusCode || 500,
      message: message || "Error al detener el servidor de Minecraft",
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
    childLogger.info(`Obteniendo estado del servidor con ID: ${serverId}`, {
      filename: "service.ts",
      func: "getServerStatusController",
    });

    const infoSql = `
      SELECT
        name,
        version,
        port,
        status,
        creator_id as creatorId,
        role_name as roleName
      FROM servers
      WHERE id = ?;
    `;
    const { result: infoResult } = await executeQuery(
      infoSql,
      [serverId],
      serverManagerPool
    );
    const [info] = infoResult;

    const serverStatus = await checkStatusContainer(serverId);

    const response = {
      requestId,
      statusCode: 200,
      message: "Estado del servidor obtenido correctamente",
      payload: {
        status: serverStatus.Running,
        ...info,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    childLogger.error(`Error al obtener el estado del servidor: ${error}`, {
      filename: "service.ts",
      func: "getServerStatusController",
    });

    const response = {
      requestId,
      statusCode: 500,
      message: "Error al obtener el estado del servidor",
      payload: {
        error,
      },
    };

    res.status(500).json(response);
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
    childLogger.info(`Obteniendo estado del servidor con ID: ${jobId}`, {
      filename: "service.ts",
      func: "getServerStatusController",
    });

    const job = await getTaskStatus(jobId, "server");

    if (!job || job.status === "failed") {
      childLogger.info(`Tarea con ID ${jobId} no encontrada`, {
        filename: "service.ts",
        func: "getServerStatusController",
      });

      const response = {
        requestId,
        statusCode: 404,
        message: "Tarea no encontrada",
        payload: {
          jobId,
        },
      };

      res.status(404).json(response);
      return;
    }

    childLogger.info(`Estado del servidor obtenido ${job?.status}`, {
      filename: "service.ts",
      func: "getServerStatusController",
    });

    const response = {
      requestId,
      statusCode: 200,
      message: "Estado del servidor obtenido correctamente",
      payload: {
        ...job,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    childLogger.error(`Error al obtener el estado del servidor: ${error}`, {
      filename: "service.ts",
      func: "getServerStatusController",
    });

    const response = {
      requestId,
      statusCode: 500,
      message: "Error al obtener el estado del servidor",
      payload: {
        error,
      },
    };

    res.status(500).json(response);
  }
};
