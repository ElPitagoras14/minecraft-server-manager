import Docker from "dockerode";
import { dockerConfig } from "./config";
import { logger } from "../log";
import fs from "fs";

const { dockerUrl, dockerData } = dockerConfig;

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

const formatDockerBindPath = (path: string) => {
  let formattedPath = path.replace(/\\/g, "/");

  if (/^[A-Z]:\//i.test(formattedPath)) {
    formattedPath = `/${formattedPath[0].toLowerCase()}${formattedPath.slice(
      2
    )}`;
  }

  return formattedPath;
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
  } catch (error: any) {
    logger.error(`Error waiting for RCON in container ${containerId}`, {
      filename: "client.ts",
      func: "waitForRCON",
      extra: error,
    });
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
    logger.error(`Error initializing container ${containerId}`, {
      filename: "client.ts",
      func: "startContainer",
      extra: error,
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
    logger.error(`Error stopping Minecraft container ${containerId}`, {
      filename: "client.ts",
      func: "stopMinecraftServer",
      extra: error,
    });
  }
};

export const recreateContainerProperties = async (
  containerId: string,
  serverPath: string,
  newPort: number,
  version: string,
  serverProperties: any
) => {
  try {
    const {
      motd = "A simple server",
      difficulty = "normal",
      serverIcon,
      maxPlayers = 8,
      viewDistance = 16,
      serverName = "world",
    } = serverProperties || {};

    logger.info("Recreating Minecraft container", {
      filename: "client.ts",
      func: "recreateContainerProperties",
    });

    const prevContainer = docker.getContainer(containerId);
    const containerExists = await prevContainer.inspect().catch(() => null);

    if (containerExists) {
      const containerInfo = await prevContainer.inspect();
      if (containerInfo.State.Running) {
        await prevContainer.stop();
      }
      await prevContainer.remove();
    }

    const containerOptions = {
      Image: "itzg/minecraft-server",
      name: `minecraft-${newPort}`,
      Tty: true,
      Env: [
        "EULA=TRUE",
        "ANNOUNCE_PLAYER_ACHIEVEMENTS=true",
        "ONLINE_MODE=FALSE",
        `VERSION=${version}`,
        `MOTD=${motd}`,
        `DIFFICULTY=${difficulty}`,
        `MAX_PLAYERS=${maxPlayers}`,
        `VIEW_DISTANCE=${viewDistance}`,
        `LEVEL=${serverName}`,
      ],
      ExposedPorts: {
        "25565/tcp": {},
      },
      HostConfig: {
        PortBindings: {
          "25565/tcp": [{ HostPort: `${newPort}` }],
        },
        Binds: [`${serverPath}:/data`],
      },
    };

    if (serverIcon) {
      containerOptions.Env.push(`ICON=${serverIcon}`);
    }

    const container = await docker.createContainer(containerOptions);
    const newContainerId = container.id.slice(0, 12);

    logger.info(`Minecraft container created with id: ${newContainerId}`, {
      filename: "client.ts",
      func: "createContainer",
    });

    return newContainerId;
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

export const execRconCommands = async (
  containerId: string,
  commands: string[]
) => {
  try {
    const container = docker.getContainer(containerId);

    const commandsResult: {
      command: string;
      output: string;
    }[] = [];

    for (const cmd of commands) {
      try {
        const exec = await container.exec({
          Cmd: ["rcon-cli", cmd],
          AttachStdout: true,
          AttachStderr: true,
        });

        let output = "";

        const stream = await exec.start({
          Detach: false,
          Tty: false,
        });

        await new Promise<void>((resolve, reject) => {
          stream.on("data", (data: Buffer) => {
            output += data.toString("utf-8").replace(/[\x00-\x1F\x7F]/g, "");
          });

          stream.on("end", () => {
            commandsResult.push({
              command: cmd,
              output,
            });
            resolve();
          });

          stream.on("error", reject);
        });
      } catch (error) {
        logger.error(`Error executing command in container ${containerId}`, {
          filename: "client.ts",
          func: "execCommand",
          extra: error,
        });
        throw error;
      }
    }

    return commandsResult;
  } catch (error) {
    logger.error(`Error executing command in container ${containerId}`, {
      filename: "client.ts",
      func: "execCommand",
      extra: error,
    });
    throw error;
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
    logger.error(`Error restarting Minecraft container ${containerId}`, {
      filename: "client.ts",
      func: "restartMinecraftServer",
      extra: error,
    });
  }
};

export const createContainer = async (
  newPort: string | number,
  serverProperties: any
) => {
  const {
    version = "LATEST",
    motd = "A simple server",
    difficulty = "normal",
    serverIcon,
    maxPlayers = 8,
    viewDistance = 16,
    seed,
    serverName = "world",
  } = serverProperties || {};
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

    const formattedPath = formatDockerBindPath(dockerData as string);

    const serverPath = `${formattedPath}/servers/minecraft-${newPort}`;
    console.log(serverPath);
    if (!fs.existsSync(serverPath)) {
      fs.mkdirSync(serverPath, { recursive: true });
    }

    const containerOptions = {
      Image: "itzg/minecraft-server",
      name: `minecraft-${newPort}`,
      Tty: true,
      Env: [
        "EULA=TRUE",
        "ANNOUNCE_PLAYER_ACHIEVEMENTS=true",
        "ONLINE_MODE=FALSE",
        `VERSION=${version}`,
        `MOTD=${motd}`,
        `DIFFICULTY=${difficulty}`,
        `MAX_PLAYERS=${maxPlayers}`,
        `VIEW_DISTANCE=${viewDistance}`,
        `LEVEL=${serverName}`,
      ],
      ExposedPorts: {
        "25565/tcp": {},
      },
      HostConfig: {
        PortBindings: {
          "25565/tcp": [{ HostPort: `${newPort}` }],
        },
        Binds: [`${serverPath}:/data`],
      },
    };

    if (serverIcon) {
      containerOptions.Env.push(`ICON=${serverIcon}`);
    }

    if (seed) {
      containerOptions.Env.push(`SEED=${seed}`);
    }

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
    await container.remove({ force: true });
    logger.info(`Minecraft container ${containerId} deleted correctly`, {
      filename: "client.ts",
      func: "deleteContainer",
    });
  } catch (error) {
    logger.error(`Error deleting Minecraft container ${containerId}`, {
      filename: "client.ts",
      func: "deleteContainer",
      extra: error,
    });
  }
};

export const getStatusContainer = async (containerId: string) => {
  try {
    const container = docker.getContainer(containerId);
    const data = await container.inspect();
    const { State } = data;
    return State;
  } catch (error) {
    logger.error(`Error getting the container status`, {
      filename: "client.ts",
      func: "getStatusContainer",
      extra: error,
    });
    throw error;
  }
};
