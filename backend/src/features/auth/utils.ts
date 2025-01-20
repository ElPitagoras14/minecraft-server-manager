import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { authConfig } from "./config";

const { secretKey: SECRET_KEY = "secret" } = authConfig;
const saltRounds = 10;

export const encryptPassword = (plainPassword: string) =>
  new Promise((resolve, reject) => {
    bcrypt.hash(
      plainPassword,
      saltRounds,
      (err: any, hashedPassword: string) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(hashedPassword);
      }
    );
  });

export const comparePassword = (
  plainPassword: string,
  hashedPassword: string
) =>
  new Promise((resolve, reject) => {
    bcrypt.compare(
      plainPassword,
      hashedPassword,
      (err: any, result: boolean) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      }
    );
  });

export const getRandomWord = (length: number) => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  return Array.from({ length }, () =>
    characters.charAt(Math.floor(Math.random() * characters.length))
  ).join("");
};

export const generateToken = (
  payload: object,
  expiresIn: string = "1h"
): string => {
  return jwt.sign(payload, SECRET_KEY, { expiresIn });
};

export const generateLongLivedToken = (payload: object): string => {
  return jwt.sign(payload, SECRET_KEY); // Sin expiresIn
};

export const verifyToken = (token: string): any => {
  return jwt.verify(token, SECRET_KEY);
};
