import winston from "winston";
const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ timestamp, level, message, ...meta }) => {
  const { filename, func, extra = {} } = meta;
  return `${timestamp} | ${level} | ${filename}:${func} | ${message} | ${JSON.stringify(
    extra
  )}`;
});

export const logger = winston.createLogger({
  level: "debug",
  format: combine(
    colorize(),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    logFormat
  ),
  transports: [new winston.transports.Console()],
});
