import fetch from "@/__create/fetch";
import { resolveBackendUrl } from "@/utils/backend";

const readDeleteResponse = async (response, defaultMessage) => {
  const responseText = await response.text();
  let payload = null;

  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || responseText || defaultMessage);
  }

  return payload || { success: true };
};

const postNotificationDelete = async (path, ids, defaultMessage) => {
  const url = resolveBackendUrl(path);
  if (!url) {
    throw new Error("Notification delete backend URL is not configured");
  }

  const normalizedIds = Array.isArray(ids)
    ? ids.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

  if (normalizedIds.length === 0) {
    return { success: true, hiddenIds: [] };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids: normalizedIds }),
  });

  return readDeleteResponse(response, defaultMessage);
};

const getMailboxAliasIds = (item) => {
  const reportId = String(item?.report_id || "").trim();
  const mailboxType = String(item?.mailbox_type || "").trim();
  const itemId = String(item?.id || "").trim();
  const falseReportCount = Math.max(1, Number(item?.false_report_count) || 1);
  const aliases = new Set();
  const rawId = itemId.startsWith("system-") ? itemId.slice("system-".length) : itemId;

  if (itemId) {
    aliases.add(itemId);
    if (itemId.startsWith("system-")) {
      aliases.add(rawId);
    }
  }

  if (!mailboxType || !reportId) {
    return [...aliases];
  }

  if (mailboxType === "claimed") {
    aliases.add(`claimed-${reportId}`);
    if (rawId.startsWith("report_claimed-")) {
      aliases.add(`claimed-${rawId.slice("report_claimed-".length)}`);
    }
    if (rawId.startsWith("report-claimed-")) {
      aliases.add(`claimed-${rawId.slice("report-claimed-".length)}`);
    }
  } else if (mailboxType === "expired") {
    aliases.add(`expired-${reportId}`);
  } else if (mailboxType === "false_reported") {
    aliases.add(`false-${reportId}-${falseReportCount}`);
  } else if (mailboxType === "zone_reviewing") {
    aliases.add(`zone-reviewing-${reportId}`);
    aliases.add(`zone_reviewing-${reportId}`);
    if (rawId.startsWith("zone_reviewing-")) {
      aliases.add(`zone-reviewing-${rawId.slice("zone_reviewing-".length)}`);
    }
    if (rawId.startsWith("zone-reviewing-")) {
      aliases.add(`zone_reviewing-${rawId.slice("zone-reviewing-".length)}`);
    }
  } else if (mailboxType === "zone_approved") {
    aliases.add(`zone-approved-${reportId}`);
    aliases.add(`zone_approved-${reportId}`);
    if (rawId.startsWith("zone_approved-")) {
      aliases.add(`zone-approved-${rawId.slice("zone_approved-".length)}`);
    }
    if (rawId.startsWith("zone-approved-")) {
      aliases.add(`zone_approved-${rawId.slice("zone-approved-".length)}`);
    }
  } else if (mailboxType === "zone_rejected") {
    aliases.add(`zone-rejected-${reportId}`);
    aliases.add(`zone_rejected-${reportId}`);
    if (rawId.startsWith("zone_rejected-")) {
      aliases.add(`zone-rejected-${rawId.slice("zone_rejected-".length)}`);
    }
    if (rawId.startsWith("zone-rejected-")) {
      aliases.add(`zone_rejected-${rawId.slice("zone-rejected-".length)}`);
    }
  }

  return [...aliases];
};

export const deleteActivityNotificationsRemote = async (ids = []) =>
  postNotificationDelete(
    "/api/notifications/activity/delete",
    ids,
    "Failed to delete activity notifications",
  );

export const deleteMailboxNotificationsRemote = async (items = []) =>
  postNotificationDelete(
    "/api/notifications/mailbox/delete",
    items.flatMap((item) => getMailboxAliasIds(item)),
    "Failed to delete system updates",
  );
