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

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
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
  const totalSuggestions = summary?.total_suggestions ?? 0;
  const pendingCount = summary?.pending_count ?? 0;
  const reviewingCount = summary?.reviewing_count ?? 0;
  const approvedCount = summary?.approved_count ?? 0;
  const rejectedCount = summary?.rejected_count ?? 0;
  const approvalRate = totalSuggestions > 0 ? (approvedCount / totalSuggestions) * 100 : 0;
  const queueLoadLabel =
    pendingCount >= 10 ? 'High load' : pendingCount >= 4 ? 'Moderate load' : 'Stable load';
  const queueLoadTone =
    pendingCount >= 10
      ? 'border-amber-300/30 bg-amber-400/12 text-amber-100'
      : pendingCount >= 4
        ? 'border-cyan-300/30 bg-cyan-400/12 text-cyan-100'
        : 'border-emerald-300/30 bg-emerald-400/12 text-emerald-100';
  const stats = [
    {
      label: 'Pending review',
      value: pendingCount,
      tone: 'border-amber-300/20 bg-amber-400/10 text-amber-100',
    },
    {
      label: 'Reviewing',
      value: reviewingCount,
      tone: 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100',
    },
    {
      label: 'Approved',
      value: approvedCount,
      tone: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
    },
    {
      label: 'Rejected',
      value: rejectedCount,
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#020617_0%,#07111f_42%,#0f172a_100%)] text-white">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
          <section className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/75 shadow-2xl shadow-cyan-950/20">
            <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(15,23,42,0.72))] px-6 py-6 sm:px-7">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-cyan-300/80">Operations</p>
                  <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-[2.2rem]">
                    Suggested missing parking zones
                  </h1>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    Review live submission pressure, surface the oldest unworked items, and move straight into
                    the moderation queue without digging through generic dashboard panels.
                  </p>
                </div>

                <div className="grid gap-3 sm:min-w-[260px]">
                  <div className={`rounded-2xl border px-4 py-3 ${queueLoadTone}`}>
                    <div className="text-[10px] font-bold uppercase tracking-[0.22em] opacity-80">Queue load</div>
                    <div className="mt-2 text-lg font-bold">{queueLoadLabel}</div>
                    <div className="mt-1 text-sm opacity-90">
                      {pendingCount} pending and {reviewingCount} reviewing right now
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                    Signed in as <span className="font-semibold text-white">{user?.email || 'Unknown'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
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
            </div>

            {error ? (
              <div className="border-b border-rose-400/20 bg-rose-500/10 px-6 py-3 text-sm text-rose-100 sm:px-7">
                {error}
              </div>
            ) : null}

            <div className="px-6 py-6 sm:px-7">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => (
                  <div key={stat.label} className={`rounded-[24px] border p-5 ${stat.tone}`}>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em]">{stat.label}</div>
                    <div className="mt-3 text-4xl font-black tracking-tight">{stat.value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Queue board</div>
                      <h2 className="mt-2 text-xl font-bold text-white">Operational overview</h2>
                    </div>
                    <Link
                      to="/admin/zones/suggestions"
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-100"
                    >
                      Manage
                    </Link>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Total suggestions</div>
                      <div className="mt-2 text-2xl font-black text-white">{totalSuggestions}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Contributors</div>
                      <div className="mt-2 text-2xl font-black text-white">{summary?.contributor_count ?? 0}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Approval rate</div>
                      <div className="mt-2 text-2xl font-black text-white">{formatPercent(approvalRate)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Live zones linked</div>
                      <div className="mt-2 text-2xl font-black text-white">{summary?.live_zone_count ?? 0}</div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Oldest pending</div>
                      <div className="mt-2 text-lg font-bold text-white">{formatRelativeAge(summary?.oldest_pending_at)}</div>
                      <div className="mt-1 text-xs text-slate-400">{formatDate(summary?.oldest_pending_at)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Latest submission</div>
                      <div className="mt-2 text-lg font-bold text-white">{formatRelativeAge(summary?.latest_submission_at)}</div>
                      <div className="mt-1 text-xs text-slate-400">{formatDate(summary?.latest_submission_at)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Signal quality</div>
                      <div className="mt-2 text-lg font-bold text-white">
                        {summary?.total_confirmations ?? 0} confirms / {summary?.total_false_flags ?? 0} false flags
                      </div>
                      <div className="mt-1 text-xs text-slate-400">Crowd feedback attached to the suggestion set</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Action rail</div>
                  <h2 className="mt-2 text-xl font-bold text-white">What needs attention</h2>

                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-amber-50">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-amber-200/80">Immediate queue</div>
                      <div className="mt-2 text-2xl font-black">{pendingCount}</div>
                      <div className="mt-1 text-sm leading-6">
                        Suggestions waiting for a first admin decision.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-cyan-50">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/80">In review</div>
                      <div className="mt-2 text-2xl font-black">{reviewingCount}</div>
                      <div className="mt-1 text-sm leading-6">
                        Suggestions currently being worked and not yet resolved.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Suggested next move</div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        Start with the oldest pending suggestions, then prioritize items with higher confirmation
                        counts so live zones can be published faster.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Resolved share</div>
                          <div className="mt-2 text-lg font-bold text-white">{formatPercent(approvalRate)}</div>
                        </div>
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                            style={{ width: `${Math.min(100, Math.max(0, approvalRate))}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-2 text-xs leading-5 text-slate-400">
                        Share of the suggestion set that has already been approved.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[32px] border border-white/10 bg-slate-900/75 p-5 shadow-2xl shadow-slate-950/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Queue preview</div>
                  <h2 className="mt-2 text-xl font-bold text-white">Live intake</h2>
                </div>
                <Link
                  to="/admin/zones/suggestions"
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-100"
                >
                  Full queue
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {loadingDashboard ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
                    Loading queue preview...
                  </div>
                ) : null}

                {!loadingDashboard && dashboard.suggestions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-slate-400">
                    No pending or reviewing suggestions are waiting right now.
                  </div>
                ) : null}

                {dashboard.suggestions.map((suggestion) => (
                  <div key={suggestion.id} className="rounded-[24px] border border-white/10 bg-slate-950/55 p-4">
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
                      {suggestion.submitter_name || suggestion.submitter_email || 'Unknown'} •{' '}
                      {formatRelativeAge(suggestion.created_at)}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-200">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                        {suggestion.suggested_zone_type || 'No type'}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                        Capacity {suggestion.estimated_capacity_spaces ?? 'N/A'}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                        {suggestion.confirmation_count} confirms
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[32px] border border-white/10 bg-slate-900/75 p-5 shadow-2xl shadow-slate-950/20">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Reference</div>
              <h2 className="mt-2 text-xl font-bold text-white">Admin notes</h2>
              <div className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  Pending suggestions are new submissions that have not been actioned yet.
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  Reviewing suggestions are being checked before approval or rejection.
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  Approved suggestions can already be linked to live parking zone records.
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
