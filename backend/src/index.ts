import express from "express";
import { generalConfig } from "./config";
import { logger } from "./log";
import { createAdmin } from "./init";
import http from "http";
import { setupWebSocket } from "./web-socket";
import { authenticateToken } from "./features/auth/middleware";
import serverRouter from "./features/server/route";
import authRouter from "./features/auth/route";

const {
  backend: { host = "localhost", port = 3000 },
} = generalConfig;

(async () => {
  await createAdmin();
})();

const app = express();

app.use(express.json());
app.use("/server", authenticateToken, serverRouter);
app.use("/auth", authRouter);

const httpServer = http.createServer(app);

setupWebSocket(httpServer);

httpServer.listen(port, () => {
  logger.info(`Server started at http://${host}:${port}`, {
    filename: "index.ts",
    func: "httpServer.listen",
  });
});
