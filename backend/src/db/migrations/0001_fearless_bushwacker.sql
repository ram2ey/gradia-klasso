DO $$ BEGIN
 CREATE TYPE "public"."enrolment_status" AS ENUM('active', 'withdrawn', 'graduated');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "academic_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"label" varchar(50) NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"level" integer NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"class_teacher_id" uuid,
	"capacity" integer DEFAULT 40 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enrolments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"status" "enrolment_status" DEFAULT 'active' NOT NULL,
	"enrolment_date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"emis_number" varchar(100),
	"first_name" varchar(100) NOT NULL,
	"middle_name" varchar(100),
	"last_name" varchar(100) NOT NULL,
	"date_of_birth" timestamp NOT NULL,
	"gender" varchar(20) NOT NULL,
	"photo_url" varchar(1024),
	"guardian_name" varchar(255) NOT NULL,
	"guardian_phone" varchar(50) NOT NULL,
	"guardian_email" varchar(255),
	"guardian_relationship" varchar(100) NOT NULL,
	"home_address" text NOT NULL,
	"previous_school" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "students_emis_number_unique" UNIQUE("emis_number")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "classes" ADD CONSTRAINT "classes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "classes" ADD CONSTRAINT "classes_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "classes" ADD CONSTRAINT "classes_class_teacher_id_users_id_fk" FOREIGN KEY ("class_teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "students" ADD CONSTRAINT "students_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Enable Row Level Security (RLS) on new tables
ALTER TABLE "academic_years" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "classes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "enrolments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Create tenant isolation policies for new tables
CREATE POLICY academic_years_tenant_isolation ON "academic_years"
  FOR ALL
  USING (
    "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
  );
--> statement-breakpoint
CREATE POLICY classes_tenant_isolation ON "classes"
  FOR ALL
  USING (
    "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
  );
--> statement-breakpoint
CREATE POLICY students_tenant_isolation ON "students"
  FOR ALL
  USING (
    "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
  );
--> statement-breakpoint
CREATE POLICY enrolments_tenant_isolation ON "enrolments"
  FOR ALL
  USING (
    "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
  );

