const bcrypt = require("bcrypt");

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
