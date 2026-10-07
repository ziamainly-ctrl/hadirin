-- Hand-written: partial indexes, expression/COALESCE unique indexes, the INCLUDE
-- covering index, and CHECK constraints — drizzle-kit does not diff these reliably
-- (TRD.md §"Migrations", db/schema.ts header). ERD.md §3 is the source of truth;
-- this file must stay byte-for-byte consistent with it.

-- ---------- CHECK constraints ----------
ALTER TABLE "plans" ADD CONSTRAINT "plans_price_monthly_check" CHECK ("price_monthly" >= 0);
--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_max_employees_check" CHECK ("max_employees" > 0);
--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_max_branches_check" CHECK ("max_branches" > 0);
--> statement-breakpoint

ALTER TABLE "branches" ADD CONSTRAINT "branches_latitude_check" CHECK ("latitude" BETWEEN -90 AND 90);
--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_longitude_check" CHECK ("longitude" BETWEEN -180 AND 180);
--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_radius_m_check" CHECK ("radius_m" BETWEEN 10 AND 5000);
--> statement-breakpoint

ALTER TABLE "shifts" ADD CONSTRAINT "shifts_break_minutes_check" CHECK ("break_minutes" >= 0);
--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_late_tolerance_minutes_check" CHECK ("late_tolerance_minutes" >= 0);
--> statement-breakpoint

ALTER TABLE "users" ADD CONSTRAINT "ck_users_login_id" CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);
--> statement-breakpoint

ALTER TABLE "attendance_requests" ADD CONSTRAINT "ck_requests_range" CHECK ("date_to" >= "date_from");
--> statement-breakpoint
ALTER TABLE "attendance_requests" ADD CONSTRAINT "ck_requests_correction_single_day" CHECK ("type" <> 'CORRECTION' OR "date_to" = "date_from");
--> statement-breakpoint

ALTER TABLE "attendance_logs" ADD CONSTRAINT "ck_attendance_out_after_in" CHECK ("check_out_at" IS NULL OR "check_in_at" IS NULL OR "check_out_at" > "check_in_at");
--> statement-breakpoint

ALTER TABLE "invoices" ADD CONSTRAINT "ck_invoices_period" CHECK ("period_end" >= "period_start");
--> statement-breakpoint

-- ---------- Expression / partial unique indexes ----------
CREATE UNIQUE INDEX "uq_platform_admins_email" ON "platform_admins" (lower("email"));
--> statement-breakpoint

CREATE UNIQUE INDEX "uq_users_email" ON "users" (lower("email")) WHERE "email" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_phone" ON "users" ("phone") WHERE "phone" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_org_code" ON "users" ("org_id", "employee_code") WHERE "employee_code" IS NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX "uq_holidays_scope_date" ON "holidays" (COALESCE("org_id", 0), "holiday_date");
--> statement-breakpoint

CREATE UNIQUE INDEX "uq_notif_tpl_scope" ON "notification_templates" (COALESCE("org_id", 0), "event_trigger", "channel");
--> statement-breakpoint

-- ---------- Partial indexes ----------
CREATE INDEX "idx_organizations_expiry" ON "organizations" ("plan_expires_at") WHERE "status" IN ('ACTIVE','PAST_DUE');
--> statement-breakpoint

CREATE INDEX "idx_branches_org_active" ON "branches" ("org_id") WHERE "is_active";
--> statement-breakpoint

CREATE INDEX "idx_payment_methods_active" ON "payment_methods" ("sort_order") WHERE "is_active";
--> statement-breakpoint

CREATE INDEX "idx_requests_pending" ON "attendance_requests" ("org_id", "created_at" DESC) WHERE "status" = 'PENDING';
--> statement-breakpoint

CREATE INDEX "idx_att_open" ON "attendance_logs" ("org_id", "work_date") WHERE "check_in_at" IS NOT NULL AND "check_out_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "idx_att_outside" ON "attendance_logs" ("org_id", "work_date") WHERE "check_in_is_outside" OR "check_out_is_outside";
--> statement-breakpoint
CREATE INDEX "idx_att_request" ON "attendance_logs" ("request_id") WHERE "request_id" IS NOT NULL;
--> statement-breakpoint

CREATE INDEX "idx_invoices_pending" ON "invoices" ("expires_at") WHERE "status" = 'PENDING';
--> statement-breakpoint

CREATE INDEX "idx_notif_logs_failed" ON "notification_logs" ("created_at") WHERE "status" = 'FAILED';
--> statement-breakpoint
CREATE INDEX "idx_notif_logs_att" ON "notification_logs" ("attendance_log_id") WHERE "attendance_log_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "idx_notif_logs_req" ON "notification_logs" ("attendance_request_id") WHERE "attendance_request_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "idx_notif_logs_invoice" ON "notification_logs" ("invoice_id") WHERE "invoice_id" IS NOT NULL;
--> statement-breakpoint

-- ---------- INCLUDE covering index ----------
CREATE INDEX "idx_att_org_date_cover" ON "attendance_logs" ("org_id", "work_date")
  INCLUDE ("user_id", "status", "late_minutes", "work_minutes", "check_in_is_outside");
--> statement-breakpoint
