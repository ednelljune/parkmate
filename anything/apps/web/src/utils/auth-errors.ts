export function formatAuthError(error: unknown, fallbackMessage: string) {
	const rawMessage =
		error instanceof Error
			? error.message
			: typeof error === 'string'
				? error
				: '';

	const normalizedMessage = rawMessage.trim();

	const errorMessages: Record<string, string> = {
		'Invalid login credentials':
			'Incorrect email or password. Try again or reset your password.',
		'Email not confirmed':
			'Check your inbox and confirm your email address before signing in.',
		'Auth session missing!':
			'Sign-in did not complete. Please try again.',
		'User already registered':
			'This email is already registered. Try signing in instead.',
		'Password should be at least 6 characters':
			'Password must be at least 6 characters.',
	};

	if (errorMessages[normalizedMessage]) {
		return errorMessages[normalizedMessage];
	}

	if (normalizedMessage.startsWith('Supabase Auth is not configured.')) {
		return 'Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in Netlify.';
	}

	if (normalizedMessage.startsWith('Missing Supabase auth environment configuration:')) {
		return 'Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in Netlify.';
	}

	if (normalizedMessage.startsWith('Invalid Supabase URL in ')) {
		return normalizedMessage;
	}

	return normalizedMessage || fallbackMessage;
}
