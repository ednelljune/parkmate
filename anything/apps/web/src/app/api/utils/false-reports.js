import sql from "@/app/api/utils/sql";

let falseReportsSchemaPromise = null;

export const ensureFalseReportsSchema = () => {
  if (!falseReportsSchemaPromise) {
    falseReportsSchemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS false_reports (
          id BIGSERIAL PRIMARY KEY,
          report_id BIGINT NOT NULL REFERENCES live_reports(id) ON DELETE CASCADE,
          reported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT false_reports_report_id_reported_by_key UNIQUE (report_id, reported_by)
        );
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_false_reports_report_id
        ON false_reports (report_id);
      `;
    })().catch((error) => {
      falseReportsSchemaPromise = null;
      throw error;
    });
  }

  return falseReportsSchemaPromise;
};
