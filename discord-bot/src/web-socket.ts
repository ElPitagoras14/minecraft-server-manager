import {
  client as WebSocketClient,
  IUtf8Message,
  Message,
  connection,
} from "websocket";
import { generalConfig } from "./config";
import { logger } from "./log";
import {
  CacheType,
  CommandInteraction,
  MessageFlags,
  ModalSubmitInteraction,
} from "discord.js";

const {
  backend: { host, port },
} = generalConfig;

interface RequestMapItem {
  interaction:
    | ModalSubmitInteraction<CacheType>
    | CommandInteraction<CacheType>;
  worldName: string;
}

const requestMap: Map<string, RequestMapItem> = new Map();
let wsConn: connection | null = null;

export const initWebSocketConnection = () => {
  const wsClient = new WebSocketClient();

  wsClient.on("connect", (connection) => {
    logger.info("WebSocket connection established", {
      filename: "web-socket.ts",
      func: "wsClient.on",
    });

    connection.on("message", async (message: Message) => {
      logger.debug("Received message from WebSocket", {
        filename: "web-socket.ts",
        func: "connection.on",
      });
      if (message.type === "utf8") {
        const { action, ...extra } = JSON.parse(
          (message as IUtf8Message).utf8Data
        );
        logger.debug("Received message from WebSocket", {
          filename: "web-socket.ts",
          func: "connection.on",
          extra: { action, extra },
        });

        if (action === "checkServerIsReady") {
          const { serverId } = extra;
          const requestItem = requestMap.get(serverId);
          if (requestItem) {
            const { interaction, worldName } = requestItem;
            const user = interaction.user;
            await interaction.followUp({
              content: `Server \`${worldName}\` is ready for your use ${user.toString()}`,
              flags: MessageFlags.Ephemeral,
            });
            requestMap.delete(serverId);
          }
        }
      }
    });

    connection.on("close", () => {
      logger.info("WebSocket connection closed", {
        filename: "web-socket.ts",
        func: "connection.on",
      });
    });

    wsConn = connection;
  });

  wsClient.on("connectFailed", (error) => {
    logger.error("WebSocket connection failed", {
      filename: "web-socket.ts",
      func: "wsClient.on",
      extra: error,
    });
  });

  wsClient.connect(`ws://${host}:${port}`);
};

export const checkServerIsReady = async (
  serverId: string,
  worldName: string,
  jobId: string,
  interaction: ModalSubmitInteraction<CacheType> | CommandInteraction<CacheType>
) => {
  logger.info("Checking server status", {
    filename: "web-socket.ts",
    func: "checkServerIsReady",
  });
  if (!wsConn) {
    logger.error("No connection to the backend", {
      filename: "web-socket.ts",
      func: "checkServerIsReady",
    });
    await interaction.followUp("No connection to the backend");
    return;
  }

  if (requestMap.has(serverId)) {
    logger.warn("Server already being created", {
      filename: "web-socket.ts",
      func: "checkServerIsReady",
    });
    await interaction.followUp("Server already being created");
    return;
  }

  try {
    logger.debug("Sending message to WebSocket", {
      filename: "web-socket.ts",
      func: "checkServerIsReady",
    });
    const message = JSON.stringify({
      action: "checkServerIsReady",
      serverId,
      jobId,
    });
    wsConn.sendUTF(message);
    requestMap.set(serverId, {
      interaction,
      worldName,
    });
  } catch (error) {
    logger.error("Error sending message to WebSocket", {
      filename: "web-socket.ts",
      func: "createServer",
      extra: error,
    });
    await interaction.followUp("Error creating server");
  }
};
