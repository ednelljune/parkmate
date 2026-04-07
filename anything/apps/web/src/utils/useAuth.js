import { useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

function sanitizeCallbackTarget(target) {
	if (!target || typeof target !== 'string') {
		return '/';
	}

	// Only allow same-origin relative app paths.
	if (!target.startsWith('/') || target.startsWith('//')) {
		return '/';
	}

	return target;
}

function useAuth() {
	const callbackUrl =
		typeof window !== 'undefined'
			? new URLSearchParams(window.location.search).get('callbackUrl')
			: null;

	const buildRedirectTarget = useCallback((options) => {
		return sanitizeCallbackTarget(callbackUrl ?? options?.callbackUrl ?? '/');
	}, [callbackUrl]);

	const signInWithCredentials = useCallback(
		async (options) => {
			const client = getSupabaseBrowserClient();
			const target = buildRedirectTarget(options);
			const { data, error } = await client.auth.signInWithPassword({
				email: options.email.trim().toLowerCase(),
				password: options.password,
			});

			if (error) {
				throw error;
			}

			if (options?.redirect !== false && data.session && typeof window !== 'undefined') {
				window.location.assign(target);
			}

			return data;
		},
		[buildRedirectTarget]
	);

	const signUpWithCredentials = useCallback(
		async (options) => {
			const client = getSupabaseBrowserClient();
			const target = buildRedirectTarget(options);
			const { data, error } = await client.auth.signUp({
				email: options.email.trim().toLowerCase(),
				password: options.password,
				options: {
					emailRedirectTo:
						typeof window !== 'undefined'
							? `${window.location.origin}${target}`
							: undefined,
				},
			});

			if (error) {
				throw error;
			}

			if (options?.redirect !== false && data.session && typeof window !== 'undefined') {
				window.location.assign(target);
			}

			return {
				...data,
				requiresEmailConfirmation: !data.session,
			};
		},
		[buildRedirectTarget]
	);

	const signInWithGoogle = useCallback(
		async (options) => {
			const client = getSupabaseBrowserClient();
			const target = buildRedirectTarget(options);
			const { data, error } = await client.auth.signInWithOAuth({
				provider: 'google',
				options: {
					redirectTo:
						typeof window !== 'undefined'
							? `${window.location.origin}${target}`
							: undefined,
				},
			});

			if (error) {
				throw error;
			}

			return data;
		},
		[buildRedirectTarget]
	);
	const signInWithFacebook = useCallback((options) => {
		return signInWithGoogle(options);
	}, [signInWithGoogle]);
	const signInWithTwitter = useCallback((options) => {
		return signInWithGoogle(options);
	}, [signInWithGoogle]);
	const signOut = useCallback(async () => {
		const client = getSupabaseBrowserClient();
		const { error } = await client.auth.signOut();
		if (error) {
			throw error;
		}
	}, []);

	return {
		signInWithCredentials,
		signUpWithCredentials,
		signInWithGoogle,
		signInWithFacebook,
		signInWithTwitter,
		signOut,
	};
}

export default useAuth;
