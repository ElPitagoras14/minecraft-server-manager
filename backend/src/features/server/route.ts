import { Router } from "express";
import {
  createServerBackupController,
  createServerController,
  createServerOperatorController,
  deleteServerBackupController,
  deleteServerController,
  deleteServerOperatorController,
  downloadBackupController,
  getAllServersController,
  getServerBackupController,
  getServerInfoController,
  getServerLogsController,
  getServerOperatorsController,
  getServerPropertiesController,
  getTaskStatusController,
  restartServerController,
  restoreBackupController,
  startServerController,
  stopServerController,
  updateServerInfoController,
  updateServerPropertiesController,
} from "./service";
import { schemaValidator } from "../../middleware";
import {
  createServerSchema,
  getAllServerSchema,
  getServerInfoSchema,
  deleteServerSchema,
  restartServerSchema,
  startServerSchema,
  stopServerSchema,
  updateServerInfoSchema,
} from "./schema";
import { authenticateToken } from "../auth/middleware";

const router = Router();

router.get("/backups/:backupId", downloadBackupController);

router.use(authenticateToken);

router.get("/", schemaValidator(getAllServerSchema), getAllServersController);
router.post("/", schemaValidator(createServerSchema), createServerController);
router.get(
  "/:serverId",
  schemaValidator(getServerInfoSchema),
  getServerInfoController
);
router.put(
  "/:serverId",
  schemaValidator(updateServerInfoSchema),
  updateServerInfoController
);
router.delete(
  "/:serverId",
  schemaValidator(deleteServerSchema),
  deleteServerController
);

router.put(
  "/start/:serverId",
  schemaValidator(startServerSchema),
  startServerController
);
router.put(
  "/stop/:serverId",
  schemaValidator(stopServerSchema),
  stopServerController
);
router.put(
  "/restart/:serverId",
  schemaValidator(restartServerSchema),
  restartServerController
);

router.get("/job-status/:jobId", getTaskStatusController);

router.get("/:serverId/properties", getServerPropertiesController);
router.put("/:serverId/properties", updateServerPropertiesController);

router.get("/:serverId/backups", getServerBackupController);
router.post("/:serverId/backups", createServerBackupController);
router.put("/backups/:backupId", restoreBackupController);
router.delete("/backups/:backupId", deleteServerBackupController);

router.get("/:serverId/operators", getServerOperatorsController);
router.post("/:serverId/operators", createServerOperatorController);
router.delete("/:serverId/operators/:username", deleteServerOperatorController);
router.get("/:serverId/logs", getServerLogsController);

export default router;
