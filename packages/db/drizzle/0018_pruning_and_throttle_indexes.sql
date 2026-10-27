CREATE INDEX "failed_sign_ins_ip_created_idx" ON "failed_sign_ins" USING btree ("ip_masked","created_at");--> statement-breakpoint
CREATE INDEX "job_runs_finished_idx" ON "job_runs" USING btree ("finished_at");--> statement-breakpoint
CREATE INDEX "product_events_created_idx" ON "product_events" USING btree ("created_at");