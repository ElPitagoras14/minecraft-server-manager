import { startContainer, waitForRCON } from "../docker/client";
import Queue from "bull";
import redisClient from "../databases/redis-client";
import { logger } from "../log";

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
    const { containerId, requestId } = job.data;

    logger.info(`Ejecutando job ${job.id}`, {
      filename: "task-queue-processor.ts",
      func: "initializeServerQueue.process",
      extra: { requestId },
    });

    await startContainer(containerId);
    await waitForRCON(containerId);

    logger.info(`Job ${job.id} completado`, {
      filename: "task-queue-processor.ts",
      func: "initializeServerQueue.process",
      extra: { requestId },
    });

    return "Servidor de Minecraft iniciado correctamente";
  } catch (error) {
    logger.error(`Error en tarea con ID: ${job.id}`, error);
    throw error;
  }
});

export { initializeServerQueue };
