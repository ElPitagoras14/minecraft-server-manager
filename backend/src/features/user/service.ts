import { Request, Response } from "express";
import { executeQuery, serverManagerPool } from "../../databases/clients";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../log";
import { encryptPassword, getRandomWord } from "../auth/utils";

export const getUserByUsername = async (username: string) => {
  const sql = `
    SELECT
      id,
      username,
      email,
      password,
      is_admin as isAdmin,
      status
    FROM users
    WHERE username = ?
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
      body: { id, username, email },
    } = req;

    childLogger.info("Creating user", {
      filename: "service.ts",
      func: "createUser",
    });
    const randomWord = getRandomWord(10);
    const password = await encryptPassword(randomWord);

    const sql = `
      INSERT INTO users (id, username, email, password)
      VALUES (?, ?, ?, ?)
    `;
    const values = [id, username, email, password];
    const result = await executeQuery(sql, values, serverManagerPool);

    childLogger.info(`User ${username} created correctly`, {
      filename: "service.ts",
      func: "createUser",
    });

    const response = {
      requestId,
      statusCode: 201,
      message: "User created correctly",
      payload: {
        id,
        username,
        email,
      },
    };

    res.status(201).json(response);
  } catch (error: any) {
    childLogger.error("Error creating user", {
      filename: "service.ts",
      func: "createUser",
      extra: {
        error: error.message,
      }
    });
    const response = {
      requestId,
      statusCode: 500,
      message: "Error creating user",
      payload: {
        error: error.message,
      },
    };
    res.status(500).json(response);
  }
};
