import express, { Application } from "express";
import cors from "cors";
import { generalConfig } from "./config";
import { logger } from "./log";
import { createAdmin, checkAllServerStatus } from "./init";
import http from "http";
import { setupWebSocket } from "./web-socket";
import { authenticateToken } from "./features/auth/middleware";
import serverRouter from "./features/server/route";
import authRouter from "./features/auth/route";
import userRouter from "./features/user/route";

const {
  backend: { host = "localhost", port = 4012 },
} = generalConfig;

(async () => {
  await createAdmin();
  await checkAllServerStatus();
})();

const app: Application = express();

app.use(express.json());
app.use(cors());

app.use("/servers", serverRouter);
app.use("/users", authenticateToken, userRouter);
app.use("/auth", authRouter);

const httpServer = http.createServer(app);

setupWebSocket(httpServer);

httpServer.listen(port, () => {
  logger.info(`Server started at http://${host}:${port}`, {
    filename: "index.ts",
    func: "httpServer.listen",
  });
});
