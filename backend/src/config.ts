import dotenv from "dotenv";
import path from "path";

const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

export const generalConfig = {
  backend: {
    host: process.env.BACKEND_HOST,
    port: process.env.BACKEND_PORT,
  },
  admin: {
    discordId: process.env.ADMIN_DISCORD_ID,
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
  },
};
