import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import useAuth from '@/utils/useAuth';
import { formatAuthError } from '@/utils/auth-errors';
import { useSupabaseAuth } from '@/utils/supabase-auth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import AdminAuthShell from '@/components/admin-auth-shell';
import { validateCallbackUrl } from '@/utils/url-validation';

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
		if (isAuthLoading || !session) {
			return;
		}

		const urlParams = new URLSearchParams(window.location.search);
		const callbackUrlParam = urlParams.get('callbackUrl');
		const validatedCallbackUrl = validateCallbackUrl(callbackUrlParam, defaultCallbackUrl);
		window.location.replace(validatedCallbackUrl);
	}, [defaultCallbackUrl, isAuthLoading, session]);

	const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		if (!isSupabaseConfigured) {
			setError(
				'Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.',
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
			const callbackUrlParam = urlParams.get('callbackUrl');
			const validatedCallbackUrl = validateCallbackUrl(callbackUrlParam, defaultCallbackUrl);

			await signInWithCredentials({
				email,
				password,
				callbackUrl: validatedCallbackUrl,
				redirect: true,
			});
		} catch (err) {
			setError(formatAuthError(err, 'Something went wrong. Please try again.'));
			setLoading(false);
		}
	};

	return (
		<AdminAuthShell
			eyebrow="Sign In"
			title="Admin sign in"
			description="Use your ParkMate admin account to access the dashboard and review suggested parking zones."
		>
			<form noValidate onSubmit={onSubmit} className="rounded-[28px] border border-white/10 bg-white p-6 shadow-2xl shadow-slate-950/20 sm:p-7">
				<div className="space-y-4">
					<div className="space-y-2">
						<label className="block text-sm font-semibold text-slate-700">
							Email
						</label>
						<input
							required
							name="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="admin@getparkmate.app"
							className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-500/10"
						/>
					</div>

					<div className="space-y-2">
						<label className="block text-sm font-semibold text-slate-700">
							Password
						</label>
						<input
							required
							name="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Enter your password"
							className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-500/10"
						/>
					</div>

					{error && (
						<div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
							{error}
						</div>
					)}

					{!isSupabaseConfigured && !error && (
						<div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
							Supabase Auth is not configured for this deployment yet.
						</div>
					)}

					<button
						type="submit"
						disabled={loading || !isSupabaseConfigured}
						className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-950/20 transition-all hover:scale-[1.01] hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
					>
						{loading ? 'Signing in...' : 'Sign in'}
					</button>

					<p className="pt-1 text-center text-sm text-slate-600">
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
		</AdminAuthShell>
	);
}
