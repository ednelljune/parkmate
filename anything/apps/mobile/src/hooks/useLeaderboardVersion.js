import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import fetch from "@/__create/fetch";
import { resolveBackendUrl } from "@/utils/backend";
import { sortUsersByTrust } from "@/utils/trustBadges";

export const LEADERBOARD_QUERY_KEY = ["leaderboard"];
export const LEADERBOARD_VERSION_QUERY_KEY = ["leaderboard_version"];

const LEADERBOARD_REQUEST_TIMEOUT_MS = 15000;
const LEADERBOARD_VERSION_TIMEOUT_MS = 8000;
const LEADERBOARD_VERSION_REFETCH_INTERVAL_MS = 10000;

const readLeaderboardVersionResponse = async (response) => {
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(responseText || "Failed to check leaderboard updates");
  }

  try {
    return responseText ? JSON.parse(responseText) : { version: "empty" };
  } catch {
    throw new Error(
      `Leaderboard update check returned invalid JSON: ${responseText.slice(0, 120) || "empty response"}`,
    );
  }
};

const fetchLeaderboardVersion = async (leaderboardVersionUrl) => {
  let timeoutId;

  try {
    const response = await Promise.race([
      fetch(leaderboardVersionUrl),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              `Leaderboard update check timed out after ${Math.round(LEADERBOARD_VERSION_TIMEOUT_MS / 1000)}s`,
            ),
          );
        }, LEADERBOARD_VERSION_TIMEOUT_MS);
      }),
    ]);

    return readLeaderboardVersionResponse(response);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const fetchLeaderboardResponse = async (leaderboardUrl) => {
  let timeoutId;

  try {
    const response = await Promise.race([
      fetch(leaderboardUrl),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              `Leaderboard request timed out after ${Math.round(LEADERBOARD_REQUEST_TIMEOUT_MS / 1000)}s`,
            ),
          );
        }, LEADERBOARD_REQUEST_TIMEOUT_MS);
      }),
    ]);

    return response;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const fetchLeaderboardQuery = async (limit = 50) => {
  const leaderboardUrl = resolveBackendUrl(`/api/users/leaderboard?limit=${limit}`);

  if (!leaderboardUrl) {
    throw new Error("Leaderboard backend URL is not configured");
  }

  const response = await fetchLeaderboardResponse(leaderboardUrl);
  const responseText = await response.text();
  let result = {};

  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(
      `Leaderboard returned invalid JSON: ${responseText.slice(0, 120) || "empty response"}`,
    );
  }

  if (!response.ok) {
    throw new Error(result?.error || "Failed to fetch leaderboard");
  }

  return sortUsersByTrust(result?.users);
};

export const fetchLeaderboardVersionQuery = async (limit = 50) => {
  const leaderboardVersionUrl = resolveBackendUrl(`/api/users/leaderboard/version?limit=${limit}`);

  if (!leaderboardVersionUrl) {
    throw new Error("Leaderboard update backend URL is not configured");
  }

  return fetchLeaderboardVersion(leaderboardVersionUrl);
};

export const useLeaderboardVersion = (limit = 50, enabled = true) => {
  const queryClient = useQueryClient();
  const previousVersionRef = useRef(null);
  const leaderboardVersionUrl = resolveBackendUrl(`/api/users/leaderboard/version?limit=${limit}`);

  const query = useQuery({
    queryKey: [...LEADERBOARD_VERSION_QUERY_KEY, limit],
    queryFn: async () => {
      if (!leaderboardVersionUrl) {
        throw new Error("Leaderboard update backend URL is not configured");
      }

      return fetchLeaderboardVersion(leaderboardVersionUrl);
    },
    enabled,
    refetchInterval: LEADERBOARD_VERSION_REFETCH_INTERVAL_MS,
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
    queryClient.invalidateQueries({ queryKey: [...LEADERBOARD_QUERY_KEY, limit] });
    queryClient
      .refetchQueries({
        queryKey: [...LEADERBOARD_QUERY_KEY, limit],
        exact: true,
        type: "active",
      })
      .catch(() => {});
  }, [enabled, limit, query.data?.version, queryClient]);

  return query;
};
