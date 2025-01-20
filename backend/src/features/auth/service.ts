import { Request, Response } from "express";
import { getUserByUsername } from "../user/service";
import {
  generateToken,
  generateLongLivedToken,
  comparePassword,
} from "./utils";
import { logger } from "../../log";
import { v4 as uuidv4 } from "uuid";

export const loginController = async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const childLogger = logger.child({
    extra: { requestId },
  });
  try {
    const {
      body: { username, password },
    } = req;
    childLogger.info("Iniciando sesión", {
      filename: "service.ts",
      func: "loginController",
    });
    const user = await getUserByUsername(username);

    if (!user) {
      const response = {
        requestId,
        statusCode: 404,
        message: "Usuario no encontrado",
      };
      childLogger.error("Usuario no encontrado", {
        filename: "service.ts",
        func: "loginController",
        extra: response,
      });
      res.status(404).json(response);
      return;
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      const response = {
        requestId,
        statusCode: 401,
        message: "Contraseña incorrecta",
      };
      childLogger.error("Contraseña incorrecta", {
        filename: "service.ts",
        func: "loginController",
        extra: response,
      });
      res.status(401).json(response);
      return;
    }

    if (!isPasswordValid) {
      const response = {
        requestId,
        statusCode: 401,
        message: "Contraseña incorrecta",
      };
      childLogger.error("Contraseña incorrecta", {
        filename: "service.ts",
        func: "loginController",
        extra: response,
      });
      res.status(401).json(response);
      return;
    }

    let token;
    if (user.isAdmin) {
      token = generateLongLivedToken({
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
      });
    } else {
      token = generateToken({
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
      });
    }

    const response = {
      requestId,
      statusCode: 200,
      message: "Sesión iniciada correctamente",
      payload: {
        token,
      },
    };
    childLogger.info("Sesión iniciada correctamente", {
      filename: "service.ts",
      func: "loginController",
    });

    res.status(200).json(response);
  } catch (error: any) {
    logger.error("Error interno del servidor", {
      filename: "service.ts",
      func: "loginController",
      extra: error,
    });
    const response = {
      requestId,
      statusCode: 500,
      message: "Internal server error",
    };
    childLogger.error("Internal server error", {
      filename: "service.ts",
      func: "loginController",
      extra: error,
    });
    res.status(500).json(response);
  }
};
