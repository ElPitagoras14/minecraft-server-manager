import {
  client as WebSocketClient,
  IUtf8Message,
  Message,
  connection,
} from "websocket";
import { generalConfig } from "./config";
import { logger } from "./log";
import {
  ButtonInteraction,
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
    | CommandInteraction<CacheType>
    | ButtonInteraction<CacheType>;
  worldName: string;
}

const requestMap: Map<string, RequestMapItem> = new Map();
let wsConn: connection | null = null;
let reconnectAttempts = 0;

const tryReconnect = () => {
  if (reconnectAttempts < 5) {
    reconnectAttempts++;
    setTimeout(() => {
      wsConn = null;
      initWebSocketConnection();
    }, 5000);
  } else {
    logger.error("Maximum reconnect attempts reached", {
      filename: "web-socket.ts",
      func: "tryReconnect",
    });
    process.exit(1);
  }
};

export const initWebSocketConnection = () => {
  const wsClient = new WebSocketClient();

  wsClient.on("connect", (connection) => {
    logger.info("WebSocket connection established", {
      filename: "web-socket.ts",
      func: "wsClient.on",
    });

    reconnectAttempts = 0;

    connection.on("message", async (message: Message) => {
      if (message.type === "utf8") {
        console.log("Received message", (message as IUtf8Message).utf8Data);
        const { action, ...extra } = JSON.parse(
          (message as IUtf8Message).utf8Data
        );
        if (action === "checkServerIsReady") {
          const { serverId } = extra;
          const requestItem = requestMap.get(`${serverId}`);
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
      tryReconnect();
    });

    wsConn = connection;
  });

  wsClient.on("connectFailed", (error) => {
    logger.error("WebSocket connection failed", {
      filename: "web-socket.ts",
      func: "wsClient.on",
      extra: error,
    });
    tryReconnect();
  });

  wsClient.connect(`ws://${host}:${port}`);
};

export const checkServerIsReady = async (
  serverId: string,
  worldName: string,
  jobId: string,
  interaction:
    | ModalSubmitInteraction<CacheType>
    | CommandInteraction<CacheType>
    | ButtonInteraction<CacheType>
) => {
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
