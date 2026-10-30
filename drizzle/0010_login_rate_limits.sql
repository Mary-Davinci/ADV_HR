CREATE TABLE "login_rate_limits" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"attempts" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "login_rate_limits_expiry_idx" ON "login_rate_limits" USING btree ("expires_at");