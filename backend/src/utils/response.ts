import { Response } from "express";

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: any;
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200, meta?: any): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta,
  };
  return res.status(statusCode).json(response);
}

export function sendError(res: Response, errorMessage: string, statusCode = 400, meta?: any): Response {
  const response: ApiResponse = {
    success: false,
    error: errorMessage,
    meta,
  };
  return res.status(statusCode).json(response);
}
