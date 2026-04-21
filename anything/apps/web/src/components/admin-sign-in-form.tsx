'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import useAuth from '@/utils/useAuth';
import { formatAuthError } from '@/utils/auth-errors';
import logo from '@/__create/parkmate-logo.png';
import { useSupabaseAuth } from '@/utils/supabase-auth';
import { isSupabaseConfigured } from '@/lib/supabase/client';

type AdminSignInFormProps = {
	defaultCallbackUrl?: string;
};

export default function AdminSignInForm({
	defaultCallbackUrl = '/admin',
}: AdminSignInFormProps) {
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');

	const { isLoading: isAuthLoading, session } = useSupabaseAuth();
	const { signInWithCredentials } = useAuth();

	useEffect(() => {
		if (typeof window === 'undefined' || isAuthLoading || !session) {
			return;
		}

		const urlParams = new URLSearchParams(window.location.search);
		const callbackUrl = urlParams.get('callbackUrl') || defaultCallbackUrl;
		window.location.replace(callbackUrl);
	}, [defaultCallbackUrl, isAuthLoading, session]);

	const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		if (!isSupabaseConfigured) {
			setError(
				'Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in Netlify.',
			);
			setLoading(false);
			return;
		}

		if (!email || !password) {
			setError('Please fill in all fields');
			setLoading(false);
			return;
		}

		try {
			const urlParams = new URLSearchParams(window.location.search);
			const callbackUrl = urlParams.get('callbackUrl') || defaultCallbackUrl;

			await signInWithCredentials({
				email,
				password,
				callbackUrl,
				redirect: true,
			});
		} catch (err) {
			setError(formatAuthError(err, 'Something went wrong. Please try again.'));
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-3">
			<form
				noValidate
				onSubmit={onSubmit}
				className="w-full max-w-sm rounded-3xl border border-white/10 bg-white p-6 shadow-2xl"
			>
				<div className="mb-5 text-center">
					<img src={logo} alt="ParkMate logo" className="mx-auto h-14 w-14" />
					<h1 className="mt-4 text-2xl font-black tracking-tight text-slate-950">Admin sign in</h1>
					<p className="mt-2 text-sm leading-6 text-slate-600">
						Use your ParkMate admin account to access the dashboard and parking zone review tools.
					</p>
				</div>

				<div className="space-y-3.5">
					<div className="space-y-2">
						<label className="block text-sm font-semibold text-gray-700">
							Email
						</label>
						<input
							required
							name="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="admin@getparkmate.app"
							className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
						/>
					</div>

					<div className="space-y-2">
						<label className="block text-sm font-semibold text-gray-700">
							Password
						</label>
						<input
							required
							name="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Enter your password"
							className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
						/>
					</div>

					{error && (
						<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
							{error}
						</div>
					)}

					{!isSupabaseConfigured && !error && (
						<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
							Supabase Auth is not configured for this deployment yet.
						</div>
					)}

					<button
						type="submit"
						disabled={loading || !isSupabaseConfigured}
						className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
					>
						{loading ? 'Signing in...' : 'Sign in'}
					</button>

					<p className="mt-3 text-center text-sm text-gray-600">
						Need an account?{' '}
						<a
							href={`/account/signup${typeof window !== 'undefined' ? window.location.search : ''}`}
							className="font-semibold text-cyan-700 hover:text-cyan-800 hover:underline"
						>
							Create one
						</a>
					</p>
				</div>
			</form>
		</div>
	);
}
