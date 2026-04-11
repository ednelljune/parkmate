import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import fetch from "@/__create/fetch";
import { resolveBackendUrl } from "@/utils/backend";

export const ACTIVITY_MAILBOX_BACKEND_VERSION_QUERY_KEY = ["activity_mailbox_backend_version"];
const ACTIVITY_MAILBOX_BACKEND_VERSION_TIMEOUT_MS = 8000;
const ACTIVITY_MAILBOX_BACKEND_VERSION_REFETCH_INTERVAL_MS = 10000;

const readMailboxVersionResponse = async (response) => {
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(responseText || "Failed to check system update changes");
  }

  try {
    return responseText ? JSON.parse(responseText) : { version: "empty" };
  } catch {
    throw new Error(
      `System update check returned invalid JSON: ${responseText.slice(0, 120) || "empty response"}`,
    );
  }
};

const fetchMailboxBackendVersionFromUrl = async (mailboxVersionUrl) => {
  let timeoutId;

  try {
    const response = await Promise.race([
      fetch(mailboxVersionUrl),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              `System update check timed out after ${Math.round(ACTIVITY_MAILBOX_BACKEND_VERSION_TIMEOUT_MS / 1000)}s`,
            ),
          );
        }, ACTIVITY_MAILBOX_BACKEND_VERSION_TIMEOUT_MS);
      }),
    ]);

    return await readMailboxVersionResponse(response);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const fetchMailboxBackendVersion = async (mailboxVersionUrls) => {
  let lastError = null;

  for (let index = 0; index < mailboxVersionUrls.length; index += 1) {
    const mailboxVersionUrl = mailboxVersionUrls[index];

    try {
      return await fetchMailboxBackendVersionFromUrl(mailboxVersionUrl);
    } catch (error) {
      lastError = error;
      const canRetry = index < mailboxVersionUrls.length - 1;

      console.warn("[system-updates.version] System update version check failed", {
        message: error?.message || String(error),
        url: mailboxVersionUrl,
        canRetry,
      });

      if (canRetry) {
        console.warn("[system-updates.version] Falling back to alternate version route", {
          failedUrl: mailboxVersionUrl,
          nextUrl: mailboxVersionUrls[index + 1],
        });
      }
    }
  }

  throw lastError || new Error("Failed to check system update changes");
};

export const useActivityMailboxBackendVersion = (enabled = true) => {
  const queryClient = useQueryClient();
  const previousVersionRef = useRef(null);
  const mailboxVersionUrl = resolveBackendUrl("/api/notifications/mailbox/version");
  const legacyMailboxVersionUrl = resolveBackendUrl("/api/notifications/activity/version");
  const mailboxVersionUrls = [
    mailboxVersionUrl,
    legacyMailboxVersionUrl,
  ].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);

  const query = useQuery({
    queryKey: ACTIVITY_MAILBOX_BACKEND_VERSION_QUERY_KEY,
    queryFn: async () => {
      if (!mailboxVersionUrls.length) {
        throw new Error("System update backend URL is not configured");
      }

      return fetchMailboxBackendVersion(mailboxVersionUrls);
    },
    enabled,
    refetchInterval: ACTIVITY_MAILBOX_BACKEND_VERSION_REFETCH_INTERVAL_MS,
    retry: false,
    staleTime: 0,
    refetchOnMount: true,
  });

  useEffect(() => {
    if (!enabled) {
      previousVersionRef.current = null;
      return;
    }

    const nextVersion = query.data?.version ? String(query.data.version) : null;
    if (!nextVersion) {
      return;
    }

    if (previousVersionRef.current == null) {
      previousVersionRef.current = nextVersion;
      return;
    }

    if (previousVersionRef.current === nextVersion) {
      return;
    }

    previousVersionRef.current = nextVersion;
    queryClient.invalidateQueries({ queryKey: ["activity_mailbox"] });
    queryClient.refetchQueries({
      queryKey: ["activity_mailbox"],
      type: "active",
    }).catch(() => {});
  }, [enabled, query.data?.version, queryClient]);

  return query;
};
