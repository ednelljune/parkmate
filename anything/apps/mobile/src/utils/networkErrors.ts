const NETWORK_ERROR_PATTERNS = [
  /fetch failed/i,
  /network request failed/i,
  /network connection was lost/i,
  /software caused connection abort/i,
  /timed out/i,
  /could not connect to the server/i,
  /internet connection appears to be offline/i,
];

export const FIRST_PARTY_CONNECTIVITY_ERROR_NAME = 'FirstPartyConnectivityError';

type ConnectivityErrorDetails = {
  fallbackUrl?: string | null;
  originalMessage?: string | null;
  url?: string | null;
};

export type FirstPartyConnectivityError = Error & {
  fallbackUrl?: string;
  isConnectivityIssue?: boolean;
  originalMessage?: string;
  url?: string;
};

const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }

  return String(error ?? '');
};

export const isLikelyNetworkError = (error: unknown): boolean => {
  const message = getErrorMessage(error).trim();
  if (!message) {
    return false;
  }

  return NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

export const createFirstPartyConnectivityError = ({
  url,
  fallbackUrl,
  originalMessage,
}: ConnectivityErrorDetails): FirstPartyConnectivityError => {
  const error = new Error(
    'ParkMate could not reach its backend. Check your internet connection or the configured backend URL.',
  ) as FirstPartyConnectivityError;

  error.name = FIRST_PARTY_CONNECTIVITY_ERROR_NAME;
  error.url = url ?? undefined;
  error.fallbackUrl = fallbackUrl ?? undefined;
  error.originalMessage = originalMessage ?? undefined;
  error.isConnectivityIssue = true;

  return error;
};

export const isIgnoredSentryNetworkError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }

  if (
    typeof error === 'object' &&
    'name' in error &&
    (error as { name?: unknown }).name === FIRST_PARTY_CONNECTIVITY_ERROR_NAME
  ) {
    return true;
  }

  return isLikelyNetworkError(error);
};
