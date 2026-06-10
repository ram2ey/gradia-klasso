import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import authRouter from "./routes/auth.routes";
import studentRouter from "./routes/student.routes";
import classRouter from "./routes/class.routes";
import attendanceRouter from "./routes/attendance.routes";
import subjectRouter from "./routes/subject.routes";
import scoreRouter from "./routes/score.routes";
import reportCardRouter from "./routes/report-card.routes";
import feeRouter from "./routes/fee.routes";
import webhookRouter from "./routes/webhook.routes";
import notificationRouter from "./routes/notification.routes";
import timetableRouter from "./routes/timetable.routes";
import { sendError } from "./utils/response";
import { initScheduler } from "./services/scheduler";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: "*", // Adjust in production to match client hosts
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

// Serve uploads folder static resources
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

// Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/students", studentRouter);
app.use("/api/v1/classes", classRouter);
app.use("/api/v1/attendance", attendanceRouter);
app.use("/api/v1/subjects", subjectRouter);
app.use("/api/v1/scores", scoreRouter);
app.use("/api/v1/report-cards", reportCardRouter);
app.use("/api/v1/fees", feeRouter);
app.use("/api/v1/webhooks", webhookRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/timetable", timetableRouter);

// Base health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Fallback 404 handler
app.use((req: Request, res: Response) => {
  return sendError(res, "Endpoint not found", 404);
});

// Central Error Handling Middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled Server Error:", err);
  return sendError(res, "Internal server error occurred", 500);
});

// Start Server
app.listen(PORT, () => {
  console.log(`[server]: Gradia Klasso SMS backend is running at http://localhost:${PORT}`);

  // Initialize BullMQ scheduler for automated notification jobs
  initScheduler().catch((err) => {
    console.error("[server]: Scheduler initialization failed:", err);
  });
});
