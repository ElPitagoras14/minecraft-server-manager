import Docker from "dockerode";
import { dockerConfig } from "./config";
import { logger } from "../log";

const { dockerUrl } = dockerConfig;

const docker = new Docker({ protocol: "http", host: dockerUrl, port: 2375 });

const pullImage = async (imageName: string, logger: any): Promise<void> => {
  logger.info(`Downloading image ${imageName}`, {
    filename: "client.ts",
    func: "pullImage",
  });
  return new Promise((resolve, reject) => {
    docker.pull(
      imageName,
      (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) {
          return reject(err);
        }

        stream.on("end", () => {
          resolve();
        });

        stream.on("data", (data: Buffer) => {
          data.toString();
        });

        stream.on("error", (err: Error) => {
          reject(err);
        });
      }
    );
  });
};

export const waitForRCON = async (
  containerId: string,
  date: number = Date.now()
) => {
  try {
    const container = docker.getContainer(containerId);

    const startTime = Math.floor(date / 1000);

    const logStream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      since: startTime,
    });

    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<void>((resolve, reject) => {
      const resetTimeout = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
          reject(new Error("Timeout waiting for RCON"));
        }, 1000 * 90);
      };

      resetTimeout();

      logStream.on("data", (data: Buffer) => {
        const logMessage = data.toString();
        if (logMessage.includes("RCON running on 0.0.0.0:25575")) {
          logger.info("Minecraft Server is ready", {
            filename: "client.ts",
            func: "waitForRCON",
          });
          resolve();
        }

        resetTimeout();
      });

      logStream.on("error", (error: Error) => {
        logger.error(`Error getting logs from container: ${error}`, {
          filename: "client.ts",
          func: "waitForRCON",
        });
        reject(error);
      });
    });

    await Promise.race([timeoutPromise]);
  } catch (error) {
    logger.error(
      `Error al esperar por RCON en el contenedor ${containerId}: ${error}`,
      {
        filename: "client.ts",
        func: "waitForRCON",
      }
    );
    throw error;
  }
};

export const startContainer = async (containerId: string) => {
  try {
    logger.info(`Starting container ${containerId}`, {
      filename: "client.ts",
      func: "startContainer",
    });
    const container = docker.getContainer(containerId);
    await container.start();
    logger.info(`Container ${containerId} initialized correctly`, {
      filename: "client.ts",
      func: "startContainer",
    });
  } catch (error) {
    logger.error(`Error initializing container ${containerId}: ${error}`, {
      filename: "client.ts",
      func: "startContainer",
    });
  }
};

export const stopContainer = async (containerId: string) => {
  try {
    const container = docker.getContainer(containerId);
    await container.stop();
    logger.info(`Minecraft container ${containerId} stopped correctly`, {
      filename: "client.ts",
      func: "stopMinecraftServer",
    });
  } catch (error) {
    logger.error(
      `Error stopping Minecraft container ${containerId}: ${error}`,
      {
        filename: "client.ts",
        func: "stopMinecraftServer",
      }
    );
  }
};

export const restartContainer = async (containerId: string) => {
  try {
    const container = docker.getContainer(containerId);
    await container.restart();
    logger.info(`Minecraft server ${containerId} restarted correctly.`, {
      filename: "client.ts",
      func: "restartMinecraftServer",
    });
  } catch (error) {
    logger.error(
      `Error restarting Minecraft container ${containerId}: ${error}`,
      {
        filename: "client.ts",
        func: "restartMinecraftServer",
      }
    );
  }
};

export const createContainer = async (
  version: string,
  newPort: string | number,
  serverProperties: any
) => {
  const { motd, maxPlayers, difficulty, worldName } = serverProperties;
  try {
    logger.info("Creating Minecraft container", {
      filename: "client.ts",
      func: "createContainer",
    });

    const images = await docker.listImages();
    const imageExists = images.some((image) =>
      image.RepoTags?.some((tag) => tag.startsWith("itzg/minecraft-server"))
    );

    if (!imageExists) {
      await pullImage("itzg/minecraft-server", logger);
    }

    const containerOptions = {
      Image: "itzg/minecraft-server",
      name: `minecraft-${newPort}`,
      Tty: true,
      Env: [
        "EULA=TRUE",
        "NNOUNCE_PLAYER_ACHIEVEMENTS=true",
        "VIEW_DISTANCE=10",
        "ONLINE_MODE=FALSE",
        `VERSION=${version}`,
        `MOTD=${motd}`,
        `MAX_PLAYERS=${maxPlayers}`,
        `DIFFICULTY=${difficulty}`,
        `LEVEL=${worldName}`,
      ],
      ExposedPorts: {
        "25565/tcp": {},
      },
      HostConfig: {
        PortBindings: {
          "25565/tcp": [{ HostPort: `${newPort}` }],
        },
      },
    };

    const container = await docker.createContainer(containerOptions);
    const containerId = container.id.slice(0, 12);

    logger.info(`Minecraft container created with id: ${containerId}`, {
      filename: "client.ts",
      func: "createContainer",
    });

    return containerId;
  } catch (error) {
    logger.error(`Error while creating Minecraft container`, {
      filename: "client.ts",
      func: "createContainer",
      extra: {
        error,
      },
    });
    throw error;
  }
};

export const deleteContainer = async (containerId: string) => {
  try {
    const container = docker.getContainer(containerId);
    await container.remove();
    logger.info(`Minecraft container ${containerId} deleted correctly`, {
      filename: "client.ts",
      func: "deleteContainer",
    });
  } catch (error) {
    logger.error(
      `Error deleting Minecraft container ${containerId}: ${error}`,
      {
        filename: "client.ts",
        func: "deleteContainer",
      }
    );
  }
};

export const checkStatusContainer = async (containerId: string) => {
  try {
    const container = docker.getContainer(containerId);
    const data = await container.inspect();
    const { State } = data;
    return State;
  } catch (error) {
    logger.error(`Error getting the container status: ${error}`, {
      filename: "client.ts",
      func: "checkStatusContainer",
    });
    throw error;
  }
};
