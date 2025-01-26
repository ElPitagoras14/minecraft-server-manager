import { Router } from "express";
import {
  createServerController,
  deleteServerController,
  getAllServersController,
  getServerInfoController,
  getTaskStatusController,
  restartServerController,
  startServerController,
  stopServerController,
  updateServerController,
} from "./service";

const router = Router();

router.get("/", getAllServersController);
router.post("/", createServerController);
router.get("/:serverId", getServerInfoController);
router.put("/:serverId", updateServerController);
router.delete("/:serverId", deleteServerController);
router.put("/start/:serverId", startServerController);
router.put("/stop/:serverId", stopServerController);
router.put("/restart/:serverId", restartServerController);
router.get("/check-init/:jobId", getTaskStatusController);

export default router;
