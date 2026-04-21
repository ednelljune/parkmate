'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { getApiUrl } from '@/utils/api-base';
import { useSupabaseAuth } from '@/utils/supabase-auth';

type DashboardSummary = {
  total_suggestions: number;
  pending_count: number;
  reviewing_count: number;
  approved_count: number;
  rejected_count: number;
  live_zone_count: number;
  contributor_count: number;
  total_confirmations: number;
  total_false_flags: number;
  latest_submission_at: string | null;
  oldest_pending_at: string | null;
};

type DashboardSuggestion = {
  id: number;
  zone_name: string | null;
  street_name: string | null;
  area_name: string | null;
  status: string;
  confirmation_count: number;
  false_flag_count: number;
  suggested_zone_type: string | null;
  estimated_capacity_spaces: number | null;
  created_at: string | null;
  latitude: number;
  longitude: number;
  submitter_email: string | null;
  submitter_name: string | null;
};

type DashboardResponse = {
  summary: DashboardSummary | null;
  suggestions: DashboardSuggestion[];
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleString();
}

function formatRelativeAge(value: string | null | undefined) {
  if (!value) {
    return 'No data';
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return 'No data';
  }

  const diffMs = Date.now() - timestamp;
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));

  if (diffHours < 1) {
    return 'Less than 1 hour';
  }

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

const EMPTY_DASHBOARD: DashboardResponse = {
  summary: null,
  suggestions: [],
};

export default function AdminDashboardPage() {
  const { isLoading, session, user } = useSupabaseAuth();
  const [dashboard, setDashboard] = useState<DashboardResponse>(EMPTY_DASHBOARD);
  const [error, setError] = useState<string | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  const getAccessToken = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    const { data, error: sessionError } = await client.auth.getSession();
    if (sessionError) {
      throw sessionError;
    }

    const accessToken = data.session?.access_token;
    if (!accessToken) {
      throw new Error('You must be signed in to use admin tools.');
    }

    return accessToken;
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      const response = await fetch(getApiUrl('/api/admin/dashboard'), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = await response.json();
      if (!response.ok || result?.success === false) {
        throw new Error(result?.message || result?.error || 'Failed to load admin dashboard.');
      }

      setDashboard({
        summary: result.summary || null,
        suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
      });
    } catch (loadError) {
      setDashboard(EMPTY_DASHBOARD);
      setError(getErrorMessage(loadError, 'Failed to load admin dashboard.'));
    } finally {
      setLoadingDashboard(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!session) {
      return;
    }

    loadDashboard();
  }, [loadDashboard, session]);

  const summary = dashboard.summary;
  const stats = [
    {
      label: 'Pending review',
      value: summary?.pending_count ?? 0,
      tone: 'border-amber-300/20 bg-amber-400/10 text-amber-100',
    },
    {
      label: 'Reviewing',
      value: summary?.reviewing_count ?? 0,
      tone: 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100',
    },
    {
      label: 'Approved',
      value: summary?.approved_count ?? 0,
      tone: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
    },
    {
      label: 'Rejected',
      value: summary?.rejected_count ?? 0,
      tone: 'border-rose-300/20 bg-rose-500/10 text-rose-100',
    },
  ];

  if (isLoading) {
    return <div className="min-h-screen bg-slate-950 p-8 text-white">Loading admin dashboard...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 p-8 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-300/80">Admin</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">ParkMate admin dashboard</h1>
          <p className="mt-3 text-sm text-slate-300">
            Sign in with an approved admin account to review suggested missing parking zones.
          </p>
          <a
            href="/account/signin?callbackUrl=/admin"
            className="mt-6 inline-flex rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_28%),radial-gradient(circle_at_82%_10%,_rgba(250,204,21,0.14),_transparent_24%),linear-gradient(180deg,#020617_0%,#0f172a_50%,#111827_100%)] text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-[32px] border border-white/10 bg-slate-900/70 p-7 shadow-2xl shadow-cyan-950/30 backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-300/80">Admin Dashboard</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight">Suggested missing parking zones</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Monitor incoming zone suggestions from the app, check queue health, and jump straight into
                review when public parking coverage needs attention.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
              Signed in as <span className="font-semibold text-white">{user?.email || 'Unknown'}</span>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/admin/zones/suggestions"
              className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950"
            >
              Open review queue
            </Link>
            <button
              type="button"
              onClick={loadDashboard}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-slate-100"
            >
              {loadingDashboard ? 'Refreshing...' : 'Refresh dashboard'}
            </button>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className={`rounded-[24px] border p-5 ${stat.tone}`}
              >
                <div className="text-xs font-bold uppercase tracking-[0.18em]">{stat.label}</div>
                <div className="mt-3 text-4xl font-black tracking-tight">{stat.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Queue snapshot</div>
                  <h2 className="mt-2 text-xl font-bold text-white">Suggested zone dashboard</h2>
                </div>
                <Link
                  to="/admin/zones/suggestions"
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-100"
                >
                  Manage
                </Link>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Total suggestions</div>
                  <div className="mt-2 text-2xl font-black text-white">{summary?.total_suggestions ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Contributors</div>
                  <div className="mt-2 text-2xl font-black text-white">{summary?.contributor_count ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Confirmations</div>
                  <div className="mt-2 text-2xl font-black text-white">{summary?.total_confirmations ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">False flags</div>
                  <div className="mt-2 text-2xl font-black text-white">{summary?.total_false_flags ?? 0}</div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Oldest pending</div>
                  <div className="mt-2 text-lg font-bold text-white">
                    {formatRelativeAge(summary?.oldest_pending_at)}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{formatDate(summary?.oldest_pending_at)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Latest submission</div>
                  <div className="mt-2 text-lg font-bold text-white">
                    {formatRelativeAge(summary?.latest_submission_at)}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{formatDate(summary?.latest_submission_at)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Live zones linked</div>
                  <div className="mt-2 text-lg font-bold text-white">{summary?.live_zone_count ?? 0}</div>
                  <div className="mt-1 text-xs text-slate-400">Approved suggestions with live zone records</div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-5">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Review focus</div>
              <h2 className="mt-2 text-xl font-bold text-white">Suggested missing parking zones</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                This section tracks queue pressure and surfaces the most actionable pending or reviewing
                suggestions first.
              </p>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Action needed now</div>
                  <div className="mt-2 text-lg font-bold text-white">
                    {summary?.pending_count ?? 0} suggestions waiting for first admin decision
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">In progress</div>
                  <div className="mt-2 text-lg font-bold text-white">
                    {summary?.reviewing_count ?? 0} suggestions currently in review
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Best next step</div>
                  <div className="mt-2 text-sm leading-6 text-slate-300">
                    Open the review queue, start with the highest-confirmation pending suggestions, and
                    approve public zones that are ready to publish.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[28px] border border-white/10 bg-slate-950/45 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Queue preview</div>
                <h2 className="mt-2 text-xl font-bold text-white">Recent pending and reviewing suggestions</h2>
              </div>
              <Link
                to="/admin/zones/suggestions"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-100"
              >
                Open full queue
              </Link>
            </div>

            <div className="mt-5 space-y-4">
              {loadingDashboard ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
                  Loading queue preview...
                </div>
              ) : null}

              {!loadingDashboard && dashboard.suggestions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
                  No pending or reviewing suggestions are waiting right now.
                </div>
              ) : null}

              {dashboard.suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="grid gap-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 lg:grid-cols-[1.1fr_0.9fr_auto]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-cyan-400/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">
                        #{suggestion.id}
                      </span>
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-200">
                        {suggestion.status}
                      </span>
                    </div>
                    <div className="mt-3 text-lg font-bold text-white">
                      {suggestion.zone_name || suggestion.street_name || suggestion.area_name || 'Unnamed suggestion'}
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      {Number(suggestion.latitude).toFixed(6)}, {Number(suggestion.longitude).toFixed(6)}
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      Submitted by {suggestion.submitter_name || suggestion.submitter_email || 'Unknown'} on{' '}
                      {formatDate(suggestion.created_at)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 self-start text-xs text-slate-200">
                    <span className="rounded-full border border-white/10 bg-slate-900/70 px-2.5 py-1">
                      Type: {suggestion.suggested_zone_type || 'Not set'}
                    </span>
                    <span className="rounded-full border border-white/10 bg-slate-900/70 px-2.5 py-1">
                      Capacity: {suggestion.estimated_capacity_spaces ?? 'Not set'}
                    </span>
                    <span className="rounded-full border border-white/10 bg-slate-900/70 px-2.5 py-1">
                      Confirmations: {suggestion.confirmation_count}
                    </span>
                    <span className="rounded-full border border-white/10 bg-slate-900/70 px-2.5 py-1">
                      False flags: {suggestion.false_flag_count}
                    </span>
                  </div>

                  <div className="flex items-start lg:justify-end">
                    <Link
                      to="/admin/zones/suggestions"
                      className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950"
                    >
                      Review
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
