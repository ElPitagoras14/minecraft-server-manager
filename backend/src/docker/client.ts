import Docker from "dockerode";
import { dockerConfig } from "./config";
import { logger } from "../log";

const dockerApiUrl = dockerConfig.dockerUrl;

const docker = new Docker({ protocol: "http", host: dockerApiUrl, port: 2375 });

const checkRCONInLogs = async (containerId: string): Promise<boolean> => {
  try {
    const container = docker.getContainer(containerId);

    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: 100,
    });

    const logMessage = logs.toString();

    if (logMessage.includes("RCON running on 0.0.0.0:25575")) {
      logger.info("RCON ya está disponible en los logs", {
        filename: "client.ts",
        func: "checkRCONInLogs",
      });
      return true;
    }

    return false;
  } catch (error) {
    logger.error(
      `Error al obtener los logs del contenedor ${containerId}: ${error}`,
      {
        filename: "client.ts",
        func: "checkRCONInLogs",
      }
    );
    throw error;
  }
};

const pullImage = (imageName: string, logger: any): Promise<void> => {
  logger.info(`Descargando imagen ${imageName}`, {
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

export const waitForRCON = async (containerId: string) => {
  try {
    const container = docker.getContainer(containerId);

    const rconFound = await checkRCONInLogs(containerId);
    if (rconFound) {
      logger.info("Servidor Minecraft listo", {
        filename: "client.ts",
        func: "waitForRCON",
      });
      return;
    }

    const logStream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
    });

    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<void>((resolve, reject) => {
      const resetTimeout = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
          reject(new Error("Timeout alcanzado sin encontrar RCON en los logs"));
        }, 1000 * 90);
      };

      resetTimeout();

      logStream.on("data", (data: Buffer) => {
        const logMessage = data.toString();
        if (logMessage.includes("RCON running on 0.0.0.0:25575")) {
          logger.info("Servidor Minecraft listo y RCON disponible", {
            filename: "client.ts",
            func: "waitForRCON",
          });
          resolve();
        }

        resetTimeout();
      });

      logStream.on("error", (error: Error) => {
        logger.error(`Error al obtener logs del contenedor: ${error}`, {
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
    logger.info(`Iniciando contenedor ${containerId.slice(0, 12)}`, {
      filename: "client.ts",
      func: "startContainer",
    });
    const container = docker.getContainer(containerId);
    await container.start();
    logger.info(
      `Contenedor ${containerId.slice(0, 12)} iniciado correctamente`,
      {
        filename: "client.ts",
        func: "startContainer",
      }
    );
  } catch (error) {
    logger.error(`Error al iniciar el contenedor: ${error}`, {
      filename: "client.ts",
      func: "startContainer",
    });
  }
};

export const stopContainer = async (containerId: string) => {
  try {
    const container = docker.getContainer(containerId);
    await container.stop();
    logger.info(
      `Contenedor Minecraft ${containerId.slice(0, 12)} detenido correctamente`,
      {
        filename: "client.ts",
        func: "stopMinecraftServer",
      }
    );
  } catch (error) {
    logger.error(`Error al detener el servidor de Minecraft: ${error}`, {
      filename: "client.ts",
      func: "stopMinecraftServer",
    });
  }
};

export const restartContainer = async (containerId: string) => {
  try {
    const container = docker.getContainer(containerId);
    await container.restart();
    logger.info(
      `Servidor de Minecraft ${containerId.slice(
        0,
        12
      )} reiniciado correctamente.`,
      {
        filename: "client.ts",
        func: "restartMinecraftServer",
      }
    );
  } catch (error) {
    logger.error(`Error al reiniciar el servidor de Minecraft: ${error}`, {
      filename: "client.ts",
      func: "restartMinecraftServer",
    });
  }
};

export const createContainer = async (
  version: string,
  newPort: string,
  serverProperties: any
) => {
  const { motd, maxPlayers, difficulty, levelName } = serverProperties;
  try {
    logger.info("Creando contenedor Minecraft", {
      filename: "client.ts",
      func: "createMinecraftServer",
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
      name: "minecraft-server",
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
        `LEVEL=${levelName}`,
      ],
      ExposedPorts: {
        "25565/tcp": {},
      },
      HostConfig: {
        PortBindings: {
          "25565/tcp": [{ HostPort: newPort }],
        },
      },
    };

    const container = await docker.createContainer(containerOptions);
    const containerId = container.id;

    logger.info(
      `Contenedor Minecraft creado con ID: ${containerId.slice(0, 12)}`,
      {
        filename: "client.ts",
        func: "createMinecraftServer",
      }
    );

    return containerId;
  } catch (error) {
    logger.error(`Error al crear el contenedor Minecraft: ${error}`, {
      filename: "client.ts",
      func: "createMinecraftServer",
    });
    throw error;
  }
};

export const checkStatusContainer = async (containerId: string) => {
  try {
    const container = docker.getContainer(containerId);
    const data = await container.inspect();
    const { State } = data;
    return State;
  } catch (error) {
    logger.error(`Error al obtener el estado del contenedor: ${error}`, {
      filename: "client.ts",
      func: "checkStatusContainer",
    });
    throw error;
  }
};
