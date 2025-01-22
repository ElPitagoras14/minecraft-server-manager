import { Router } from "express";
import {
  createServerController,
  deleteServerController,
  getAllServersController,
  getServerInfoController,
  getTaskStatusController,
  startServerController,
  stopServerController,
} from "./service";

const router = Router();

router.get("/", getAllServersController);
router.post("/", createServerController);
router.get("/:serverId", getServerInfoController);
router.delete("/:serverId", deleteServerController);
router.put("/start/:serverId", startServerController);
router.put("/stop/:serverId", stopServerController);
router.get("/check-init/:jobId", getTaskStatusController);

export default router;
