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

  if (itemId) {
    aliases.add(itemId);
    if (itemId.startsWith("system-")) {
      aliases.add(itemId.slice("system-".length));
    }
  }

  if (!mailboxType || !reportId) {
    return [...aliases];
  }

  if (mailboxType === "claimed") {
    aliases.add(`claimed-${reportId}`);

    const rawId = itemId.startsWith("system-") ? itemId.slice("system-".length) : itemId;
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
