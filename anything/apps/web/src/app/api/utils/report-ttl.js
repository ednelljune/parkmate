export const REPORT_TTL_MINUTES = 3;
export const REPORT_TTL_MS = REPORT_TTL_MINUTES * 60 * 1000;

const REPORT_TTL_INTERVAL_SQL = `INTERVAL '${REPORT_TTL_MINUTES} minutes'`;

export const getEffectiveReportExpiresAtSql = (alias = "lr") =>
  `COALESCE(LEAST(${alias}.expires_at, ${alias}.created_at + ${REPORT_TTL_INTERVAL_SQL}), ${alias}.expires_at, ${alias}.created_at + ${REPORT_TTL_INTERVAL_SQL})`;

export const getEffectiveReportExpiry = (report) => {
  const createdAtMs = Date.parse(report?.created_at ?? "");
  const expiresAtMs = Date.parse(report?.expires_at ?? "");

  const createdExpiryMs = Number.isFinite(createdAtMs)
    ? createdAtMs + REPORT_TTL_MS
    : Number.NaN;

  if (Number.isFinite(createdExpiryMs) && Number.isFinite(expiresAtMs)) {
    return new Date(Math.min(createdExpiryMs, expiresAtMs)).toISOString();
  }

  if (Number.isFinite(createdExpiryMs)) {
    return new Date(createdExpiryMs).toISOString();
  }

  if (Number.isFinite(expiresAtMs)) {
    return new Date(expiresAtMs).toISOString();
  }

  return null;
};

export const applyEffectiveReportExpiry = (report) => {
  if (!report) {
    return report;
  }

  const effectiveExpiresAt = getEffectiveReportExpiry(report);

  if (!effectiveExpiresAt) {
    return report;
  }

  return {
    ...report,
    expires_at: effectiveExpiresAt,
  };
};
