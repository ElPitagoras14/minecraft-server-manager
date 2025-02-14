import { server as WebSocketServer, connection } from "websocket";
import http from "http";
import { logger } from "./log";
import { generalConfig } from "./config";

const {
  backend: { host = "localhost", port = 4011 },
} = generalConfig;

export const requestMap: Map<string, connection> = new Map();

export function setupWebSocket(httpServer: http.Server) {
  const wsServer = new WebSocketServer({
    httpServer,
    autoAcceptConnections: false,
  });

  wsServer.on("request", (request) => {
    const connection = request.accept(undefined, request.origin);

    logger.info(`Client connected from ${connection.remoteAddress}`, {
      filename: "web-socket.ts",
      func: "wsServer.request",
    });

    connection.on("message", async (message) => {
      if (message.type === "utf8") {
        try {
          const data = JSON.parse(message.utf8Data);
          logger.info(`Received message`, {
            filename: "web-socket.ts",
            func: "connection.on",
            extra: data,
          });

          if (data.action === "checkServerIsReady") {
            const { serverId, jobId } = data;

            logger.info(`Checking if server ${serverId} is ready`, {
              filename: "web-socket.ts",
              func: "connection.on",
            });

            requestMap.set(jobId, connection);
          } else {
            logger.warn("Unknown action", {
              filename: "web-socket.ts",
              func: "connection.on",
              extra: data,
            });
          }
        } catch (error) {
          logger.error("Error parsing message", {
            filename: "web-socket.ts",
            func: "connection.on",
            extra: error,
          });
        }
      }
    });

    connection.on("close", (reasonCode, description) => {
      logger.info(`Client disconnected: ${description}`, {
        filename: "web-socket.ts",
        func: "connection.on",
      });
    });
  });

  logger.info(`WebSocket server started at ws://${host}:${port}`, {
    filename: "web-socket.ts",
    func: "setupWebSocket",
  });
}
