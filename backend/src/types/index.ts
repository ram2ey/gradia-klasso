import { Request } from "express";
import { UserRole } from "../db/schema";

export interface TokenPayload {
  userId: string;
  schoolId: string;
  role: UserRole;
  email: string;
}

// Custom request interface extending standard Express Request
export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}
