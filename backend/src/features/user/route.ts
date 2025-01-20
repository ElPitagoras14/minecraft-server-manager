import { Router } from "express";
import { createUserController } from "./service";

const router = Router();

router.post("/", createUserController);

export default router;
