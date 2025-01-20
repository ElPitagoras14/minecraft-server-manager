import { Job, Queue } from "bull";
import { initializeServerQueue } from "./server-queue";
import { logger } from "../log";

type TaskStatus = {
  ticketId: string;
  status: string;
  result?: any;
  error?: string;
};

const queues: { [key: string]: Queue } = {
  server: initializeServerQueue,
};

export const addTaskToQueue = async (
  data: object,
  type: string
): Promise<string> => {
  let taskQueue;

  if (type === "server") {
    taskQueue = initializeServerQueue;
  } else {
    throw new Error("Tipo de tarea no soportado");
  }

  const job = await taskQueue.add(data, {
    attempts: 3,
    backoff: 1000,
  });
  return job.id as string;
};

export const getTaskStatus = async (
  ticketId: string,
  queueName: string
): Promise<TaskStatus | null> => {
  const queue = queues[queueName];

  if (!queue) {
    throw new Error(`Queue with name ${queueName} does not exist`);
  }

  try {
    const job: Job | null = await queue.getJob(ticketId);

    if (!job) {
      return null;
    }

    const status = (await job.isCompleted())
      ? "completed"
      : (await job.isFailed())
      ? "failed"
      : "in-progress";

    const taskStatus: TaskStatus = {
      ticketId: job.id! as string,
      status,
      result: job.returnvalue,
      error: job.failedReason,
    };

    return taskStatus;
  } catch (error) {
    logger.error("Failed to get task status", {
      filename: "task-queue-service.ts",
      func: "getTaskStatus",
      extra: {
        ticketId,
        queueName,
      },
    });
    throw new Error("Failed to get task status");
  }
};
