import { Request, Response } from "express";
import {
  checkStatusContainer,
  stopContainer,
  createContainer,
  deleteContainer,
} from "../../docker/client";
import { logger } from "../../log";
import { v4 as uuidv4 } from "uuid";
import { addTaskToQueue, getTaskStatus } from "../../queue/task-queue-service";
import { executeQuery, serverManagerPool } from "../../databases/clients";
import { getNewPort } from "./utils";

export const getAllServersController = async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const childLogger = logger.child({
    extra: { requestId },
  });
  try {
    const {
      query: { requesterId = "", requesterRoles = [] },
    } = req;
    const roles = Array.isArray(requesterRoles)
      ? requesterRoles.map((role) => String(role))
      : [];
    const emojiRegex =
      /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
    const rolesWithoutEmojis = roles.filter(
      (role: string) => !emojiRegex.test(role)
    );

    childLogger.info("Obteniendo todos los servidores", {
      filename: "service.ts",
      func: "getAllServersController",
    });

    const userSql = `
      SELECT
        is_admin as isAdmin
      FROM users
      WHERE id = ?;
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

    const normalSql = `
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
      ${
        rolesWithoutEmojis.length > 0
          ? `
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
              AND s.role_name IN (${rolesWithoutEmojis
                .map((role) => `'${role}'`)
                .join(", ")});
              `
          : ""
      }
    `;
    const sql = isAdmin ? adminSql : normalSql;
    const values = isAdmin ? [] : [requesterId];
    const { result } = await executeQuery(sql, values, serverManagerPool);

    childLogger.info("Servidores obtenidos correctamente", {
      filename: "service.ts",
      func: "getAllServersController",
    });

    const response = {
      requestId,
      statusCode: 200,
      message: "Servidores obtenidos correctamente",
      payload: {
        items: result,
        total: result.length,
      },
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

export const updateServerController = async (req: Request, res: Response) => {
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
      func: "updateServerController",
      extra: req.body,
    });

    const roleServerSql = `
      SELECT
        s.creator_id as creatorId
      FROM servers s
      WHERE id = ?;
    `;
    const { result: roleServerResult } = await executeQuery(
      roleServerSql,
      [serverId],
      serverManagerPool
    );
    const [{ creatorId }] = roleServerResult;

    if (requesterId !== creatorId) {
      childLogger.info("Usuario no autorizado", {
        filename: "service.ts",
        func: "updateServerController",
      });

      const response = {
        requestId,
        statusCode: 403,
        message: "Solo el creador puede modificar el rol del mundo.",
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

    childLogger.info(`Actualizando servidor con ID: ${serverId}`, {
      filename: "service.ts",
      func: "deleteServerController",
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

    const response = {
      requestId,
      statusCode: 200,
      message: "Rol del servidor actualizado correctamente",
      payload: {},
    };

    connection.commit();
    res.status(200).json(response);
  } catch (error: any) {
    childLogger.error(`Error al actualizar el servidor: ${error}`, {
      filename: "service.ts",
      func: "updateServer",
    });

    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;

    const response = {
      requestId,
      statusCode: statusCode || 500,
      message: message || "Error al actualizar el servidor",
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
        worldName = "world",
        version = "LATEST",
        motd = "A simple server",
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
        message: "No tienes permisos para crear un servidor.",
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
      SELECT s.port
      FROM servers s
      WHERE status != 'DELETED'
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
        : portResult.map((port: Record<string, unknown>) => port.port)
    );

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

    const roleServerSql = `
      SELECT
        s.status,
        s.creator_id as creatorId
      FROM servers s
      WHERE id = ?;
    `;
    const { result: roleServerResult } = await executeQuery(
      roleServerSql,
      [serverId],
      serverManagerPool
    );
    const [{ creatorId, status }] = roleServerResult;

    if (requesterId !== creatorId) {
      childLogger.info("Usuario no autorizado", {
        filename: "service.ts",
        func: "deleteServerController",
      });

      const response = {
        requestId,
        statusCode: 403,
        message: "Solo el creador puede eliminar el mundo.",
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

    if (status === "INITIALIZING" || status === "READY") {
      childLogger.info("Servidor en proceso de inicialización", {
        filename: "service.ts",
        func: "deleteServerController",
      });

      const response = {
        requestId,
        statusCode: 409,
        message: "El servidor está corriendo en este momento.",
        payload: {},
      };

      const initializingLogSql = `
        INSERT INTO server_logs (request_id, server_id, username, action, status)
        VALUES (?, ?, ?, ?, ?);
      `;
      connection.execute(initializingLogSql, [
        requestId,
        serverId,
        requesterUser,
        "delete-server",
        "FAILED",
      ]);

      connection.commit();
      res.status(409).json(response);
      return;
    }

    childLogger.info(`Eliminando servidor con ID: ${serverId}`, {
      filename: "service.ts",
      func: "deleteServerController",
    });

    await deleteContainer(serverId);

    childLogger.info(`Servidor de Minecraft eliminado correctamente`, {
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
      message: "Servidor de Minecraft eliminado correctamente",
      payload: {},
    };

    await connection.commit();
    res.status(200).json(response);
  } catch (error: any) {
    childLogger.error(`Error al eliminar el servidor de Minecraft: ${error}`, {
      filename: "service.ts",
      func: "deleteServerController",
    });

    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;

    const response = {
      requestId,
      statusCode: statusCode || 500,
      message: message || "Error al eliminar el servidor de Minecraft",
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

    if (!hasRole && requesterId !== creatorId) {
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
      childLogger.info("Servidor está actualmente detenido", {
        filename: "service.ts",
        func: "stopServerController",
      });

      const response = {
        requestId,
        statusCode: 409,
        message: "El servidor está actualmente detenido.",
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
      func: "stopServerController",
    });

    const hasRole = roleName
      ? requesterRoles.some((role: string) => role === roleName)
      : false;

    if (!hasRole && requesterId !== creatorId) {
      childLogger.info("Usuario no autorizado", {
        filename: "service.ts",
        func: "stopServerController",
      });

      const response = {
        requestId,
        statusCode: 403,
        message: "Usuario no autorizado para detener el servidor.",
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
      childLogger.info("Servidor está actualmente detenido", {
        filename: "service.ts",
        func: "restartServerController",
      });

      const response = {
        requestId,
        statusCode: 409,
        message: "El servidor está actualmente detenido.",
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
        "restart-server",
        "FAILED",
      ]);

      connection.commit();
      res.status(409).json(response);
      return;
    }

    childLogger.info(`Rol del servidor ${roleName}`, {
      filename: "service.ts",
      func: "restartServerController",
    });

    const hasRole = roleName
      ? requesterRoles.some((role: string) => role === roleName)
      : false;

    if (!hasRole && requesterId !== creatorId) {
      childLogger.info("Usuario no autorizado", {
        filename: "service.ts",
        func: "restartServerController",
      });

      const response = {
        requestId,
        statusCode: 403,
        message: "Usuario no autorizado para reiniciar el servidor.",
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

    childLogger.info(`Reiniciando servidor con ID: ${serverId}`, {
      filename: "service.ts",
      func: "restartServerController",
      extra: {
        params: req.params,
        body: req.body,
      },
    });

    await stopContainer(serverId);
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
    childLogger.error(`Error al reiniciar el servidor de Minecraft: ${error}`, {
      filename: "service.ts",
      func: "restartServerController",
    });

    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;

    const response = {
      requestId,
      statusCode: statusCode || 500,
      message: message || "Error al reiniciar el servidor de Minecraft",
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
