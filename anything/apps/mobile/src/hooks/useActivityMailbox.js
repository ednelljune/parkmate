import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import fetch from "@/__create/fetch";
import { resolveBackendUrl } from "@/utils/backend";

export const ACTIVITY_MAILBOX_QUERY_KEY = ["activity_mailbox"];
const ACTIVITY_MAILBOX_TIMEOUT_MS = 15000;
const DEFAULT_ACTIVITY_MAILBOX_REFETCH_INTERVAL_MS = 10000;

const readMailboxResponse = async (response) => {
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(responseText || "Failed to fetch system updates");
  }

  let result;
  try {
    result = responseText ? JSON.parse(responseText) : { notifications: [], summary: null };
  } catch {
    throw new Error(
      `System updates feed returned invalid JSON: ${responseText.slice(0, 120) || "empty response"}`,
    );
  }

  return {
    notifications: Array.isArray(result?.notifications) ? result.notifications : [],
    summary: result?.summary || null,
  };
};

const fetchActivityMailboxFromUrl = async (mailboxUrl) => {
  let timeoutId;

  console.log("[system-updates.fetch] Requesting system updates", {
    url: mailboxUrl,
  });

  try {
    const response = await Promise.race([
      fetch(mailboxUrl),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              `System updates request timed out after ${Math.round(ACTIVITY_MAILBOX_TIMEOUT_MS / 1000)}s`,
            ),
          );
        }, ACTIVITY_MAILBOX_TIMEOUT_MS);
      }),
    ]);

    return await readMailboxResponse(response);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const fetchActivityMailbox = async (mailboxUrls) => {
  let lastError = null;

  for (let index = 0; index < mailboxUrls.length; index += 1) {
    const mailboxUrl = mailboxUrls[index];

    try {
      const result = await fetchActivityMailboxFromUrl(mailboxUrl);

      console.log("[system-updates.fetch] System updates received", {
        url: mailboxUrl,
        count: result.notifications.length,
        claimed: Number(result.summary?.claimed) || 0,
        expired: Number(result.summary?.expired) || 0,
        falseReported: Number(result.summary?.falseReported) || 0,
      });

      return result;
    } catch (error) {
      lastError = error;
      const canRetry = index < mailboxUrls.length - 1;

      console.warn("[system-updates.fetch] System updates failed", {
        message: error?.message || String(error),
        url: mailboxUrl,
        canRetry,
      });

      if (canRetry) {
        console.warn("[system-updates.fetch] Falling back to alternate system updates route", {
          failedUrl: mailboxUrl,
          nextUrl: mailboxUrls[index + 1],
        });
      }
    }
  }

  throw lastError || new Error("Failed to fetch system updates");
};

const normalizeMailboxItem = (item) => {
  const id = String(item?.id || "").trim();
  if (!id) {
    return null;
  }

  const sentAt = item?.sent_at || item?.occurred_at || new Date().toISOString();
  const occurredAt = item?.occurred_at || item?.sent_at || sentAt;

  return {
    ...item,
    id,
    mailbox_type: String(item?.mailbox_type || "claimed"),
    sent_at: String(sentAt),
    occurred_at: String(occurredAt),
    zone_name: String(item?.zone_name || "Reported spot"),
    zone_type: item?.zone_type ? String(item.zone_type) : null,
    parking_type: item?.parking_type ? String(item.parking_type) : null,
    quantity: Math.max(
      1,
      Number.isFinite(Number(item?.quantity)) ? Math.floor(Number(item.quantity)) : 1,
    ),
    false_report_count: Math.max(0, Number(item?.false_report_count) || 0),
    claim_points_awarded: Math.max(0, Number(item?.claim_points_awarded) || 0),
    trust_score_threshold: Math.max(0, Number(item?.trust_score_threshold) || 0),
    trust_score_affected: Boolean(item?.trust_score_affected),
  };
};

export const useActivityMailbox = (
  limit = 50,
  enabled = true,
  options = {},
) => {
  const {
    refetchIntervalMs = false,
    refetchOnMount = false,
    staleTimeMs = Infinity,
  } = options;
  const mailboxUrl = resolveBackendUrl(`/api/notifications/mailbox?limit=${limit}`);
  const legacyMailboxUrl = resolveBackendUrl(`/api/notifications/system-updates?limit=${limit}`);
  const mailboxUrls = useMemo(
    () => [mailboxUrl, legacyMailboxUrl].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index),
    [legacyMailboxUrl, mailboxUrl],
  );

  const query = useQuery({
    queryKey: [...ACTIVITY_MAILBOX_QUERY_KEY, limit],
    queryFn: async () => {
      if (!mailboxUrls.length) {
        throw new Error("System updates backend URL is not configured");
      }

      return fetchActivityMailbox(mailboxUrls);
    },
    enabled,
    staleTime: staleTimeMs === Infinity ? Infinity : Math.max(0, Number(staleTimeMs) || 0),
    refetchOnMount,
    refetchInterval:
      enabled && refetchIntervalMs !== false
        ? Math.max(1000, Number(refetchIntervalMs) || DEFAULT_ACTIVITY_MAILBOX_REFETCH_INTERVAL_MS)
        : false,
    retry: false,
  });

  const data = useMemo(
    () =>
      Array.isArray(query.data?.notifications)
        ? query.data.notifications.map(normalizeMailboxItem).filter(Boolean)
        : [],
    [query.data],
  );

  const summary = useMemo(() => {
    if (query.data?.summary) {
      return query.data.summary;
    }

    return data.reduce(
      (accumulator, item) => {
        accumulator.total += 1;

        if (item.mailbox_type === "claimed") {
          accumulator.claimed += 1;
        } else if (item.mailbox_type === "expired") {
          accumulator.expired += 1;
        } else if (item.mailbox_type === "false_reported") {
          accumulator.falseReported += 1;
        }

        return accumulator;
      },
      { total: 0, claimed: 0, expired: 0, falseReported: 0 },
    );
  }, [data, query.data]);

  return {
    ...query,
    data,
    summary,
  };
};
