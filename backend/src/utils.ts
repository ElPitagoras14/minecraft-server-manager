import fs from "fs/promises";

export const deleteFile = async (filePath: string): Promise<void> => {
  try {
    await fs.rm(filePath, { force: true });
    console.log(`File deleted: ${filePath}`);
  } catch (err: any) {
    console.error(`Error while deleting ${err.message}`);
  }
};

export const convertBytes = (
  bytes: number,
  unit?: "B" | "KB" | "MB" | "GB" | "TB"
): string => {
  if (bytes < 0) throw new Error("El valor de bytes no puede ser negativo.");

  const units = ["B", "KB", "MB", "GB", "TB"];
  const factor = 1024;

  if (unit) {
    const index = units.indexOf(unit);
    if (index === -1)
      throw new Error(`Unidad no válida. Usa: ${units.join(", ")}`);
    return `${(bytes / Math.pow(factor, index)).toFixed(2)} ${unit}`;
  }

  let index = 0;
  while (bytes >= factor && index < units.length - 1) {
    bytes /= factor;
    index++;
  }

  return `${bytes.toFixed(2)} ${units[index]}`;
};
