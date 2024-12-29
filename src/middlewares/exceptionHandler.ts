import { Request, Response, NextFunction } from "express";
import { HttpException } from "../utils/httpException";

export const exceptionHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (err instanceof HttpException) {
    res.status(err.statusCode).json({
      status: "error",
      statusCode: err.statusCode,
      message: err.message,
    });
  } else {
    res.status(500).json({
      status: "error",
      statusCode: 500,
      message: err.message,
    });
  }
};
