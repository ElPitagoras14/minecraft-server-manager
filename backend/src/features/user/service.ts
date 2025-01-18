import { Request, Response } from "express";
import { encryptPassword, getRandomWord } from "./utils";
import { executeQuery, serverManagerPool } from "../../databases/clients";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../log";

export const createUser = async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const childLogger = logger.child({
    extra: { requestId },
  });
  try {
    const {
      body: { id, username, email },
    } = req;

    childLogger.info("Creando usuario", {
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

    childLogger.info(`Usuario ${username} creado correctamente`, {
      filename: "service.ts",
      func: "createUser",
    });

    const response = {
      requestId,
      statusCode: 201,
      message: "Usuario creado correctamente",
      payload: {
        id,
        username,
        email,
      },
    };

    res.status(201).json(response);
  } catch (error: any) {
    childLogger.error("Error al crear usuario", {
      filename: "service.ts",
      func: "createUser",
      error: error.message,
    });
    const response = {
      requestId,
      statusCode: 500,
      message: "Error al crear usuario",
      payload: {
        error: error.message,
      },
    };
    res.status(500).json(response);
  }
};
