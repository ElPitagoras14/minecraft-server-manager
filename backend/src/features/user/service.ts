import { Request, Response } from "express";
import { executeQuery, serverManagerPool } from "../../databases/clients";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../log";
import { encryptPassword, getRandomWord } from "../auth/utils";

export const getUserByUsername = async (username: string) => {
  const sql = `
    SELECT
      u.id,
      u.username,
      u.password,
      u.is_admin as isAdmin,
      u.status
    FROM users u
    WHERE u.username = ?
  `;
  const { result } = await executeQuery(sql, [username], serverManagerPool);

  if (result.length === 0) {
    return null;
  }

  const [user] = result;
  return user;
};

export const createUserController = async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const childLogger = logger.child({
    extra: { requestId },
  });
  try {
    const {
      body: { id, username, password },
    } = req;

    childLogger.debug("Received", {
      filename: "service.ts",
      func: "createUserController",
      extra: {
        query: req.query,
        body: req.body,
        params: req.params,
      },
    });

    childLogger.info("Creating user", {
      filename: "service.ts",
      func: "createUserController",
    });

    const existsSql = `
      SELECT
        u.id,
        u.username,
        u.password,
        u.is_admin as isAdmin,
        u.status
      FROM users u
      WHERE u.id = ?
    `;
    const { result } = await executeQuery(existsSql, [id], serverManagerPool);

    if (result.length !== 0) {
      childLogger.error("User already exists. Contact an administrator", {
        filename: "service.ts",
        func: "createUserController",
      });
      const response = {
        requestId,
        statusCode: 409,
        message: "User already exists",
      };
      res.status(409).send(response);
      return;
    }

    const hashedPassword = await encryptPassword(password);

    const sql = `
      INSERT INTO users (id, username, password)
      VALUES (?, ?, ?)
    `;
    const values = [id, username, hashedPassword];
    await executeQuery(sql, values, serverManagerPool);

    childLogger.info(`User ${username} created correctly`, {
      filename: "service.ts",
      func: "createUserController",
    });

    const response = {
      requestId,
      statusCode: 201,
      message: "User created correctly",
      payload: {
        id,
        username,
      },
    };

    res.status(201).json(response);
  } catch (error: any) {
    const {
      message,
      statusCode,
      json: { message: specificMessage } = {},
    } = error;

    childLogger.error(`Error while creating user`, {
      filename: "service.ts",
      func: "createUserController",
      extra: {
        error: message,
      },
    });

    const response = {
      requestId,
      statusCode: statusCode || 500,
      message: message || "Internal Server Error",
      payload: {
        error: specificMessage,
      },
    };

    res.status(statusCode || 500).json(response);
  }
};
