import dotenv from "dotenv";
import path from "path";

const envPath = path.resolve(__dirname, "../../../.env");
dotenv.config({ path: envPath });

export const authConfig = {
  secretKey: process.env.AUTH_SECRET_KEY,
};
