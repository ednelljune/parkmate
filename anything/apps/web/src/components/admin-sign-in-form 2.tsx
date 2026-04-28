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
			<form
				noValidate
				onSubmit={onSubmit}
				className="rounded-[32px] border border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,248,255,0.96))] p-6 shadow-[0_28px_80px_rgba(2,12,24,0.28)] sm:p-8"
			>
				<div className="space-y-5">
					<div className="rounded-[24px] border border-cyan-100 bg-white/80 p-4 shadow-sm shadow-cyan-950/5">
						<div className="flex items-center justify-between gap-3">
							<div>
								<p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-700/80">
									ParkMate Access
								</p>
								<h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
									Welcome back
								</h2>
							</div>
							<div className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700">
								Admin
							</div>
						</div>
						<p className="mt-3 text-sm leading-6 text-slate-600">
							Sign in to continue into the dashboard, moderation queue, and live zone review tools.
						</p>
					</div>

					<div className="grid gap-3 sm:grid-cols-2">
						<div className="rounded-[20px] border border-slate-200/80 bg-white/80 px-4 py-3">
							<div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
								Surface
							</div>
							<div className="mt-2 text-sm font-bold text-slate-900">Operations dashboard</div>
						</div>
						<div className="rounded-[20px] border border-slate-200/80 bg-white/80 px-4 py-3">
							<div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
								Access
							</div>
							<div className="mt-2 text-sm font-bold text-slate-900">Supabase secured</div>
						</div>
					</div>

					<div className="space-y-2">
						<label className="block text-sm font-semibold text-slate-700/90">
							Email
						</label>
						<input
							required
							name="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="admin@getparkmate.app"
							className="w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-all focus:border-cyan-500 focus:bg-cyan-50/30 focus:outline-none focus:ring-4 focus:ring-cyan-500/12"
						/>
					</div>

					<div className="space-y-2">
						<label className="block text-sm font-semibold text-slate-700/90">
							Password
						</label>
						<input
							required
							name="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Enter your password"
							className="w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-all focus:border-cyan-500 focus:bg-cyan-50/30 focus:outline-none focus:ring-4 focus:ring-cyan-500/12"
						/>
					</div>

					{error && (
						<div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
							{error}
						</div>
					)}

					{!isSupabaseConfigured && !error && (
						<div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
							Supabase Auth is not configured for this deployment yet.
						</div>
					)}

					<button
						type="submit"
						disabled={loading || !isSupabaseConfigured}
						className="w-full rounded-[22px] bg-[linear-gradient(135deg,#0ea5e9,#0f766e_58%,#082f49)] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(14,116,144,0.28)] transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_48px_rgba(14,116,144,0.34)] focus:outline-none focus:ring-4 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
					>
						{loading ? 'Signing in...' : 'Sign in'}
					</button>

					<div className="rounded-[22px] border border-slate-200/80 bg-white/75 px-4 py-3 text-sm text-slate-600">
						Use an allowlisted ParkMate admin email. After authentication, you will be routed directly into the admin workspace.
					</div>

					<p className="pt-1 text-center text-sm text-slate-600">
						Need an account?{' '}
						<a
							href={`/account/signup${typeof window !== 'undefined' ? window.location.search : ''}`}
							className="font-semibold text-cyan-700 transition hover:text-sky-800 hover:underline"
						>
							Create one
						</a>
					</p>
				</div>
			</form>
		</AdminAuthShell>
	);
}
