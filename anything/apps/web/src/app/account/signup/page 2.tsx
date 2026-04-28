import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { formatAuthError } from '@/utils/auth-errors';
import useAuth from '@/utils/useAuth';
import AdminAuthShell from '@/components/admin-auth-shell';
import { useSupabaseAuth } from '@/utils/supabase-auth';
import { validateCallbackUrl } from '@/utils/url-validation';

export default function SignUp() {
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');

	const { isLoading: isAuthLoading, session } = useSupabaseAuth();
	const { signUpWithCredentials } = useAuth();

	useEffect(() => {
		if (isAuthLoading || !session) {
			return;
		}

		const urlParams = new URLSearchParams(window.location.search);
		const callbackUrlParam = urlParams.get('callbackUrl');
		const validatedCallbackUrl = validateCallbackUrl(callbackUrlParam, '/admin');
		window.location.replace(validatedCallbackUrl);
	}, [isAuthLoading, session]);

	const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		setSuccess(null);

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

		if (password.length < 6) {
			setError('Password must be at least 6 characters');
			setLoading(false);
			return;
		}

		try {
			const urlParams = new URLSearchParams(window.location.search);
			const callbackUrlParam = urlParams.get('callbackUrl');
			const validatedCallbackUrl = validateCallbackUrl(callbackUrlParam, '/admin');

			const result = await signUpWithCredentials({
				email,
				password,
				callbackUrl: validatedCallbackUrl,
				redirect: true,
			});

			if (result?.requiresEmailConfirmation) {
				setSuccess('Check your email to confirm your account, then sign in.');
				setLoading(false);
			}
		} catch (err) {
			setError(formatAuthError(err, 'Something went wrong. Please try again.'));
			setLoading(false);
		}
	};

	return (
		<AdminAuthShell
			eyebrow="Create Account"
			title="Create admin account"
			description="Create a ParkMate admin login using the same branded access flow used across the admin web."
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
									Create your access
								</h2>
							</div>
							<div className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700">
								Admin
							</div>
						</div>
						<p className="mt-3 text-sm leading-6 text-slate-600">
							Set up a ParkMate admin login so approved staff can enter the dashboard and zone review flow.
						</p>
					</div>

					<div className="grid gap-3 sm:grid-cols-2">
						<div className="rounded-[20px] border border-slate-200/80 bg-white/80 px-4 py-3">
							<div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
								Flow
							</div>
							<div className="mt-2 text-sm font-bold text-slate-900">Create then confirm</div>
						</div>
						<div className="rounded-[20px] border border-slate-200/80 bg-white/80 px-4 py-3">
							<div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
								Gate
							</div>
							<div className="mt-2 text-sm font-bold text-slate-900">Allowlist protected</div>
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
							placeholder="At least 6 characters"
							className="w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-all focus:border-cyan-500 focus:bg-cyan-50/30 focus:outline-none focus:ring-4 focus:ring-cyan-500/12"
						/>
					</div>

					{error && (
						<div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
							{error}
						</div>
					)}

					{success && (
						<div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
							{success}
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
						{loading ? 'Creating account...' : 'Create account'}
					</button>

					<div className="rounded-[22px] border border-slate-200/80 bg-white/75 px-4 py-3 text-sm text-slate-600">
						If email confirmation is enabled, confirm the invite first, then return here to sign in and continue into admin.
					</div>

					<p className="pt-1 text-center text-sm text-slate-600">
						Already have an account?{' '}
						<a
							href={`/account/signin${typeof window !== 'undefined' ? window.location.search : ''}`}
							className="font-semibold text-cyan-700 transition hover:text-sky-800 hover:underline"
						>
							Sign in
						</a>
					</p>
				</div>
			</form>
		</AdminAuthShell>
	);
}
