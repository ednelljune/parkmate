import { getDistanceMeters } from "@/utils/geo";

const localReports = [];
const localNotifications = [];
const localReportListeners = new Set();
let localReportsVersion = 0;
let pruneTimeoutId = null;
const REPORT_TTL_MS = 3 * 60 * 1000;
const LOCAL_REPORT_SYNC_GRACE_MS = 20 * 1000;

const normalizeReportId = (value) => String(value);
const normalizeLocalReport = (report) => {
  if (!report) return report;

  return {
    ...report,
    __local_persisted_at:
      report.__local_persisted_at || new Date().toISOString(),
  };
};

const getEffectiveExpiresAtMs = (report) => {
  const createdAtMs = Date.parse(report?.created_at ?? "");
  const expiresAtMs = Date.parse(report?.expires_at ?? "");
  const createdExpiryMs = Number.isFinite(createdAtMs)
    ? createdAtMs + REPORT_TTL_MS
    : Number.NaN;

  if (Number.isFinite(createdExpiryMs) && Number.isFinite(expiresAtMs)) {
    return Math.min(createdExpiryMs, expiresAtMs);
  }

  if (Number.isFinite(createdExpiryMs)) {
    return createdExpiryMs;
  }

  if (Number.isFinite(expiresAtMs)) {
    return expiresAtMs;
  }

  return Number.NaN;
};

const isReportActive = (report) => {
  if (!report) return false;

  const normalizedStatus = String(report.status || "available").toLowerCase();
  if (["claimed", "expired", "reported false"].includes(normalizedStatus)) {
    return false;
  }

  if (!report.expires_at) {
    return true;
  }

  const expiresAtMs = getEffectiveExpiresAtMs(report);
  if (Number.isNaN(expiresAtMs)) {
    return true;
  }

  return expiresAtMs > Date.now();
};

const emitLocalReportChange = () => {
  localReportsVersion += 1;
  localReportListeners.forEach((listener) => listener());
};

const hasInactiveLocalReports = () =>
  localReports.some((report) => !isReportActive(report));

const pruneInactiveLocalReports = () => {
  const nextReports = localReports.filter((report) => isReportActive(report));
  if (nextReports.length === localReports.length) {
    return;
  }

  localReports.splice(0, localReports.length, ...nextReports);
  emitLocalReportChange();
};

const scheduleInactiveLocalReportPrune = () => {
  if (pruneTimeoutId !== null || !hasInactiveLocalReports()) {
    return;
  }

  pruneTimeoutId = setTimeout(() => {
    pruneTimeoutId = null;
    pruneInactiveLocalReports();
  }, 0);
};

export const addLocalReport = (report) => {
  if (!report || !report.id || !isReportActive(report)) return;
  const normalizedReport = normalizeLocalReport(report);
  const reportId = normalizeReportId(report.id);
  const exists = localReports.find((r) => normalizeReportId(r.id) === reportId);
  if (exists) return;
  localReports.unshift(normalizedReport);
  console.log("[reports.local] Added local report", {
    reportId: normalizedReport.id,
    latitude: normalizedReport.latitude,
    longitude: normalizedReport.longitude,
    totalLocalReports: localReports.length,
  });
  emitLocalReportChange();
};

export const upsertLocalReport = (report) => {
  if (!report || !report.id) return;

  const normalizedReport = normalizeLocalReport(report);
  const reportId = normalizeReportId(report.id);
  const nextReports = localReports.filter(
    (existingReport) => normalizeReportId(existingReport.id) !== reportId,
  );

  if (isReportActive(normalizedReport)) {
    nextReports.unshift(normalizedReport);
  }

  localReports.splice(0, localReports.length, ...nextReports);
  emitLocalReportChange();
};

export const getNearbyLocalReports = (location, radiusMeters) => {
  scheduleInactiveLocalReportPrune();
  if (!location || radiusMeters == null) return [];
  return localReports.filter((report) => {
    if (!isReportActive(report)) {
      return false;
    }
    const hasLocation =
      typeof report.latitude === "number" && typeof report.longitude === "number";
    if (!hasLocation) {
      return false;
    }
    const distance = getDistanceMeters(location, {
      latitude: report.latitude,
      longitude: report.longitude,
    });
    return distance !== null && distance <= radiusMeters;
  });
};

export const isLocalReportWithinSyncGrace = (
  report,
  nowMs = Date.now(),
  graceMs = LOCAL_REPORT_SYNC_GRACE_MS,
) => {
  if (!report) return false;

  const persistedAtMs = Date.parse(report.__local_persisted_at ?? "");
  if (!Number.isFinite(persistedAtMs)) {
    return false;
  }

  return nowMs - persistedAtMs <= graceMs;
};

export const removeLocalReport = (reportId) => {
  if (reportId == null) return;
  const normalizedReportId = normalizeReportId(reportId);

  const nextReports = localReports.filter(
    (report) => normalizeReportId(report.id) !== normalizedReportId,
  );
  if (nextReports.length === localReports.length) {
    return;
  }

  localReports.splice(0, localReports.length, ...nextReports);
  emitLocalReportChange();
};

export const addLocalNotification = (notification) => {
  if (!notification || !notification.id) return;
  const exists = localNotifications.find((n) => n.id === notification.id);
  if (exists) return;
  localNotifications.unshift(notification);
  emitLocalReportChange();
};

export const getLocalNotifications = () => [...localNotifications];

export const getLocalReportsVersion = () => localReportsVersion;

export const subscribeToLocalReports = (listener) => {
  localReportListeners.add(listener);
  return () => {
    localReportListeners.delete(listener);
  };
};
