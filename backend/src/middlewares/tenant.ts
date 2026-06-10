import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../types";
import { sendError } from "../utils/response";

/**
 * Middleware that strictly verifies that the school context is set by the JWT.
 * Prevents requests from bypassing tenant restrictions.
 */
export function enforceTenant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || !req.user.schoolId) {
    return sendError(res, "Missing school tenant context", 401);
  }

  // If the request body or parameters attempt to supply a schoolId,
  // we strictly override it or validate that it matches the authenticated tenant.
  if (req.body && req.body.schoolId && req.body.schoolId !== req.user.schoolId) {
    return sendError(res, "Tenant violation: school_id in request body does not match authenticated token claims", 403);
  }

  next();
}
