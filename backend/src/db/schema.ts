import { pgTable, uuid, varchar, timestamp, text, unique, boolean, pgEnum, integer, date, decimal, time } from "drizzle-orm/pg-core";

// Define the role enum for PostgreSQL
export const roleEnum = pgEnum("user_role", [
  "headteacher",
  "class_teacher",
  "bursar",
  "parent",
  "student",
]);

export type UserRole = "headteacher" | "class_teacher" | "bursar" | "parent" | "student";

// Schools: Represents the school tenant
export const schools = pgTable("schools", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  subdomain: varchar("subdomain", { length: 100 }).unique(),
  emisSchoolCode: varchar("emis_school_code", { length: 100 }).unique(),
  region: varchar("region", { length: 100 }),
  district: varchar("district", { length: 100 }),
  circuit: varchar("circuit", { length: 100 }),
  address: text("address"),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  logoUrl: varchar("logo_url", { length: 1024 }),
  headteacherSignatureUrl: varchar("headteacher_signature_url", { length: 1024 }),
  schoolStampUrl: varchar("school_stamp_url", { length: 1024 }),
  subscriptionPlan: varchar("subscription_plan", { length: 50 }).default("free").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Users: Represents accounts registered under a school tenant
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Email is unique within each school context
    emailSchoolUnique: unique().on(table.email, table.schoolId),
  })
);

// Sessions: Track user refresh tokens for rotation
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  refreshTokenHash: text("refresh_token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Academic Years: Tracks academic periods (e.g. Sep - Jul, split into 3 terms)
export const academicYears = pgTable("academic_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 50 }).notNull(), // e.g., "2024/2025"
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isCurrent: boolean("is_current").default(false).notNull(),
});

// Classes: School Grade Levels & streams (Basic 1-9)
export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Basic 3B"
  level: integer("level").notNull(), // 1-9 (Ghana Basic 1 to 9 / JHS 3)
  academicYearId: uuid("academic_year_id")
    .notNull()
    .references(() => academicYears.id, { onDelete: "cascade" }),
  classTeacherId: uuid("class_teacher_id")
    .references(() => users.id, { onDelete: "set null" }),
  capacity: integer("capacity").default(40).notNull(),
});

// Students: Demographic records
export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  emisNumber: varchar("emis_number", { length: 100 }).unique(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  middleName: varchar("middle_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  dateOfBirth: timestamp("date_of_birth").notNull(),
  gender: varchar("gender", { length: 20 }).notNull(), // e.g., Male / Female
  photoUrl: varchar("photo_url", { length: 1024 }),
  guardianName: varchar("guardian_name", { length: 255 }).notNull(),
  guardianPhone: varchar("guardian_phone", { length: 50 }).notNull(),
  guardianEmail: varchar("guardian_email", { length: 255 }),
  guardianRelationship: varchar("guardian_relationship", { length: 100 }).notNull(),
  homeAddress: text("home_address").notNull(),
  previousSchool: text("previous_school"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Enrolment Status Enum
export const enrolmentStatusEnum = pgEnum("enrolment_status", [
  "active",
  "withdrawn",
  "graduated",
]);

export type EnrolmentStatus = "active" | "withdrawn" | "graduated";

// Enrolments: Links student placements with classes for an academic year
export const enrolments = pgTable("enrolments", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id")
    .notNull()
    .references(() => academicYears.id, { onDelete: "cascade" }),
  status: enrolmentStatusEnum("status").default("active").notNull(),
  enrolmentDate: timestamp("enrolment_date").defaultNow().notNull(),
});

// Attendance Sessions & Statuses
export const attendanceSessionEnum = pgEnum("attendance_session", ["morning", "afternoon"]);
export const attendanceStatusEnum = pgEnum("attendance_status", ["present", "absent", "late", "excused"]);

export type AttendanceSession = "morning" | "afternoon";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

// Attendance Records: Enforces one status per student per session per date
export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    date: date("date").notNull(), // stored as YYYY-MM-DD
    session: attendanceSessionEnum("session").notNull(),
    status: attendanceStatusEnum("status").notNull(),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // Composite unique key for idempotent upserts and preventing double marks
    studentDateSessionUnique: unique().on(table.schoolId, table.studentId, table.date, table.session),
  })
);
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;

// Subjects Table
export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 100 }).notNull(),
  classLevels: integer("class_levels").array().notNull(), // e.g. [1, 2, 3] representing level grade streams
  isActive: boolean("is_active").default(true).notNull(),
});

export type Subject = typeof subjects.$inferSelect;

// Assessment Scores Table
export const assessmentScores = pgTable(
  "assessment_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    term: integer("term").notNull(), // 1, 2, or 3
    classScore: decimal("class_score", { precision: 5, scale: 2 }).notNull(),
    examScore: decimal("exam_score", { precision: 5, scale: 2 }).notNull(),
    total: decimal("total", { precision: 5, scale: 2 }).notNull(), // calculated by triggers
    grade: varchar("grade", { length: 2 }).notNull(), // calculated by triggers
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    studentSubjectTermUnique: unique().on(table.schoolId, table.studentId, table.subjectId, table.academicYearId, table.term),
  })
);

export type AssessmentScore = typeof assessmentScores.$inferSelect;

// Report Cards Table
export const reportCards = pgTable(
  "report_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    term: integer("term").notNull(),
    classPosition: integer("class_position"),
    aggregate: integer("aggregate"),
    promoted: boolean("promoted"),
    teacherRemarks: text("teacher_remarks"),
    headRemarks: text("head_remarks"),
    nextTermBegins: date("next_term_begins"),
    publishedAt: timestamp("published_at"),
    pdfUrl: varchar("pdf_url", { length: 1024 }),
    status: varchar("status", { length: 50 }).default("pending").notNull(), // 'pending', 'generating', 'completed', 'failed'
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    studentTermUnique: unique().on(table.schoolId, table.studentId, table.academicYearId, table.term),
  })
);

export type ReportCard = typeof reportCards.$inferSelect;

// Enums for Fee Payments
export const paymentMethodEnum = pgEnum("payment_method", ["momo", "cash", "bank"]);
export const momoNetworkEnum = pgEnum("momo_network", ["mtn", "telecel", "airteltigo"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "success", "failed"]);

export type PaymentMethod = "momo" | "cash" | "bank";
export type MomoNetwork = "mtn" | "telecel" | "airteltigo";
export type PaymentStatus = "pending" | "success" | "failed";

// Fee Structures Table: Defines fee template rules
export const feeStructures = pgTable("fee_structures", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id")
    .notNull()
    .references(() => academicYears.id, { onDelete: "cascade" }),
  term: integer("term").notNull(), // 1, 2, or 3
  classLevel: integer("class_level").notNull(), // 1-9 representing class grade stream level
  label: varchar("label", { length: 255 }).notNull(), // e.g. "Basic 1-3 Term 1 Fees"
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: date("due_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FeeStructure = typeof feeStructures.$inferSelect;

// Fee Assignments Table: Links fee structures to individual students
export const feeAssignments = pgTable(
  "fee_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    feeStructureId: uuid("fee_structure_id")
      .notNull()
      .references(() => feeStructures.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    term: integer("term").notNull(),
    amountDue: decimal("amount_due", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    studentFeeUnique: unique().on(table.schoolId, table.studentId, table.feeStructureId),
  })
);

export type FeeAssignment = typeof feeAssignments.$inferSelect;

// Payments Table: Records individual cash, bank, or MoMo payments
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  feeAssignmentId: uuid("fee_assignment_id")
    .notNull()
    .references(() => feeAssignments.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  momoNetwork: momoNetworkEnum("momo_network"),
  momoPhone: varchar("momo_phone", { length: 50 }),
  hubtelReference: varchar("hubtel_reference", { length: 255 }),
  status: paymentStatusEnum("status").default("pending").notNull(),
  paidAt: timestamp("paid_at"),
  recordedBy: uuid("recorded_by").references(() => users.id),
  receiptNumber: varchar("receipt_number", { length: 255 }).unique().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;

// Notification Enums
export const notificationTypeEnum = pgEnum("notification_type", [
  "fee_reminder",
  "attendance_alert",
  "result_published",
  "announcement",
  "general",
]);
export type NotificationType = "fee_reminder" | "attendance_alert" | "result_published" | "announcement" | "general";

export const notificationChannelEnum = pgEnum("notification_channel", ["sms", "whatsapp", "in_app"]);
export type NotificationChannel = "sms" | "whatsapp" | "in_app";

export const notificationJobStatusEnum = pgEnum("notification_job_status", ["queued", "sent", "failed"]);
export type NotificationJobStatus = "queued" | "sent" | "failed";

// Notifications: In-app notification records shown in the bell icon
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  recipientUserId: uuid("recipient_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  type: notificationTypeEnum("type").default("general").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;

// Notification Jobs: Delivery log for SMS, WhatsApp, and in-app dispatch tracking
export const notificationJobs = pgTable("notification_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  channel: notificationChannelEnum("channel").notNull(),
  recipientPhone: varchar("recipient_phone", { length: 50 }),
  recipientUserId: uuid("recipient_user_id")
    .references(() => users.id, { onDelete: "set null" }),
  message: text("message").notNull(),
  status: notificationJobStatusEnum("status").default("queued").notNull(),
  sentAt: timestamp("sent_at"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type NotificationJob = typeof notificationJobs.$inferSelect;

// Periods: school daily timetable slots (lessons, breaks)
export const periods = pgTable("periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  isBreak: boolean("is_break").default(false).notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export type Period = typeof periods.$inferSelect;

// Timetable Entries: links a class, subject, teacher, period, day of week and term
export const timetableEntries = pgTable(
  "timetable_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id")
      .references(() => users.id, { onDelete: "set null" }),
    dayOfWeek: integer("day_of_week").notNull(), // 1 = Monday ... 5 = Friday
    periodId: uuid("period_id")
      .notNull()
      .references(() => periods.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
  },
  (table) => ({
    classPeriodUnique: unique().on(table.classId, table.dayOfWeek, table.periodId, table.academicYearId),
    teacherPeriodUnique: unique().on(table.teacherId, table.dayOfWeek, table.periodId, table.academicYearId),
  })
);

export type TimetableEntry = typeof timetableEntries.$inferSelect;

