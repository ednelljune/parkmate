'use client';

import { useEffect } from 'react';
import { Link } from 'react-router';
import { useSupabaseAuth } from '@/utils/supabase-auth';

export default function AdminEntryPage() {
  const { isLoading, session } = useSupabaseAuth();

  useEffect(() => {
    if (typeof window === 'undefined' || isLoading) {
      return;
    }

    const target = session ? '/admin' : '/account/signin?callbackUrl=/admin';
    window.location.replace(target);
  }, [isLoading, session]);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/30">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-300">ParkMate Admin</p>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white">
          {isLoading ? 'Checking session' : 'Redirecting'}
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          {isLoading
            ? 'Loading your admin session.'
            : session
              ? 'Taking you to the admin dashboard.'
              : 'Taking you to the admin login page.'}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/account/signin?callbackUrl=/admin"
            className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950"
          >
            Go to sign in
          </Link>
          <Link
            to="/admin"
            className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-slate-100"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
