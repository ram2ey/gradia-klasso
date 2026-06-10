import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db, withSchoolContext } from "../db";
import { SchoolRepository } from "../repositories/school.repository";
import { UserRepository } from "../repositories/user.repository";
import { SessionRepository } from "../repositories/session.repository";
import { UserRole } from "../db/schema";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_sign_key_change_in_production";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "super_secret_jwt_refresh_key_change_in_production";

const schoolRepo = new SchoolRepository();
const userRepo = new UserRepository();
const sessionRepo = new SessionRepository();

export interface OnboardSchoolInput {
  schoolName: string;
  subdomain: string;
  emisSchoolCode?: string;
  region?: string;
  district?: string;
  circuit?: string;
  address?: string;
  phone?: string;
  email?: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
}

export class AuthService {
  /**
   * Hashes a raw refresh token using SHA-256 for secure database storage and fast lookup.
   */
  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Register a new school tenant alongside its primary Headteacher user.
   */
  async onboardSchool(input: OnboardSchoolInput) {
    return db.transaction(async (tx) => {
      // 1. Check if subdomain already exists
      const existingSchool = await schoolRepo.findBySubdomain(input.subdomain, tx);
      if (existingSchool) {
        throw new Error("Subdomain already in use");
      }

      if (input.emisSchoolCode) {
        const existingEmis = await schoolRepo.findByEmisCode(input.emisSchoolCode, tx);
        if (existingEmis) {
          throw new Error("EMIS School Code already registered");
        }
      }

      // 2. Create the school
      const school = await schoolRepo.create({
        name: input.schoolName,
        subdomain: input.subdomain,
        emisSchoolCode: input.emisSchoolCode,
        region: input.region,
        district: input.district,
        circuit: input.circuit,
        address: input.address,
        phone: input.phone,
        email: input.email,
      }, tx);

      // Set the school context in session for RLS prior to user creation
      await tx.execute(sql`SELECT set_config('app.current_school_id', ${school.id}, true)`);

      // 3. Hash the headteacher's password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(input.passwordHash, salt);

      // 4. Create the headteacher user
      const headteacher = await userRepo.create({
        schoolId: school.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email || "",
        passwordHash: hashedPassword,
        role: "headteacher",
        isActive: true,
      }, tx);

      return {
        school,
        user: {
          id: headteacher.id,
          firstName: headteacher.firstName,
          lastName: headteacher.lastName,
          email: headteacher.email,
          role: headteacher.role,
        },
      };
    });
  }

  /**
   * Authenticates user and returns access_token (15m) + refresh_token (30d).
   * Locates the school using either a subdomain or EMIS school code.
   */
  async login(email: string, passwordHash: string, schoolLocator: string) {
    // 1. Find school by subdomain or EMIS school code
    let school = await schoolRepo.findBySubdomain(schoolLocator);
    if (!school) {
      school = await schoolRepo.findByEmisCode(schoolLocator);
    }

    if (!school) {
      throw new Error("School not found under the provided domain or EMIS code");
    }

    // 2. Find user in that school context, wrapped in school context to satisfy users RLS policy
    const user = await withSchoolContext(school.id, async (tx) => {
      return userRepo.findByEmailAndSchool(email, school.id, tx);
    });

    if (!user || !user.isActive) {
      throw new Error("Invalid credentials or user account is suspended");
    }

    // 3. Verify password
    const isPasswordMatch = await bcrypt.compare(passwordHash, user.passwordHash);
    if (!isPasswordMatch) {
      throw new Error("Invalid credentials");
    }

    // 4. Generate JWT tokens
    const accessToken = jwt.sign(
      {
        userId: user.id,
        schoolId: school.id,
        role: user.role,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: "15m" } // 15-minute access token
    );

    const refreshToken = jwt.sign(
      {
        userId: user.id,
        schoolId: school.id,
      },
      JWT_REFRESH_SECRET,
      { expiresIn: "30d" } // 30-day refresh token
    );

    // 5. Store session refresh token hash in DB under RLS context
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days out

    await withSchoolContext(school.id, async (tx) => {
      await sessionRepo.create({
        userId: user.id,
        schoolId: school.id,
        refreshTokenHash: tokenHash,
        expiresAt,
      }, tx);
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
      school: {
        id: school.id,
        name: school.name,
        subdomain: school.subdomain,
      },
    };
  }

  /**
   * Dynamic Refresh Token Rotation (RTR).
   * Verifies old refresh token, revokes old session, creates new pair.
   */
  async refresh(token: string) {
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_REFRESH_SECRET);
    } catch (err) {
      throw new Error("Invalid or expired refresh token");
    }

    const { userId, schoolId } = payload;
    const oldTokenHash = this.hashToken(token);

    return withSchoolContext(schoolId, async (tx) => {
      // 1. Fetch active session record
      const session = await sessionRepo.findByTokenHash(oldTokenHash, tx);
      if (!session || new Date() > session.expiresAt) {
        if (session) {
          await sessionRepo.delete(session.id, tx);
        }
        throw new Error("Refresh token has expired or is revoked");
      }

      // 2. Fetch active user
      const user = await userRepo.findById(userId, tx);
      if (!user || !user.isActive) {
        throw new Error("User context is disabled or not found");
      }

      // 3. Delete old session (used token invalidation)
      await sessionRepo.delete(session.id, tx);

      // 4. Generate new pair
      const newAccessToken = jwt.sign(
        {
          userId: user.id,
          schoolId: schoolId,
          role: user.role,
          email: user.email,
        },
        JWT_SECRET,
        { expiresIn: "15m" }
      );

      const newRefreshToken = jwt.sign(
        {
          userId: user.id,
          schoolId: schoolId,
        },
        JWT_REFRESH_SECRET,
        { expiresIn: "30d" }
      );

      // 5. Save new session hash
      const newTokenHash = this.hashToken(newRefreshToken);
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 30);

      await sessionRepo.create({
        userId: user.id,
        schoolId: schoolId,
        refreshTokenHash: newTokenHash,
        expiresAt: newExpiresAt,
      }, tx);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        },
      };
    });
  }

  /**
   * Invalidates refresh token session to log user out.
   */
  async logout(token: string) {
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_REFRESH_SECRET);
    } catch (err) {
      // If token is malformed, we can attempt to decode it directly without verifying signature
      payload = jwt.decode(token);
    }

    if (!payload || !payload.schoolId) {
      throw new Error("Invalid token format for logout");
    }

    const tokenHash = this.hashToken(token);

    // Run delete inside the tenant RLS context
    await withSchoolContext(payload.schoolId, async (tx) => {
      await sessionRepo.deleteByTokenHash(tokenHash, tx);
    });
  }

  /**
   * Fetches active user context profile under the tenant.
   */
  async me(userId: string, schoolId: string) {
    return withSchoolContext(schoolId, async (tx) => {
      const user = await userRepo.findById(userId, tx);
      if (!user || !user.isActive) {
        throw new Error("User profile not found");
      }

      const school = await schoolRepo.findById(schoolId, tx);

      return {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
        school,
      };
    });
  }
}
