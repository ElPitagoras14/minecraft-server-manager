import express from "express";
import { loginController } from "./service";

const router = express.Router();

router.post("/login", loginController);

export default router;
