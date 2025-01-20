import { Router } from "express";
import {
  createServerController,
  getAllServersController,
  getServerInfoController,
  getTaskStatusController,
  startServerController,
  stopServerController,
} from "./service";

const router = Router();

router.get("/", getAllServersController);
router.post("/", createServerController);
router.put("/start/:serverId", startServerController);
router.put("/stop/:serverId", stopServerController);
router.get("/info/:serverId", getServerInfoController);
router.get("/check-init/:jobId", getTaskStatusController);

export default router;
