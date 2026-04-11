import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import fetch from "@/__create/fetch";
import { resolveBackendUrl } from "@/utils/backend";

export const ACTIVITY_BACKEND_VERSION_QUERY_KEY = ["activity_backend_version"];
const ACTIVITY_BACKEND_VERSION_TIMEOUT_MS = 8000;
const ACTIVITY_BACKEND_VERSION_REFETCH_INTERVAL_MS = 10000;

const readActivityVersionResponse = async (response) => {
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(responseText || "Failed to check activity updates");
  }

  try {
    return responseText ? JSON.parse(responseText) : { version: "empty" };
  } catch {
    throw new Error(
      `Activity update check returned invalid JSON: ${responseText.slice(0, 120) || "empty response"}`,
    );
  }
};

const fetchActivityBackendVersion = async (activityVersionUrl) => {
  let timeoutId;

  try {
    const response = await Promise.race([
      fetch(activityVersionUrl),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              `Activity update check timed out after ${Math.round(ACTIVITY_BACKEND_VERSION_TIMEOUT_MS / 1000)}s`,
            ),
          );
        }, ACTIVITY_BACKEND_VERSION_TIMEOUT_MS);
      }),
    ]);

    return readActivityVersionResponse(response);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const useActivityBackendVersion = (enabled = true) => {
  const queryClient = useQueryClient();
  const previousVersionRef = useRef(null);
  const activityVersionUrl = resolveBackendUrl("/api/notifications/activity/version");

  const query = useQuery({
    queryKey: ACTIVITY_BACKEND_VERSION_QUERY_KEY,
    queryFn: async () => {
      if (!activityVersionUrl) {
        throw new Error("Activity update backend URL is not configured");
      }

      return fetchActivityBackendVersion(activityVersionUrl);
    },
    enabled,
    refetchInterval: ACTIVITY_BACKEND_VERSION_REFETCH_INTERVAL_MS,
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
    queryClient.invalidateQueries({ queryKey: ["activity_notifications"] });
    queryClient.refetchQueries({
      queryKey: ["activity_notifications"],
      type: "active",
    }).catch(() => {});
  }, [enabled, query.data?.version, queryClient]);

  return query;
};
