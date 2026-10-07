CREATE TABLE "attendance_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"org_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"shift_id" bigint,
	"request_id" bigint,
	"work_date" date NOT NULL,
	"scheduled_in" time,
	"scheduled_out" time,
	"check_in_at" timestamp with time zone,
	"check_in_branch_id" bigint,
	"check_in_lat" numeric(9, 6),
	"check_in_lng" numeric(9, 6),
	"check_in_accuracy_m" integer,
	"check_in_distance_m" integer,
	"check_in_photo_url" varchar(500),
	"check_in_is_outside" boolean DEFAULT false NOT NULL,
	"check_out_at" timestamp with time zone,
	"check_out_branch_id" bigint,
	"check_out_lat" numeric(9, 6),
	"check_out_lng" numeric(9, 6),
	"check_out_accuracy_m" integer,
	"check_out_distance_m" integer,
	"check_out_photo_url" varchar(500),
	"check_out_is_outside" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'PRESENT' NOT NULL,
	"late_minutes" integer DEFAULT 0 NOT NULL,
	"early_leave_minutes" integer DEFAULT 0 NOT NULL,
	"work_minutes" integer,
	"note" varchar(255),
	"source" varchar(20) DEFAULT 'APP' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_requests" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"org_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"type" varchar(20) NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"requested_check_in" time,
	"requested_check_out" time,
	"reason" varchar(500) NOT NULL,
	"attachment_url" varchar(500),
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"reviewed_by" bigint,
	"reviewed_at" timestamp with time zone,
	"review_note" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"org_id" bigint NOT NULL,
	"name" varchar(100) NOT NULL,
	"address" varchar(255),
	"latitude" numeric(9, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"radius_m" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"org_id" bigint,
	"holiday_date" date NOT NULL,
	"name" varchar(120) NOT NULL,
	"is_collective_leave" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"org_id" bigint NOT NULL,
	"plan_id" bigint NOT NULL,
	"payment_method_id" bigint,
	"invoice_code" varchar(40) NOT NULL,
	"midtrans_order_id" varchar(50),
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"employee_count" integer NOT NULL,
	"amount" bigint NOT NULL,
	"admin_fee" bigint DEFAULT 0 NOT NULL,
	"total_amount" bigint NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"snap_token" varchar(100),
	"snap_redirect_url" varchar(500),
	"midtrans_transaction_id" varchar(64),
	"paid_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_code_unique" UNIQUE("invoice_code"),
	CONSTRAINT "invoices_midtrans_order_id_unique" UNIQUE("midtrans_order_id")
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"org_id" bigint NOT NULL,
	"template_id" bigint,
	"user_id" bigint,
	"attendance_log_id" bigint,
	"attendance_request_id" bigint,
	"invoice_id" bigint,
	"channel" varchar(20) NOT NULL,
	"recipient" varchar(150) NOT NULL,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"status" varchar(20) DEFAULT 'QUEUED' NOT NULL,
	"error" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"org_id" bigint,
	"event_trigger" varchar(40) NOT NULL,
	"channel" varchar(20) NOT NULL,
	"subject" varchar(200),
	"body" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"plan_id" bigint NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(60) NOT NULL,
	"timezone" varchar(40) DEFAULT 'Asia/Jakarta' NOT NULL,
	"status" varchar(20) DEFAULT 'TRIAL' NOT NULL,
	"geofence_mode" varchar(10) DEFAULT 'STRICT' NOT NULL,
	"selfie_required" boolean DEFAULT true NOT NULL,
	"logo_url" varchar(500),
	"trial_ends_at" timestamp with time zone,
	"plan_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "payment_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"invoice_id" bigint NOT NULL,
	"direction" varchar(10) NOT NULL,
	"endpoint" varchar(255),
	"request_payload" jsonb,
	"response_payload" jsonb,
	"http_status" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(80) NOT NULL,
	"type" varchar(20) NOT NULL,
	"logo_url" varchar(500),
	"admin_fee_flat" bigint DEFAULT 0 NOT NULL,
	"admin_fee_pct" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_methods_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(60) NOT NULL,
	"price_monthly" bigint DEFAULT 0 NOT NULL,
	"max_employees" integer NOT NULL,
	"max_branches" integer NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(150) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" varchar(20) DEFAULT 'SUPERADMIN' NOT NULL,
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"org_id" bigint NOT NULL,
	"name" varchar(60) NOT NULL,
	"time_in" time NOT NULL,
	"time_out" time NOT NULL,
	"break_minutes" integer DEFAULT 60 NOT NULL,
	"late_tolerance_minutes" integer DEFAULT 0 NOT NULL,
	"work_days" varchar(20) DEFAULT '1,2,3,4,5' NOT NULL,
	"is_cross_day" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"org_id" bigint NOT NULL,
	"branch_id" bigint,
	"shift_id" bigint,
	"manager_id" bigint,
	"employee_code" varchar(30),
	"name" varchar(100) NOT NULL,
	"email" varchar(150),
	"phone" varchar(20),
	"password_hash" varchar(255) NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"role" varchar(20) DEFAULT 'EMPLOYEE' NOT NULL,
	"position" varchar(80),
	"avatar_url" varchar(500),
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"joined_at" date,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_request_id_attendance_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."attendance_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_check_in_branch_id_branches_id_fk" FOREIGN KEY ("check_in_branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_check_out_branch_id_branches_id_fk" FOREIGN KEY ("check_out_branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_requests" ADD CONSTRAINT "attendance_requests_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_requests" ADD CONSTRAINT "attendance_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_requests" ADD CONSTRAINT "attendance_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_template_id_notification_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_attendance_log_id_attendance_logs_id_fk" FOREIGN KEY ("attendance_log_id") REFERENCES "public"."attendance_logs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_attendance_request_id_attendance_requests_id_fk" FOREIGN KEY ("attendance_request_id") REFERENCES "public"."attendance_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_logs" ADD CONSTRAINT "payment_logs_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_attendance_user_date" ON "attendance_logs" USING btree ("user_id","work_date");--> statement-breakpoint
CREATE INDEX "idx_att_shift" ON "attendance_logs" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "idx_att_in_branch" ON "attendance_logs" USING btree ("check_in_branch_id");--> statement-breakpoint
CREATE INDEX "idx_att_out_branch" ON "attendance_logs" USING btree ("check_out_branch_id");--> statement-breakpoint
CREATE INDEX "idx_requests_org_status" ON "attendance_requests" USING btree ("org_id","status","date_from");--> statement-breakpoint
CREATE INDEX "idx_requests_user" ON "attendance_requests" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_requests_reviewed_by" ON "attendance_requests" USING btree ("reviewed_by");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_branches_org_name" ON "branches" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "idx_holidays_date" ON "holidays" USING btree ("holiday_date");--> statement-breakpoint
CREATE INDEX "idx_invoices_org" ON "invoices" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_invoices_plan" ON "invoices" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_method" ON "invoices" USING btree ("payment_method_id");--> statement-breakpoint
CREATE INDEX "idx_notif_logs_org" ON "notification_logs" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notif_logs_template" ON "notification_logs" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_notif_logs_user" ON "notification_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_organizations_plan" ON "organizations" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_payment_logs_invoice" ON "payment_logs" USING btree ("invoice_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shifts_org_name" ON "shifts" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "idx_shifts_org" ON "shifts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_users_org_status_role" ON "users" USING btree ("org_id","status","role");--> statement-breakpoint
CREATE INDEX "idx_users_branch" ON "users" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_users_shift" ON "users" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "idx_users_manager" ON "users" USING btree ("manager_id");