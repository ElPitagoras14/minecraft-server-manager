import { Request, Response } from "express";
import {
  stopContainer,
  createContainer,
  deleteContainer,
  recreateContainerProperties,
  execRconCommands,
} from "../../docker/client";
import { logger } from "../../log";
import { v4 as uuidv4 } from "uuid";
import { addTaskToQueue, getTaskStatus } from "../../queue/task-queue-service";
import { executeQuery, serverManagerPool } from "../../databases/clients";
import { getNewPort, getParsedRequesterRoles } from "./utils";
import { serverConfig } from "./config";
import fs from "fs";
import archiver from "archiver";
import unzipper from "unzipper";
import { convertBytes, deleteFile } from "../../utils";

const { dockerData } = serverConfig;

const parseMinecraftProperties = (
  filePath: string
): Record<string, string | number | boolean | null> => {
  const properties: Record<string, string | number | boolean | null> = {};

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const lines = fileContent.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine === "" || trimmedLine.startsWith("#")) continue;

    const [key, ...valueParts] = trimmedLine.split("=");
    const keyTrimmed = key.trim();
    const valueTrimmed = valueParts.join("=").trim();

    let value: string | number | boolean | null =
      valueTrimmed === "" ? null : valueTrimmed;

    if (value !== null) {
      if (value === "true") {
        value = true;
      } else if (value === "false") {
        value = false;
      } else if (!isNaN(Number(value))) {
        value = Number(value);
      }
    }

    properties[keyTrimmed] = value;
  }

  return properties;
};

const parseMinecraftOperators = (
  filePath: string
): Record<string, string | number | boolean>[] => {
  const fileContent = fs.readFileSync(filePath, "utf-8");

  return JSON.parse(fileContent);
};

const generateBackupName = () => {
  const adjectives: string[] = [
    "brave",
    "cool",
    "eager",
    "fierce",
    "jolly",
    "keen",
    "lucky",
    "mighty",
  ];
  const nouns: string[] = [
    "tiger",
    "phoenix",
    "dragon",
    "eagle",
    "wolf",
    "panther",
    "falcon",
    "lion",
  ];

  const randomAdjective: string =
    adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun: string = nouns[Math.floor(Math.random() * nouns.length)];
  const randomNumber: number = Math.floor(1000 + Math.random() * 9000);

  return `${randomAdjective}-${randomNoun}-${randomNumber}`;
};

const compressDir = (serverPath: string, backupFilePath: string) => {
  return new Promise<{ zipPath: string; size: number }>((resolve, reject) => {
    const output = fs.createWriteStream(backupFilePath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      fs.stat(backupFilePath, (err, stats) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            zipPath: backupFilePath,
            size: stats.size,
          });
        }
      });
    });

    archive.on("error", (err) => reject(err));

    archive.pipe(output);
    archive.directory(serverPath, false);
    archive.finalize();
  });
};

const deCompressDir = (zipPath: string, extractTo: string) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(zipPath)) {
      return reject(new Error(`The ZIP file doesn't exist: ${zipPath}`));
    }
    if (!fs.existsSync(extractTo)) {
      fs.mkdirSync(extractTo, { recursive: true });
    }

    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: extractTo }))
      .on("close", resolve)
      .on("error", reject);
  });
};

const getImportantProperties = (
  properties: Record<string, string | number | boolean | null>
) => {
  const propertyMap = {
    "level-name": "serverName",
    "max-players": "maxPlayers",
    "view-distance": "viewDistance",
    motd: "motd",
    difficulty: "difficulty",
    version: "version",
  };

  const selectedProperties = Object.keys(propertyMap).reduce(
    (acc: Record<string, string | number | boolean>, key) => {
      const value = properties[key];
      if (value) {
        acc[propertyMap[key as keyof typeof propertyMap]] = value;
      }
      return acc;
    },
    {}
  );

  return selectedProperties;
};

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
        s.container_id as containerId,
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
        s.container_id as containerId,
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
              s.container_id as containerId,
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
      body: { requesterId, serverProperties = {} },
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

    const containerId = await createContainer(newPort, serverProperties);

    childLogger.info(`Minecraft server created with ID ${containerId}`, {
      filename: "service.ts",
      func: "createServerController",
    });

    const insertSql = `
      INSERT INTO servers (container_id, name, version, port, status, volume_path, creator_id)
      VALUES (?, ?, ?, ?, 'DOWN', ?, ?);
    `;
    const { serverName = "world", version = "LATEST" } = serverProperties || {};
    const serverPath = `${dockerData}/servers/minecraft-${newPort}`;
    const values = [
      containerId,
      serverName,
      version,
      newPort,
      serverPath,
      requesterId,
    ];
    const { result } = await executeQuery(insertSql, values, serverManagerPool);
    const insertId = result.insertId;

    const logSQl = `
      INSERT INTO server_logs (request_id, server_id, username, action, status)
      VALUES (?, ?, ?, ?, ?);
    `;
    connection.execute(logSQl, [
      requestId,
      insertId,
      username,
      "create-server",
      "SUCCESS",
    ]);

    childLogger.info("Minecraft server saved in database", {
      filename: "service.ts",
      func: "createServerController",
    });

    const job = await addTaskToQueue(
      { serverId: insertId, containerId, requestId, date: Date.now() },
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
        containerId,
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
        s.container_id as containerId,
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

    if (roleServerResult.length === 0) {
      childLogger.info("Server not found", {
        filename: "service.ts",
        func: "updateServerInfoController",
      });

      const response = {
        requestId,
        statusCode: 404,
        message: "Server not found",
        payload: {},
      };

      connection.commit();
      res.status(404).json(response);
      return;
    }

    const [{ creatorId } = {}] = roleServerResult || [];

    if (requesterId !== creatorId) {
      childLogger.info("Not authorized", {
        filename: "service.ts",
        func: "updateServerInfoController",
      });

      const response = {
        requestId,
        statusCode: 409,
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
      res.status(409).json(response);
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
        s.container_id as containerId,
        s.creator_id as creatorId,
        s.volume_path as volumePath
      FROM servers s
      WHERE s.id = ?;
    `;
    const { result: roleServerResult } = await executeQuery(
      roleServerSql,
      [serverId],
      serverManagerPool
    );

    if (roleServerResult.length === 0) {
      childLogger.info("Server not found", {
        filename: "service.ts",
        func: "deleteServerController",
      });

      const response = {
        requestId,
        statusCode: 404,
        message: "Server not found",
        payload: {},
      };

      connection.commit();
      res.status(404).json(response);
      return;
    }

    const [{ creatorId, containerId, volumePath }] = roleServerResult;
    if (requesterId !== creatorId) {
      childLogger.info("Not authorized", {
        filename: "service.ts",
        func: "deleteServerController",
      });

      const response = {
        requestId,
        statusCode: 409,
        message: "Only the creator can delete the server.",
        payload: {},
      };

      connection.commit();
      res.status(409).json(response);
      return;
    }

    childLogger.info(`Deleting server with ID: ${serverId}`, {
      filename: "service.ts",
      func: "deleteServerController",
    });
    await deleteContainer(containerId);

    const allBackupsSql = `
      SELECT
        b.path
      FROM backups b
      WHERE b.server_id = ?;
    `;
    const { result: allBackupsResult } = await executeQuery(
      allBackupsSql,
      [serverId],
      serverManagerPool
    );

    for (const { path } of allBackupsResult) {
      deleteFile(path);
    }

    const deleteBackupsSql = `
      DELETE FROM backups
      WHERE server_id = ?;
    `;
    await executeQuery(deleteBackupsSql, [serverId], serverManagerPool);

    deleteFile(volumePath);

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
      body: { requesterId = "", requesterRoles = [], requesterUser = "" },
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
        s.container_id as containerId,
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

    if (roleServerResult.length === 0) {
      childLogger.info("Server not found", {
        filename: "service.ts",
        func: "startServerController",
      });

      const response = {
        requestId,
        statusCode: 404,
        message: "Server not found",
        payload: {},
      };

      connection.commit();
      res.status(404).json(response);
      return;
    }

    const [{ roleName, creatorId, name, status, containerId }] =
      roleServerResult;

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
        statusCode: 409,
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
      res.status(409).json(response);
      return;
    }

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

    childLogger.info(`Starting server with ID: ${serverId}`, {
      filename: "service.ts",
      func: "startServerController",
    });

    const jobId = await addTaskToQueue(
      { serverId, containerId, requestId, date: Date.now() },
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
      containerId,
      requesterUser,
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
      body: { requesterId = "", requesterRoles = [], requesterUser },
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
        s.container_id as containerId,
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

    if (roleServerResult.length === 0) {
      childLogger.info("Server not found", {
        filename: "service.ts",
        func: "stopServerController",
      });

      const response = {
        requestId,
        statusCode: 404,
        message: "Server not found",
        payload: {},
      };

      connection.commit();
      res.status(404).json(response);
      return;
    }

    const [{ roleName, creatorId, name, status, containerId }] =
      roleServerResult;

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
        statusCode: 409,
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
        containerId,
        requesterId,
        "stop-server",
        "FAILED",
      ]);

      connection.commit();
      res.status(409).json(response);
      return;
    }

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

    childLogger.info(`Stopping server with ID: ${containerId}`, {
      filename: "service.ts",
      func: "stopServerController",
    });
    await stopContainer(containerId);
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
      requesterUser,
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
      body: { requesterRoles, requesterId, requesterUser },
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
        s.container_id as containerId,
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

    if (roleServerResult.length === 0) {
      childLogger.info("Server not found", {
        filename: "service.ts",
        func: "restartServerController",
      });

      const response = {
        requestId,
        statusCode: 404,
        message: "Server not found",
        payload: {},
      };

      connection.commit();
      res.status(404).json(response);
      return;
    }

    const [{ roleName, creatorId, name, containerId }] = roleServerResult;

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
        statusCode: 409,
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
      res.status(409).json(response);
      return;
    }

    childLogger.info(`Restarting server with ID: ${serverId}`, {
      filename: "service.ts",
      func: "restartServerController",
    });
    await stopContainer(containerId);
    const jobId = await addTaskToQueue(
      { serverId, containerId, requestId, date: Date.now() },
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
      requesterUser,
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

    childLogger.info("Server properties gotten successfully", {
      filename: "service.ts",
      func: "getServerStatusController",
    });

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

export const updateServerPropertiesController = async (
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
      body: { properties, requesterId, requesterUser },
    } = req;

    childLogger.debug("Received", {
      filename: "service.ts",
      func: "updateServerPropertiesController",
      extra: {
        query: req.query,
        params: req.params,
        body: req.body,
      },
    });

    childLogger.info(`Updating server properties with ID: ${serverId}`, {
      filename: "service.ts",
      func: "updateServerPropertiesController",
    });

    const infoSql = `
      SELECT
        s.port,
        s.container_id as containerId,
        s.creator_id as creatorId
      FROM servers s
      WHERE s.id = ?;
    `;
    const { result: infoResult } = await executeQuery(
      infoSql,
      [serverId],
      serverManagerPool
    );

    if (infoResult.length === 0) {
      childLogger.info("Server not found", {
        filename: "service.ts",
        func: "updateServerPropertiesController",
      });

      const response = {
        requestId,
        statusCode: 404,
        message: "Server not found",
        payload: {},
      };

      res.status(404).json(response);
      return;
    }

    const [{ port, creatorId, containerId } = {}] = infoResult || [];

    if (requesterId !== creatorId) {
      childLogger.info("Not authorized", {
        filename: "service.ts",
        func: "updateServerPropertiesController",
      });

      const response = {
        requestId,
        statusCode: 409,
        message: "Only the creator can update the server.",
        payload: {},
      };

      const unauthorizedLogSql = `
        INSERT INTO server_logs (request_id, server_id, username, action, status)
        VALUES (?, ?, ?, ?, ?);
      `;
      const values = [
        requestId,
        serverId,
        requesterUser,
        "update-server-properties",
        "FAILED",
      ];
      await executeQuery(unauthorizedLogSql, values, serverManagerPool);

      res.status(409).json(response);
      return;
    }

    childLogger.info(`Updating server properties with ID: ${serverId}`, {
      filename: "service.ts",
      func: "updateServerPropertiesController",
    });

    const serverPath = `${dockerData}/servers/minecraft-${port}`;

    const newContainerId = await recreateContainerProperties(
      containerId,
      serverPath,
      port,
      properties
    );

    const { version = "LATEST" } = properties;

    const updateSql = `
      UPDATE servers
      SET
        container_id = ?,
        version = ?,
        status = 'DOWN'
      WHERE id = ?;
    `;
    await executeQuery(
      updateSql,
      [newContainerId, version, serverId],
      serverManagerPool
    );

    const jobId = await addTaskToQueue(
      { serverId, containerId: newContainerId, requestId, date: Date.now() },
      "server"
    );

    childLogger.info(`Enqueued task with ID: ${jobId}`, {
      filename: "service.ts",
      func: "updateServerPropertiesController",
    });

    const logSql = `
      INSERT INTO server_logs (request_id, server_id, username, action, status)
      VALUES (?, ?, ?, ?, ?);
    `;
    const values = [
      requestId,
      serverId,
      requesterUser,
      "update-server-properties",
      "SUCCESS",
    ];
    await executeQuery(logSql, values, serverManagerPool);

    childLogger.info("Server properties updated successfully", {
      filename: "service.ts",
      func: "updateServerPropertiesController",
    });

    const response = {
      requestId,
      statusCode: 200,
      message: "Server properties updated successfully",
      payload: {
        // jobId,
      },
    };

    res.status(200).json(response);
  } catch (error: any) {
    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;

    childLogger.error(`Error while updating server properties`, {
      filename: "service.ts",
      func: "updateServerPropertiesController",
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

export const getServerBackupController = async (
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
      func: "getServerBackupController",
      extra: {
        query: req.query,
        params: req.params,
        body: req.body,
      },
    });

    childLogger.info(`Getting backups for server with ID: ${serverId}`, {
      filename: "service.ts",
      func: "getServerBackupController",
    });

    const infoSql = `
      SELECT
        b.id,
        b.name,
        b.version,
        b.path,
        b.size,
        b.created_at as createdAt
      FROM backups b
      WHERE b.server_id = ?
      ORDER BY b.created_at DESC;
    `;
    const { result: infoResult } = await executeQuery(
      infoSql,
      [serverId],
      serverManagerPool
    );

    const parsedResult = infoResult.map((backup: Record<string, any>) => ({
      ...backup,
      size: convertBytes(backup.size),
    }));

    const response = {
      requestId,
      statusCode: 200,
      message: "Backups gotten successfully",
      payload: {
        items: parsedResult,
        total: parsedResult.length,
      },
    };

    res.status(200).json(response);
  } catch (error: any) {
    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;

    childLogger.error(`Error while getting backups`, {
      filename: "service.ts",
      func: "getServerBackupController",
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

export const createServerBackupController = async (
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
      body: { requesterId, requesterUser },
    } = req;

    childLogger.debug("Received", {
      filename: "service.ts",
      func: "createServerBackupController",
      extra: {
        query: req.query,
        params: req.params,
        body: req.body,
      },
    });

    const infoSql = `
      SELECT
        s.port,
        s.name,
        s.version,
        s.creator_id as creatorId
      FROM servers s
      WHERE s.id = ?;
    `;
    const { result: infoResult } = await executeQuery(
      infoSql,
      [serverId],
      serverManagerPool
    );

    if (infoResult.length === 0) {
      childLogger.info("Server not found", {
        filename: "service.ts",
        func: "createServerBackupController",
      });

      const response = {
        requestId,
        statusCode: 404,
        message: "Server not found",
        payload: {},
      };

      connection.commit();
      res.status(404).json(response);
      return;
    }

    const [{ port, creatorId, name: serverName, version } = {}] =
      infoResult || [];

    if (requesterId !== creatorId) {
      childLogger.info("Not authorized", {
        filename: "service.ts",
        func: "createServerBackupController",
      });

      const response = {
        requestId,
        statusCode: 409,
        message: "Only the creator can create a backup.",
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
        "create-backup",
        "FAILED",
      ]);

      connection.commit();
      res.status(409).json(response);
      return;
    }

    const backupCountSql = `
      SELECT
        COUNT(*) as count
      FROM backups
      WHERE server_id = ?;
    `;
    const { result: backupCountResult } = await executeQuery(
      backupCountSql,
      [serverId],
      serverManagerPool
    );
    const [{ count }] = backupCountResult;

    if (count === 3) {
      childLogger.info("Backup limit reached", {
        filename: "service.ts",
        func: "createServerBackupController",
      });

      const response = {
        requestId,
        statusCode: 409,
        message: "Backup limit reached",
        payload: {},
      };

      const limitLogSql = `
        INSERT INTO server_logs (request_id, server_id, username, action, status)
        VALUES (?, ?, ?, ?, ?);
      `;
      connection.execute(limitLogSql, [
        requestId,
        serverId,
        requesterUser,
        "create-backup",
        "FAILED",
      ]);

      connection.commit();
      res.status(409).json(response);
      return;
    }

    const serverPath = `${dockerData}/servers/minecraft-${port}/${serverName}`;

    const backupName = generateBackupName();
    const backupPath = `${dockerData}/backups/${backupName}.zip`;

    const result = await compressDir(serverPath, backupPath);
    const { size } = result;

    const insertSql = `
      INSERT INTO backups (server_id, name, version, path, size)
      VALUES (?, ?, ?, ?, ?);
    `;
    const values = [serverId, backupName, version, backupPath, size];
    await executeQuery(insertSql, values, serverManagerPool);

    const logSql = `
      INSERT INTO server_logs (request_id, server_id, username, action, status)
      VALUES (?, ?, ?, ?, ?);
    `;
    connection.execute(logSql, [
      requestId,
      serverId,
      requesterUser,
      "create-backup",
      "SUCCESS",
    ]);

    const response = {
      requestId,
      statusCode: 200,
      message: "Backup created successfully",
      payload: {
        backupName,
        backupPath,
        size,
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

    childLogger.error(`Error while creating a backup`, {
      filename: "service.ts",
      func: "createServerBackupController",
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

export const restoreBackupController = async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const childLogger = logger.child({
    extra: { requestId },
  });
  let connection;

  try {
    connection = await serverManagerPool.getConnection();
    connection.beginTransaction();
    const {
      params: { backupId },
      body: { requesterId, requesterUser },
    } = req;

    childLogger.debug("Received", {
      filename: "service.ts",
      func: "restoreBackupController",
      extra: {
        query: req.query,
        params: req.params,
        body: req.body,
      },
    });

    const infoSql = `
      SELECT
        b.server_id as serverId,
        b.path,
        s.name,
        s.port,
        s.container_id as containerId,
        s.creator_id as creatorId
      FROM backups b
      LEFT JOIN servers s ON b.server_id = s.id
      WHERE b.id = ?;
    `;
    const { result: infoResult } = await executeQuery(
      infoSql,
      [backupId],
      serverManagerPool
    );

    if (infoResult.length === 0) {
      childLogger.info("Backup not found", {
        filename: "service.ts",
        func: "restoreBackupController",
      });

      const response = {
        requestId,
        statusCode: 404,
        message: "Backup not found",
        payload: {},
      };

      connection.commit();
      res.status(404).json(response);
      return;
    }

    const [
      { serverId, containerId, creatorId, port, path, name: serverName } = {},
    ] = infoResult;

    if (requesterId !== creatorId) {
      childLogger.info("Not authorized", {
        filename: "service.ts",
        func: "restoreBackupController",
      });

      const response = {
        requestId,
        statusCode: 409,
        message: "Only the creator can restore a backup.",
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
        "restore-backup",
        "FAILED",
      ]);

      connection.commit();
      res.status(409).json(response);
      return;
    }

    const serverPath = `${dockerData}/servers/minecraft-${port}`;
    console.log(path, `${serverPath}/${serverName}`);
    await deCompressDir(path, `${serverPath}/${serverName}`);

    const properties = parseMinecraftProperties(
      `${serverPath}/server.properties`
    );
    const importantProperties = getImportantProperties(properties);
    const newContainerId = await recreateContainerProperties(
      containerId,
      serverPath,
      port,
      importantProperties
    );

    const updateStatusSql = `
      UPDATE servers
      SET
        status = 'DOWN',
        container_id = ?
      WHERE id = ?;
    `;
    await executeQuery(
      updateStatusSql,
      [newContainerId, serverId],
      serverManagerPool
    );

    const jobId = await addTaskToQueue(
      { serverId, containerId: newContainerId, requestId, date: Date.now() },
      "server"
    );

    const logSql = `
      INSERT INTO server_logs (request_id, server_id, username, action, status)
      VALUES (?, ?, ?, ?, ?);
    `;
    connection.execute(logSql, [
      requestId,
      serverId,
      requesterUser,
      "restore-backup",
      "SUCCESS",
    ]);

    const response = {
      requestId,
      statusCode: 200,
      message: "Backup restored successfully",
      payload: {
        jobId,
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

    childLogger.error(`Error while restoring a backup`, {
      filename: "service.ts",
      func: "restoreBackupController",
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

export const deleteServerBackupController = async (
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
      params: { backupId },
      body: { requesterId, requesterUser },
    } = req;

    childLogger.debug("Received", {
      filename: "service.ts",
      func: "deleteServerBackupController",
      extra: {
        query: req.query,
        params: req.params,
        body: req.body,
      },
    });

    const infoSql = `
      SELECT
        b.server_id as containerId,
        s.creator_id as creatorId,
        b.path
      FROM backups b
      LEFT JOIN servers s ON b.server_id = s.id
      WHERE b.id = ?;
    `;
    const { result: infoResult } = await executeQuery(
      infoSql,
      [backupId],
      serverManagerPool
    );

    if (infoResult.length === 0) {
      childLogger.info("Backup not found", {
        filename: "service.ts",
        func: "deleteServerBackupController",
      });

      const response = {
        requestId,
        statusCode: 404,
        message: "Backup not found",
        payload: {},
      };

      connection.commit();
      res.status(404).json(response);
      return;
    }

    const [{ containerId, creatorId, path } = {}] = infoResult;

    if (requesterId !== creatorId) {
      childLogger.info("Not authorized", {
        filename: "service.ts",
        func: "deleteServerBackupController",
      });

      const response = {
        requestId,
        statusCode: 409,
        message: "Only the creator can delete a backup.",
        payload: {},
      };

      const unauthorizedLogSql = `
        INSERT INTO server_logs (request_id, server_id, username, action, status)
        VALUES (?, ?, ?, ?, ?);
      `;
      connection.execute(unauthorizedLogSql, [
        requestId,
        containerId,
        requesterUser,
        "delete-backup",
        "FAILED",
      ]);

      connection.commit();
      res.status(409).json(response);
      return;
    }

    await deleteFile(path);

    const deleteSql = `
      DELETE FROM backups
      WHERE id = ?;
    `;
    await executeQuery(deleteSql, [backupId], serverManagerPool);

    const logSql = `
      INSERT INTO server_logs (request_id, server_id, username, action, status)
      VALUES (?, ?, ?, ?, ?);
    `;
    connection.execute(logSql, [
      requestId,
      containerId,
      requesterUser,
      "delete-backup",
      "SUCCESS",
    ]);

    const response = {
      requestId,
      statusCode: 200,
      message: "Backup deleted successfully",
      payload: {},
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

    childLogger.error(`Error while deleting a backup`, {
      filename: "service.ts",
      func: "deleteServerBackupController",
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

export const getServerOperatorsController = async (
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

    childLogger.info(`Getting server operators with ID: ${serverId}`, {
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
    const propertiesPath = `${serverPath}/ops.json`;

    const operators = parseMinecraftOperators(propertiesPath);

    childLogger.info("Server operators gotten successfully", {
      filename: "service.ts",
      func: "getServerStatusController",
    });

    const response = {
      requestId,
      statusCode: 200,
      message: "Server operators gotten successfully",
      payload: {
        items: operators,
        total: operators.length,
      },
    };

    res.status(200).json(response);
  } catch (error: any) {
    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;

    childLogger.error(`Error while getting server operators`, {
      filename: "service.ts",
      func: "getServerOperatorsController",
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

export const createServerOperatorController = async (
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
    const {
      params: { serverId },
      body: { name, requesterId, requesterUser },
    } = req;

    childLogger.debug("Received", {
      filename: "service.ts",
      func: "createServerOperatorController",
      extra: {
        query: req.query,
        params: req.params,
        body: req.body,
      },
    });

    childLogger.info(`Creating operator for server with ID: ${serverId}`, {
      filename: "service.ts",
      func: "createServerOperatorController",
    });

    const infoSql = `
      SELECT
        s.port,
        s.container_id as containerId,
        s.creator_id as creatorId
      FROM servers s
      WHERE s.id = ?;
    `;
    const { result: infoResult } = await executeQuery(
      infoSql,
      [serverId],
      serverManagerPool
    );

    if (infoResult.length === 0) {
      childLogger.info("Server not found", {
        filename: "service.ts",
        func: "createServerOperatorController",
      });

      const response = {
        requestId,
        statusCode: 404,
        message: "Server not found",
        payload: {},
      };

      res.status(404).json(response);
      return;
    }

    const [{ port, creatorId, containerId } = {}] = infoResult || [];

    if (requesterId !== creatorId) {
      childLogger.info("Not authorized", {
        filename: "service.ts",
        func: "createServerOperatorController",
      });

      const response = {
        requestId,
        statusCode: 409,
        message: "Only the creator can create an operator.",
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
        "create-operator",
        "FAILED",
      ]);

      res.status(409).json(response);
      return;
    }

    const rconCommands = [`op ${name}`];
    const results = await execRconCommands(containerId, rconCommands);

    childLogger.info("Operator created successfully", {
      filename: "service.ts",
      func: "createServerOperatorController",
    });

    const response = {
      requestId,
      statusCode: 200,
      message: "Operator created successfully",
      payload: {
        items: results,
        total: results.length,
      },
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

    childLogger.error(`Error while creating operator`, {
      filename: "service.ts",
      func: "createServerOperatorController",
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

export const deleteServerOperatorController = async (
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
    const {
      params: { serverId, username },
      body: { requesterId, requesterUser },
    } = req;

    childLogger.debug("Received", {
      filename: "service.ts",
      func: "deleteServerOperatorController",
      extra: {
        query: req.query,
        params: req.params,
        body: req.body,
      },
    });

    childLogger.info(`Deleting operator with ID: ${username}`, {
      filename: "service.ts",
      func: "deleteServerOperatorController",
    });

    const infoSql = `
      SELECT
        s.container_id as containerId,
        s.creator_id as creatorId
      FROM servers s
      WHERE s.id = ?;
    `;
    const { result: infoResult } = await executeQuery(
      infoSql,
      [serverId],
      serverManagerPool
    );

    if (infoResult.length === 0) {
      childLogger.info("Server not found", {
        filename: "service.ts",
        func: "deleteServerOperatorController",
      });

      const response = {
        requestId,
        statusCode: 404,
        message: "Server not found",
        payload: {},
      };

      res.status(404).json(response);
      return;
    }

    const [{ creatorId, containerId } = {}] = infoResult || [];

    if (requesterId !== creatorId) {
      childLogger.info("Not authorized", {
        filename: "service.ts",
        func: "deleteServerOperatorController",
      });

      const response = {
        requestId,
        statusCode: 409,
        message: "Only the creator can delete an operator.",
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
        "delete-operator",
        "FAILED",
      ]);

      res.status(409).json(response);
      return;
    }

    const rconCommands = [`deop ${username}`];
    const results = await execRconCommands(containerId, rconCommands);

    childLogger.info("Operator deleted successfully", {
      filename: "service.ts",
      func: "deleteServerOperatorController",
    });

    const response = {
      requestId,
      statusCode: 200,
      message: "Operator deleted successfully",
      payload: {
        items: results,
        total: results.length,
      },
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

    childLogger.error(`Error while deleting operator`, {
      filename: "service.ts",
      func: "deleteServerOperatorController",
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
