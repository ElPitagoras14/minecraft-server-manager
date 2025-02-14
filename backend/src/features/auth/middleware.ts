import { Request, Response, NextFunction } from "express";
import { verifyToken } from "./utils";

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    const response = {
      message: "Not authorized",
    };
    res.status(401).json(response);
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    const response = {
      message: "Not authorized",
    };
    res.status(401).json(response);
    return;
  }
};
