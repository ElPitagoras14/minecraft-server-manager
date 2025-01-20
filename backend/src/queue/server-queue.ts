import { startContainer, waitForRCON } from "../docker/client";
import Queue from "bull";
import redisClient from "../databases/redis-client";
import { logger } from "../log";
import { executeQuery, serverManagerPool } from "../databases/clients";
import { requestMap } from "../web-socket";

const initializeServerQueue = new Queue("initialize-server-queue", {
  redis: { host: redisClient.options.host, port: redisClient.options.port },
});

initializeServerQueue.on("drained", () => {
  logger.warn("Cola de tareas vacía", {
    filename: "task-queue-processor.ts",
    func: "initializeServerQueue.drained",
  });
});

initializeServerQueue.on("completed", (job) => {
  logger.info(`Trabajo con ID ${job.id} ha sido completado`, {
    filename: "task-queue-processor.ts",
    func: "initializeServerQueue.completed",
  });
});

initializeServerQueue.on("failed", (job, err) => {
  logger.error(`Trabajo con ID ${job.id} ha fallado ${err}`, {
    filename: "task-queue-processor.ts",
    func: "initializeServerQueue.failed",
  });
});

initializeServerQueue.process(async (job) => {
  try {
    const { serverId, requestId, date } = job.data;

    logger.info(`Ejecutando job ${job.id}`, {
      filename: "task-queue-processor.ts",
      func: "initializeServerQueue.process",
      extra: { requestId },
    });

    const initStatusSql = `
      UPDATE servers
      SET status = 'INITIALIZING'
      WHERE id = ?;
    `;
    await executeQuery(initStatusSql, [serverId], serverManagerPool);

    await startContainer(serverId);
    await waitForRCON(serverId, date);

    const connection = requestMap.get(`${job.id}`);
    if (connection) {
      connection.sendUTF(
        JSON.stringify({
          action: "checkServerIsReady",
          serverId,
        })
      );
      logger.info(`Server ${serverId} is ready`, {
        filename: "web-socket.ts",
        func: "connection.on",
      });
    }

    logger.info(`Job ${job.id} completado`, {
      filename: "task-queue-processor.ts",
      func: "initializeServerQueue.process",
      extra: { requestId },
    });

    const readyStatusSql = `
      UPDATE servers
      SET status = 'READY'
      WHERE id = ?;
    `;
    await executeQuery(readyStatusSql, [serverId], serverManagerPool);

    return "Servidor de Minecraft iniciado correctamente";
  } catch (error) {
    logger.error(`Error en tarea con ID: ${job.id}`, error);
    throw error;
  }
});

export { initializeServerQueue };
