import { Request, Response } from "express";
import {
  checkStatusContainer,
  createContainer,
  stopContainer,
} from "../../docker/client";
import { logger } from "../../log";
import { v4 as uuidv4 } from "uuid";
import { addTaskToQueue, getTaskStatus } from "../../queue/task-queue-service";

export const createServerController = async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const childLogger = logger.child({
    extra: { requestId },
  });
  try {
    const {
      body: {
        motd = "A simple server",
        levelName = "world",
        version = "LATEST",
      },
    } = req;

    childLogger.info("Creando servidor de Minecraft", {
      filename: "service.ts",
      func: "createServer",
    });

    const newPort = "25565";
    childLogger.info(`Puerto asignado ${newPort}`, {
      filename: "service.ts",
      func: "createServer",
    });

    const containerId = await createContainer(version, newPort, {
      motd,
      maxPlayers: 20,
      difficulty: "easy",
      levelName,
    });

    const shortContainerId = containerId.slice(0, 12);

    childLogger.info(`Servidor Minecraft creado con id ${shortContainerId}`, {
      filename: "service.ts",
      func: "createServer",
    });

    const job = await addTaskToQueue({ containerId }, "server");
    childLogger.info(`Tarea agregada a la cola con ID: ${job}`, {
      filename: "service.ts",
      func: "createServer",
    });

    const response = {
      requestId,
      statusCode: 201,
      message: "Servidor de Minecraft creado correctamente",
      payload: {
        containerId,
        taskId: job,
      },
    };

    res.status(201).json(response);
  } catch (error: any) {
    childLogger.error(`Error al crear el servidor de Minecraft: ${error}`, {
      filename: "service.ts",
      func: "createServer",
    });
    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;

    const response = {
      requestId,
      statusCode: statusCode || 500,
      message: message || "Error al crear el servidor de Minecraft",
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

  try {
    const {
      params: { serverId },
    } = req;
    childLogger.info(`Iniciando servidor con ID: ${serverId}`, {
      filename: "service.ts",
      func: "startServer",
    });

    const job = await addTaskToQueue({ containerId: serverId }, "server");

    childLogger.info(`Tarea agregada a la cola con ID: ${job}`, {
      filename: "service.ts",
      func: "startServer",
    });

    const response = {
      requestId,
      statusCode: 201,
      message: "Servidor de Minecraft iniciado correctamente",
      payload: {
        taskId: job,
      },
    };

    res.status(201).json(response);
  } catch (error: any) {
    childLogger.error(`Error al iniciar el servidor de Minecraft: ${error}`, {
      filename: "service.ts",
      func: "startServer",
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

    res.status(statusCode || 500).json(response);
  }
};

export const stopServerController = async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const childLogger = logger.child({
    extra: { requestId },
  });

  try {
    const {
      params: { serverId },
    } = req;

    childLogger.info(`Deteniendo servidor con ID: ${serverId}`, {
      filename: "service.ts",
      func: "stopServer",
    });

    await stopContainer(serverId);

    childLogger.info(`Servidor de Minecraft detenido correctamente`, {
      filename: "service.ts",
      func: "stopServer",
    });

    const response = {
      requestId,
      statusCode: 201,
      message: "Servidor de Minecraft detenido correctamente",
    };

    res.status(201).json(response);
  } catch (error: any) {
    childLogger.error(`Error al detener el servidor de Minecraft: ${error}`, {
      filename: "service.ts",
      func: "stopServer",
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

    res.status(statusCode || 500).json(response);
  }
};

export const getServerStatusController = async (
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
    childLogger.info(`Obteniendo estado del servidor con ID: ${serverId}`, {
      filename: "service.ts",
      func: "getServerStatus",
    });

    const serverStatus = await checkStatusContainer(serverId);

    const response = {
      requestId,
      statusCode: 200,
      message: "Estado del servidor obtenido correctamente",
      payload: {
        ...serverStatus,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    childLogger.error(`Error al obtener el estado del servidor: ${error}`, {
      filename: "service.ts",
      func: "getServerStatus",
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
      func: "getServerStatus",
    });

    const job = await getTaskStatus(jobId, "server");

    if (!job || job.status === "failed") {
      childLogger.info(`Tarea con ID ${jobId} no encontrada`, {
        filename: "service.ts",
        func: "getServerStatus",
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
      func: "getServerStatus",
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
      func: "getServerStatus",
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
