'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import useAuth from '@/utils/useAuth';
import logo from '@/__create/parkmate-logo.png';
import { useSupabaseAuth } from '@/utils/supabase-auth';

export default function SignUp() {
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');

	const { isLoading: isAuthLoading, session } = useSupabaseAuth();
	const { signUpWithCredentials } = useAuth();

	useEffect(() => {
		if (typeof window === 'undefined' || isAuthLoading || !session) {
			return;
		}

		const urlParams = new URLSearchParams(window.location.search);
		const callbackUrl = urlParams.get('callbackUrl') || '/admin';
		window.location.replace(callbackUrl);
	}, [isAuthLoading, session]);

	const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		setSuccess(null);

		if (!email || !password) {
			setError('Please fill in all fields');
			setLoading(false);
			return;
		}

		if (password.length < 6) {
			setError('Password must be at least 6 characters');
			setLoading(false);
			return;
		}

		try {
			const urlParams = new URLSearchParams(window.location.search);
			const callbackUrl = urlParams.get('callbackUrl') || '/admin';

			const result = await signUpWithCredentials({
				email,
				password,
				callbackUrl,
				redirect: true,
			});

			if (result?.requiresEmailConfirmation) {
				setSuccess('Check your email to confirm your account, then sign in.');
				setLoading(false);
			}
		} catch (err) {
			const errorMessages = {
				'User already registered':
					'This email is already registered. Try signing in instead.',
				'Password should be at least 6 characters':
					'Password must be at least 6 characters.',
			};
			const errorMessage = err instanceof Error ? err.message : '';

			setError(
				errorMessages[errorMessage as keyof typeof errorMessages] || 'Something went wrong. Please try again.',
			);
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
					<h1 className="mt-4 text-2xl font-black tracking-tight text-slate-950">Create admin account</h1>
					<p className="mt-2 text-sm leading-6 text-slate-600">
						Create a login for the admin web. Access to admin tools still requires your email to be
						allowlisted.
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
							placeholder="At least 6 characters"
							className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
						/>
					</div>

					{error && (
						<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
							{error}
						</div>
					)}

					{success && (
						<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
							{success}
						</div>
					)}

					<button
						type="submit"
						disabled={loading}
						className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
					>
						{loading ? 'Creating account...' : 'Create account'}
					</button>

					<p className="mt-3 text-center text-sm text-gray-600">
						Already have an account?{' '}
						<a
							href={`/account/signin${typeof window !== 'undefined' ? window.location.search : ''}`}
							className="font-semibold text-cyan-700 hover:text-cyan-800 hover:underline"
						>
							Sign in
						</a>
					</p>
				</div>
			</form>
		</div>
	);
}
