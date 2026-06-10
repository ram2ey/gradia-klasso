import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest, TokenPayload } from "../types";
import { sendError } from "../utils/response";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_sign_key_change_in_production";

/**
 * Middleware: authenticateToken
 * Verifies the short-lived JWT access token in the Authorization header.
 * Attaches the claims (userId, schoolId, role) to req.user.
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, "Authorization token is missing or malformed", 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    req.user = decoded;
    next();
  } catch (error) {
    return sendError(res, "Invalid or expired access token", 401);
  }
}

/**
 * Middleware: requireRole
 * Restricts access to specific roles.
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, "Authentication required", 401);
    }
    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, "Access denied: Insufficient role permissions", 403);
    }
    next();
  };
}

/**
 * Middleware: verifyTenantParam
 * Verifies that the tenant ID passed in route parameters matches the user's token schoolId.
 */
export function verifyTenantParam(paramName = "schoolId") {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, "Authentication required", 401);
    }
    const paramVal = req.params[paramName];
    if (paramVal && paramVal !== req.user.schoolId) {
      return sendError(res, "Tenant violation: Resource school ID does not match token context", 403);
    }
    next();
  };
}
