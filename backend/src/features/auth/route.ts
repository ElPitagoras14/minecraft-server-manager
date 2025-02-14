import express from "express";
import { loginController } from "./service";
import { schemaValidator } from "../../middleware";
import { loginSchema } from "./schema";

const router = express.Router();

router.post("/login", schemaValidator(loginSchema), loginController);

export default router;
