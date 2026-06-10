import { openDB } from "idb";
import type { DBSchema, IDBPDatabase } from "idb";
import axiosInstance from "../services/axiosInstance";

export interface PendingAttendance {
  id: string; // unique queue ID
  classId: string;
  date: string;
  session: "morning" | "afternoon";
  records: {
    studentId: string;
    status: "present" | "absent" | "late" | "excused";
    note?: string;
  }[];
  timestamp: number;
}

export interface PendingWrite {
  id: string;
  url: string;
  method: string;
  body: any;
  timestamp: number;
  retries: number;
}

export interface ScoreDraft {
  id: string; // `${classId}-${subjectId}-${term}`
  classId: string;
  subjectId: string;
  term: number;
  scores: Record<string, { classScore: string; examScore: string }>;
  timestamp: number;
}

interface GradiaSchema extends DBSchema {
  "attendance-queue": {
    key: string;
    value: PendingAttendance;
  };
  "offline-queue": {
    key: string;
    value: PendingWrite;
  };
  "score-drafts": {
    key: string;
    value: ScoreDraft;
  };
}

const DB_NAME = "gradia-offline-db";
const DB_VERSION = 2; // Upgraded from v1 to support PWA queue & score drafts

let dbPromise: Promise<IDBPDatabase<GradiaSchema>> | null = null;

export function initDb() {
  if (!dbPromise) {
    dbPromise = openDB<GradiaSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore("attendance-queue", { keyPath: "id" });
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains("offline-queue")) {
            db.createObjectStore("offline-queue", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("score-drafts")) {
            db.createObjectStore("score-drafts", { keyPath: "id" });
          }
        }
      },
    });
  }
  return dbPromise;
}

/* ==========================================================================
   OFFLINE WRITES QUEUE ('offline-queue')
   ========================================================================== */

/**
 * Gets all pending mutating writes in the queue.
 */
export async function getOfflineQueue(): Promise<PendingWrite[]> {
  const db = await initDb();
  return db.getAll("offline-queue");
}

/**
 * Deletes a synced write request from the queue and fires a change event.
 */
export async function removeOfflineQueueItem(id: string): Promise<void> {
  const db = await initDb();
  await db.delete("offline-queue", id);
  await notifyQueueCountChange();
}

/**
 * Helper to dispatch event with the current count of items in the offline queue.
 */
export async function notifyQueueCountChange() {
  const queue = await getOfflineQueue();
  window.dispatchEvent(
    new CustomEvent("gradia-offline-queue-changed", {
      detail: { count: queue.length },
    })
  );
}

/**
 * Iterates through all failed offline writes and attempts to replay them via axiosInstance.
 * Automatically rotates access tokens if required and deletes items from queue on success.
 */
export async function flushOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (!navigator.onLine) {
    console.log("[OfflineDB]: Replay abort: client is offline.");
    return { synced: 0, failed: 0 };
  }

  const db = await initDb();
  const queue = await getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  console.log(`[OfflineDB]: Synchronizing ${queue.length} write requests from offline queue...`);
  
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const response = await axiosInstance({
        url: item.url,
        method: item.method,
        data: item.body,
      });

      // Check if response contains API success wrapper
      if (response.status >= 200 && response.status < 300 && response.data?.success !== false) {
        await db.delete("offline-queue", item.id);
        synced++;
        console.log(`[OfflineDB]: Successfully flushed queued write: ${item.method} ${item.url}`);
      } else {
        // Increment retries
        item.retries += 1;
        if (item.retries >= 3) {
          // Permanently discard items that fail repeatedly to avoid blocking the queue (e.g., dead locks/validations)
          await db.delete("offline-queue", item.id);
          failed++;
          console.error(`[OfflineDB]: Discarding item ${item.id} after 3 failed retries. Error:`, response.data?.error);
        } else {
          await db.put("offline-queue", item);
        }
      }
    } catch (err: any) {
      // If it's a client authentication/validation error (4xx), delete it (retrying won't help)
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        await db.delete("offline-queue", item.id);
        failed++;
        console.error(`[OfflineDB]: Discarding bad offline request ${item.id} (status ${err.response.status})`);
      } else {
        // Network or 5xx server errors get retried
        item.retries += 1;
        if (item.retries >= 3) {
          await db.delete("offline-queue", item.id);
          failed++;
        } else {
          await db.put("offline-queue", item);
        }
        console.warn(`[OfflineDB]: Network transient error for queued request: ${item.method} ${item.url}`, err);
      }
    }
  }

  await notifyQueueCountChange();
  return { synced, failed };
}

/* ==========================================================================
   SCORE DRAFTS MANAGEMENT ('score-drafts')
   ========================================================================== */

/**
 * Save an offline gradebook scores sheet as a local draft.
 */
export async function saveScoreDraft(
  classId: string,
  subjectId: string,
  term: number,
  scores: ScoreDraft["scores"]
): Promise<void> {
  const db = await initDb();
  const id = `${classId}-${subjectId}-${term}`;
  
  await db.put("score-drafts", {
    id,
    classId,
    subjectId,
    term,
    scores,
    timestamp: Date.now(),
  });
  console.log(`[OfflineDB]: Saved gradebook scores sheet draft for subject ${subjectId}`);
}

/**
 * Fetch a saved local scores sheet draft.
 */
export async function getScoreDraft(
  classId: string,
  subjectId: string,
  term: number
): Promise<ScoreDraft | undefined> {
  const db = await initDb();
  const id = `${classId}-${subjectId}-${term}`;
  return db.get("score-drafts", id);
}

/**
 * Delete a local draft sheet once synchronized.
 */
export async function removeScoreDraft(
  classId: string,
  subjectId: string,
  term: number
): Promise<void> {
  const db = await initDb();
  const id = `${classId}-${subjectId}-${term}`;
  await db.delete("score-drafts", id);
  console.log(`[OfflineDB]: Removed local draft ${id}`);
}

/* ==========================================================================
   LEGACY METHODS (For backward compatibility / attendance backup)
   ========================================================================== */

export async function addPendingAttendance(
  classId: string,
  date: string,
  session: "morning" | "afternoon",
  records: PendingAttendance["records"]
): Promise<string> {
  const db = await initDb();
  const queueId = `${Date.now()}-${classId}-${session}`;
  const payload: PendingAttendance = {
    id: queueId,
    classId,
    date,
    session,
    records,
    timestamp: Date.now(),
  };
  await db.put("attendance-queue", payload);
  return queueId;
}

export async function getPendingAttendance(): Promise<PendingAttendance[]> {
  const db = await initDb();
  return db.getAll("attendance-queue");
}

export async function removePendingAttendance(id: string): Promise<void> {
  const db = await initDb();
  await db.delete("attendance-queue", id);
}

export async function flushPendingAttendance(): Promise<number> {
  const pendingList = await getPendingAttendance();
  if (pendingList.length === 0) return 0;
  let syncedCount = 0;
  for (const item of pendingList) {
    try {
      const res = await axiosInstance.post("/attendance/bulk", {
        classId: item.classId,
        date: item.date,
        session: item.session,
        records: item.records,
        forceOverride: true,
      });
      if (res.data?.success) {
        await removePendingAttendance(item.id);
        syncedCount++;
      }
    } catch (err) {
      console.error(err);
    }
  }
  return syncedCount;
}
