import { executeQuery, serverManagerPool } from "./databases/clients";
import { generalConfig } from "./config";
import { logger } from "./log";
import { encryptPassword } from "./features/auth/utils";
import { getStatusContainer } from "./docker/client";

export const createAdmin = async () => {
  const checkAdmin = `
    SELECT COUNT(*) as count
    FROM users
    WHERE is_admin = 1;
  `;

  const { result } = await executeQuery(checkAdmin, [], serverManagerPool);

  const [{ count }] = result;

  if (count === 0) {
    logger.info("No admin user found, creating admin user", {
      filename: "init.ts",
      func: "createAdmin",
    });

    const createAdmin = `
      INSERT INTO users (id, username, password, is_admin, status)
      VALUES (?, ?, ?, 1, 'ACTIVE');
    `;
    const { discordId, username, password } = generalConfig.admin;
    const hashedPassword = await encryptPassword(password as string);

    const values = [discordId, username, hashedPassword];
    await executeQuery(createAdmin, values, serverManagerPool);

    logger.info("Admin user created successfully", {
      filename: "init.ts",
      func: "createAdmin",
    });
  }
};

export const checkAllServerStatus = async () => {
  const serversSql = `
    SELECT
      s.id,
      s.container_id as containerId
    FROM servers s
    WHERE s.status <> 'DELETED';
  `;

  const { result } = await executeQuery(serversSql, [], serverManagerPool);

  const allPromises = result.map(
    async ({ id, containerId }: { id: number; containerId: string }) => {
      try {
        const { Running } = await getStatusContainer(containerId);
        const status = Running ? "RUNNING" : "STOPPED";
        const updateStatusSql = `
        UPDATE servers
        SET status = ?
        WHERE id = ?;
      `;
        await executeQuery(updateStatusSql, [status, id], serverManagerPool);
      } catch (error: unknown) {
        logger.error("Error checking server status", {
          filename: "init.ts",
          func: "checkAllServerStatus",
          extra: { error },
        });
      }
    }
  );

  await Promise.all(allPromises);
};
