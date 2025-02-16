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
    childLogger.info(`Logging in for user ${username}`, {
      filename: "service.ts",
      func: "loginController",
    });

    const user = await getUserByUsername(username);
    if (!user) {
      const response = {
        requestId,
        statusCode: 404,
        message: "User not found",
      };
      childLogger.error(`User ${username} not found`, {
        filename: "service.ts",
        func: "loginController",
      });
      res.status(404).json(response);
      return;
    }

    if (user.status !== "ACTIVE") {
      const response = {
        requestId,
        statusCode: 401,
        message: "User is not active",
      };
      childLogger.error(`User ${username} is not active`, {
        filename: "service.ts",
        func: "loginController",
      });
      res.status(401).json(response);
      return;
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      const response = {
        requestId,
        statusCode: 401,
        message: "Incorret password",
      };
      childLogger.error("Incorrect password", {
        filename: "service.ts",
        func: "loginController",
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

    childLogger.info("Successfully logged in", {
      filename: "service.ts",
      func: "loginController",
    });

    const response = {
      requestId,
      statusCode: 200,
      message: "Successfully logged in",
      payload: {
        token,
      },
    };

    res.status(200).json(response);
  } catch (error: any) {
    logger.error("Error logging in", {
      filename: "service.ts",
      func: "loginController",
      extra: error,
    });
    const response = {
      requestId,
      statusCode: 500,
      message: "Error logging in",
    };
    res.status(500).json(response);
  }
};
