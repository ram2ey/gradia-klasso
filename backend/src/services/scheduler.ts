import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { NotificationService } from "./notification.service";
import { SmsService } from "./sms.service";
import { WhatsAppService } from "./whatsapp.service";
import { db } from "../db";
import { schools } from "../db/schema";

const notificationService = new NotificationService();
const smsService = new SmsService();
const whatsAppService = new WhatsAppService();

let connection: IORedis | null = null;
let notificationQueue: Queue | null = null;

/**
 * Initializes the BullMQ scheduler and worker.
 * If REDIS_URL is not configured, enters degraded mode and skips scheduling.
 */
export async function initScheduler() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn(
      "[Scheduler] REDIS_URL is not configured. Running in DEGRADED MODE — scheduled jobs (attendance alerts, fee reminders) will NOT run automatically. Configure Redis for full functionality."
    );
    return;
  }

  try {
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    connection.on("error", (err) => {
      console.error("[Scheduler] Redis connection error:", err.message);
    });

    // Test connection
    await connection.ping();
    console.log("[Scheduler] Redis connection established.");

    notificationQueue = new Queue("gradia-notifications", { connection: connection as any });

    // Register repeatable schedules
    // Daily 8 AM weekdays — attendance alerts
    await notificationQueue.add(
      "attendance_alert",
      {},
      {
        repeat: {
          pattern: "0 8 * * 1-5", // Mon-Fri at 8:00 AM
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );
    console.log("[Scheduler] Registered: attendance_alert (weekdays 8 AM)");

    // Weekly Monday 8 AM — fee reminders
    await notificationQueue.add(
      "fee_reminder",
      {},
      {
        repeat: {
          pattern: "0 8 * * 1", // Monday at 8:00 AM
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );
    console.log("[Scheduler] Registered: fee_reminder (Monday 8 AM)");

    // Start the worker
    const worker = new Worker(
      "gradia-notifications",
      async (job) => {
        console.log(`[Scheduler Worker] Processing job: ${job.name} (${job.id})`);

        try {
          // Get all active schools
          const allSchools = await db.select({ id: schools.id }).from(schools);

          for (const school of allSchools) {
            try {
              if (job.name === "attendance_alert") {
                await notificationService.sendAttendanceAlerts(school.id);
              } else if (job.name === "fee_reminder") {
                await notificationService.sendFeeReminders(school.id);
              } else if (job.name === "sms_dispatch") {
                const { phone, message } = job.data;
                if (phone && message) {
                  await smsService.sendSms(phone, message);
                }
              } else if (job.name === "whatsapp_dispatch") {
                const { phone, message } = job.data;
                if (phone && message) {
                  await whatsAppService.sendMessage(phone, message);
                }
              }
            } catch (schoolErr) {
              console.error(`[Scheduler Worker] Error processing ${job.name} for school ${school.id}:`, schoolErr);
            }
          }
        } catch (err) {
          console.error(`[Scheduler Worker] Fatal error in job ${job.name}:`, err);
          throw err;
        }
      },
      { connection: connection as any }
    );

    worker.on("completed", (job) => {
      console.log(`[Scheduler Worker] Job completed: ${job?.name} (${job?.id})`);
    });

    worker.on("failed", (job, err) => {
      console.error(`[Scheduler Worker] Job failed: ${job?.name} (${job?.id})`, err.message);
    });

    console.log("[Scheduler] Worker started and listening for jobs.");
  } catch (err: any) {
    console.error("[Scheduler] Failed to initialize Redis/BullMQ:", err.message);
    console.warn("[Scheduler] Continuing in DEGRADED MODE without scheduled jobs.");
    connection = null;
    notificationQueue = null;
  }
}

/**
 * Adds a one-off job to the queue.
 * Returns false if the queue is not available (degraded mode).
 */
export async function enqueueJob(
  name: string,
  data: Record<string, any>,
  opts: any = {}
): Promise<boolean> {
  if (!notificationQueue) {
    console.warn(`[Scheduler] Cannot enqueue job '${name}': queue not available (degraded mode).`);
    return false;
  }

  await notificationQueue.add(name, data, {
    removeOnComplete: 100,
    removeOnFail: 50,
    ...opts,
  });
  return true;
}
