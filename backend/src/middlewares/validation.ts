import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";
import { sendError } from "../utils/response";

/**
 * Middleware factory to validate Express request inputs using Zod.
 * Validates request body, query parameter, and route parameters.
 */
export function validateRequest(schemas: {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
        return sendError(res, `Validation failed: ${issues}`, 400);
      }
      return sendError(res, "Invalid request payload", 400);
    }
  };
}
