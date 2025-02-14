import { Router } from "express";
import {
  createServerController,
  deleteServerController,
  getAllServersController,
  getServerInfoController,
  getServerPropertiesController,
  getTaskStatusController,
  restartServerController,
  startServerController,
  stopServerController,
  updateServerInfoController,
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

const router = Router();

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
router.get("/properties/:serverId", getServerPropertiesController);

export default router;
