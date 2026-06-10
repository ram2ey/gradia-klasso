import { Request, Response } from "express";
import { z } from "zod";
import { AuthService } from "../services/auth.service";
import { sendSuccess, sendError } from "../utils/response";
import { AuthenticatedRequest } from "../types";

const authService = new AuthService();

// Zod schemas for input validation
export const onboardSchoolSchema = z.object({
  schoolName: z.string().min(2, "School name must be at least 2 characters"),
  subdomain: z
    .string()
    .min(2, "Subdomain must be at least 2 characters")
    .regex(/^[a-z0-9-]+$/, "Subdomain can only contain lowercase letters, numbers, and hyphens"),
  emisSchoolCode: z.string().optional(),
  region: z.string().optional(),
  district: z.string().optional(),
  circuit: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid school email address").optional().or(z.literal("")),
  firstName: z.string().min(2, "Headteacher first name must be at least 2 characters"),
  lastName: z.string().min(2, "Headteacher last name must be at least 2 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  schoolLocator: z.string().min(2, "School subdomain or EMIS school code is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export class AuthController {
  /**
   * Route handler for school onboarding.
   */
  async onboard(req: Request, res: Response) {
    try {
      const parsed = onboardSchoolSchema.parse(req.body);
      const result = await authService.onboardSchool({
        schoolName: parsed.schoolName,
        subdomain: parsed.subdomain,
        emisSchoolCode: parsed.emisSchoolCode || undefined,
        region: parsed.region || undefined,
        district: parsed.district || undefined,
        circuit: parsed.circuit || undefined,
        address: parsed.address || undefined,
        phone: parsed.phone || undefined,
        email: parsed.email || undefined,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        passwordHash: parsed.password,
      });
      return sendSuccess(res, result, 201);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to onboard school", 400);
    }
  }

  /**
   * Route handler for user login.
   * Returns access_token (15m) + refresh_token (30d).
   */
  async login(req: Request, res: Response) {
    try {
      const { email, password, schoolLocator } = req.body;
      const result = await authService.login(email, password, schoolLocator);
      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Authentication failed", 401);
    }
  }

  /**
   * Route handler to rotate the refresh token.
   */
  async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refresh(refreshToken);
      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Token refresh failed", 401);
    }
  }

  /**
   * Route handler for user logout.
   */
  async logout(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return sendError(res, "Refresh token is required for logout", 400);
      }
      await authService.logout(refreshToken);
      return sendSuccess(res, { message: "Logged out successfully" }, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Logout failed", 400);
    }
  }

  /**
   * Route handler to get current user details.
   */
  async me(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized context", 401);
      }
      const result = await authService.me(req.user.userId, req.user.schoolId);
      return sendSuccess(res, result, 200);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to fetch user profile", 400);
    }
  }
}
