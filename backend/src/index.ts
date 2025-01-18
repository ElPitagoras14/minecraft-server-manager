import express from "express";
import serverRouter from "./features/server/route";
import { generalConfig } from "./config";
import { logger } from "./log";

const app = express();
const PORT = generalConfig.port || 3000;

// Middleware para parsear JSON
app.use(express.json());

// Rutas
app.use("/server", serverRouter);

// Iniciar el servidor
app.listen(PORT, () => {
  logger.debug(`Servidor corriendo en http://localhost:${PORT}`, {
    filename: "index.ts",
    func: "app.listen",
  });
});
