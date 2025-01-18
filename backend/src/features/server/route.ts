import { Router } from "express";
import {
  createServerController,
  getServerStatusController,
  getTaskStatusController,
  startServerController,
  stopServerController,
} from "./service";

const router = Router();

router.post("/", createServerController);
router.put("/start/:serverId", startServerController);
router.put("/stop/:serverId", stopServerController);
router.get("/status/:serverId", getServerStatusController);
router.get("/check-init/:jobId", getTaskStatusController);

export default router;
