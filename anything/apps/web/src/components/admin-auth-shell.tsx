'use client';

import type { ReactNode } from 'react';
import logo from '@/__create/parkmate-logo.png';

type AdminAuthShellProps = {
	eyebrow: string;
	title: string;
	description: string;
	children: ReactNode;
};

export default function AdminAuthShell({
	eyebrow,
	title,
	description,
	children,
}: AdminAuthShellProps) {
	return (
		<div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.24),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.18),_transparent_28%)]" />
			<div className="absolute left-[-10%] top-[-8rem] h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
			<div className="absolute bottom-[-8rem] right-[-6%] h-80 w-80 rounded-full bg-sky-500/12 blur-3xl" />

			<div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
				<div className="grid w-full overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/75 shadow-2xl shadow-cyan-950/30 backdrop-blur lg:grid-cols-[1.05fr_0.95fr]">
					<div className="border-b border-white/10 px-7 py-8 sm:px-10 sm:py-10 lg:border-b-0 lg:border-r">
						<div className="flex items-center gap-4">
							<div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-300/20 bg-white/5 shadow-lg shadow-cyan-950/20">
								<img src={logo} alt="ParkMate logo" className="h-11 w-11" />
							</div>
							<div>
								<p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-300/80">
									ParkMate Admin
								</p>
								<h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
									{title}
								</h1>
							</div>
						</div>

						<p className="mt-6 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
							{description}
						</p>

						<div className="mt-8 grid gap-4 sm:grid-cols-2">
							<div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
								<div className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">
									Interface
								</div>
								<div className="mt-2 text-lg font-bold text-white">Admin-only web</div>
								<p className="mt-2 text-sm leading-6 text-slate-400">
									This surface is reserved for internal operations, review queues, and dashboard
									workflows.
								</p>
							</div>
							<div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
								<div className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">
									Access
								</div>
								<div className="mt-2 text-lg font-bold text-white">Supabase secured</div>
								<p className="mt-2 text-sm leading-6 text-slate-400">
									Sign in with an approved ParkMate admin email to continue into the review tools.
								</p>
							</div>
						</div>

						<div className="mt-8 rounded-[24px] border border-cyan-400/20 bg-cyan-400/10 p-4">
							<div className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-200">
								{eyebrow}
							</div>
							<p className="mt-2 text-sm leading-6 text-cyan-50/90">
								Use the same credentials flow tied to ParkMate branding and admin access control.
							</p>
						</div>
					</div>

					<div className="px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
						<div className="mx-auto w-full max-w-md">{children}</div>
					</div>
				</div>
			</div>
		</div>
	);
}
