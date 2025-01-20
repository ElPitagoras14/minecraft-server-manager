import { executeQuery, serverManagerPool } from "./databases/clients";
import { generalConfig } from "./config";
import { logger } from "./log";
import { encryptPassword } from "./features/auth/utils";

export const createAdmin = async () => {
  const checkAdmin = `
    SELECT COUNT(*) as count
    FROM users
    WHERE is_admin = 1;
  `;

  const { result } = await executeQuery(checkAdmin, [], serverManagerPool);

  const [{ count }] = result;

  if (count === 0) {
    logger.info(
      "No hay administradores en la base de datos, creando uno nuevo",
      {
        filename: "init.ts",
        func: "createAdmin",
      }
    );

    const createAdmin = `
      INSERT INTO users (id, username, password, is_admin, status)
      VALUES (?, ?, ?, 1, 'ACTIVE');
    `;
    const { discordId, username, password } = generalConfig.admin;
    const hashedPassword = await encryptPassword(password as string);

    const values = [discordId, username, hashedPassword];
    await executeQuery(createAdmin, values, serverManagerPool);

    logger.info("Administrador creado exitosamente", {
      filename: "init.ts",
      func: "createAdmin",
    });
  }
};
