import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { authConfig } from "./config";

const { secretKey = "secret", maxAge = "3600" } = authConfig;
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
  expiresIn: string = `${parseInt(maxAge) * 1000}`
): string => {
  return jwt.sign(payload, secretKey, { expiresIn });
};

export const generateLongLivedToken = (payload: object): string => {
  return jwt.sign(payload, secretKey); // Sin expiresIn
};

export const verifyToken = (token: string): any => {
  return jwt.verify(token, secretKey);
};
