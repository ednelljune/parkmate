const CLAIM_POINTS_AWARDED = 10;
const FALSE_REPORT_TRUST_THRESHOLD = 3;

const normalizeSystemUpdateFromActivity = (item) => {
  const activityType = String(item?.activity_type || "");
  const reportId = item?.report_id ? String(item.report_id) : "";
  const itemId = String(item?.id || "").trim();
  const isSystemUpdate = Boolean(item?.is_system_update);

  if (!itemId || !reportId) {
    return null;
  }

  if (isSystemUpdate && activityType === "report_claimed") {
    return {
      ...item,
      id: `system-${itemId}`,
      mailbox_type: "claimed",
      claim_points_awarded: Math.max(0, Number(item?.claim_points_awarded) || CLAIM_POINTS_AWARDED),
      false_report_count: 0,
      trust_score_threshold: FALSE_REPORT_TRUST_THRESHOLD,
      trust_score_affected: false,
    };
  }

  if (isSystemUpdate && activityType === "expired") {
    return {
      ...item,
      id: `system-${itemId}`,
      mailbox_type: "expired",
      claim_points_awarded: 0,
      false_report_count: 0,
      trust_score_threshold: FALSE_REPORT_TRUST_THRESHOLD,
      trust_score_affected: false,
    };
  }

  if (isSystemUpdate && activityType === "false_reported") {
    return {
      ...item,
      id: `system-${itemId}`,
      mailbox_type: "false_reported",
      claim_points_awarded: 0,
      false_report_count: Math.max(1, Number(item?.false_report_count) || 1),
      trust_score_threshold: Math.max(
        1,
        Number(item?.trust_score_threshold) || FALSE_REPORT_TRUST_THRESHOLD,
      ),
      trust_score_affected: Boolean(item?.trust_score_affected),
    };
  }

  return null;
};

export const deriveSystemUpdateItems = (notifications = []) => {
  const mergedByKey = new Map();

  notifications
    .map(normalizeSystemUpdateFromActivity)
    .filter(Boolean)
    .forEach((item) => {
      const key = `${item.mailbox_type}-${item.report_id}`;
      if (!key || mergedByKey.has(key)) {
        return;
      }

      mergedByKey.set(key, item);
    });

  return [...mergedByKey.values()].sort((a, b) => {
    const aTime = new Date(a?.sent_at || a?.occurred_at || 0).getTime();
    const bTime = new Date(b?.sent_at || b?.occurred_at || 0).getTime();
    return bTime - aTime;
  });
};
