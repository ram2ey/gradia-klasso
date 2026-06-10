CREATE TABLE IF NOT EXISTS "assessment_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"term" integer NOT NULL,
	"class_score" numeric(5, 2) NOT NULL,
	"exam_score" numeric(5, 2) NOT NULL,
	"total" numeric(5, 2) NOT NULL,
	"grade" varchar(2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_scores_school_id_student_id_subject_id_academic_year_id_term_unique" UNIQUE("school_id","student_id","subject_id","academic_year_id","term")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"term" integer NOT NULL,
	"class_position" integer,
	"aggregate" integer,
	"promoted" boolean,
	"teacher_remarks" text,
	"head_remarks" text,
	"next_term_begins" date,
	"published_at" timestamp,
	"pdf_url" varchar(1024),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "report_cards_school_id_student_id_academic_year_id_term_unique" UNIQUE("school_id","student_id","academic_year_id","term")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(100) NOT NULL,
	"class_levels" integer[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subjects" ADD CONSTRAINT "subjects_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Enable Row Level Security (RLS)
ALTER TABLE "subjects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "assessment_scores" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "report_cards" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Create tenant isolation policies
CREATE POLICY subjects_tenant_isolation ON "subjects"
  FOR ALL USING ("school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY assessment_scores_tenant_isolation ON "assessment_scores"
  FOR ALL USING ("school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY report_cards_tenant_isolation ON "report_cards"
  FOR ALL USING ("school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid);
--> statement-breakpoint
-- Trigger to calculate total score and NaCCA grade
CREATE OR REPLACE FUNCTION calculate_assessment_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total := ROUND((NEW.class_score * 0.30) + (NEW.exam_score * 0.70), 2);
  NEW.grade := CASE
    WHEN NEW.total >= 80.00 THEN 'A1'
    WHEN NEW.total >= 70.00 THEN 'B2'
    WHEN NEW.total >= 60.00 THEN 'B3'
    WHEN NEW.total >= 55.00 THEN 'C4'
    WHEN NEW.total >= 50.00 THEN 'C5'
    WHEN NEW.total >= 45.00 THEN 'C6'
    WHEN NEW.total >= 40.00 THEN 'D7'
    WHEN NEW.total >= 35.00 THEN 'E8'
    ELSE 'F9'
  END;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS assessment_scores_calc_trigger ON "assessment_scores";
--> statement-breakpoint
CREATE TRIGGER assessment_scores_calc_trigger
BEFORE INSERT OR UPDATE ON "assessment_scores"
FOR EACH ROW
EXECUTE FUNCTION calculate_assessment_score();
