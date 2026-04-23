/**
 * Validates a callback URL to prevent open redirect attacks.
 * 
 * Accepts:
 * - Relative paths starting with "/" but not "//" (e.g., "/admin", "/dashboard")
 * - Absolute URLs with the same origin as current location (e.g., same domain)
 * 
 * @param url - The callback URL to validate
 * @param defaultUrl - The fallback URL if validation fails (defaults to "/admin")
 * @returns The validated URL (either the input if valid, or the default)
 */
export function validateCallbackUrl(
	url: string | null | undefined,
	defaultUrl: string = '/admin'
): string {
	// If no URL provided, use default
	if (!url || typeof url !== 'string') {
		return defaultUrl;
	}

	// Trim whitespace
	const trimmedUrl = url.trim();

	// Check if it's a relative path (starts with "/" but not "//")
	if (trimmedUrl.startsWith('/') && !trimmedUrl.startsWith('//')) {
		return trimmedUrl;
	}

	// Check if it's an absolute URL with same origin
	try {
		const urlObj = new URL(trimmedUrl, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
		if (typeof window !== 'undefined' && urlObj.origin === window.location.origin) {
			return urlObj.pathname + urlObj.search + urlObj.hash;
		}
	} catch {
		// Invalid URL format, fall through to default
	}

	// If we get here, the URL failed validation, use default
	return defaultUrl;
}
