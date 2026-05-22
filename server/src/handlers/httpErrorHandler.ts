import type { NextFunction, Request, Response } from "express";

interface HttpError extends Error {
  statusCode?: number;
}

export const httpErrorHandler = (
  err: HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const status = err.statusCode ?? 500;
  const message = err.message || "Internal server error";

  res.status(status).json({
    statusCode: status,
    message
  });
};
