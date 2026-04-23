import { useEffect, useState } from 'react';
import { AlertTriangle, Clock3, MapPin, RefreshCw, Users } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Badge, Button, Card, Heading, Text } from '@/components/ui';
import { fetchAdminJson } from '@/utils/admin-api';

type DashboardResponse = {
  summary: {
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
  } | null;
  suggestions: Array<{
    id: number;
    zone_name: string | null;
    street_name: string | null;
    area_name: string | null;
    status: string;
    confirmation_count: number;
    false_flag_count: number;
    suggested_zone_type: string | null;
    estimated_capacity_spaces: number | null;
    created_at: string;
    latitude: number | null;
    longitude: number | null;
    submitter_email: string | null;
    submitter_name: string | null;
  }>;
};

type AnalyticsResponse = {
  summary: {
    total_users: number;
    new_users_30d: number;
    total_zones: number;
    live_reports_available: number;
    total_suggestions: number;
    pending_suggestions: number;
  } | null;
  charts: {
    suggestionsByDay: Array<{ label: string; suggestions: number }>;
    reportsByDay: Array<{ label: string; reports: number }>;
  };
  topZones: Array<{ zone_name: string; report_count: number }>;
  topContributors: Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    total_reports: number;
    total_suggestions: number;
    total_activity: number;
  }>;
};

function formatRelativeTime(value: string | null) {
  if (!value) {
    return 'No activity yet';
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return 'Unknown time';
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) {
    return 'Just now';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatZoneLabel(suggestion: DashboardResponse['suggestions'][number]) {
  return suggestion.zone_name || suggestion.street_name || suggestion.area_name || 'Unnamed suggestion';
}

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);

    try {
      const [dashboardResult, analyticsResult] = await Promise.all([
        fetchAdminJson<DashboardResponse>('/api/admin/dashboard'),
        fetchAdminJson<AnalyticsResponse>('/api/admin/analytics'),
      ]);

      setDashboard(dashboardResult);
      setAnalytics(analyticsResult);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const summary = dashboard?.summary;
  const analyticsSummary = analytics?.summary;
  const suggestionSeries = analytics?.charts?.suggestionsByDay || [];
  const reportSeries = analytics?.charts?.reportsByDay || [];
  const recentSuggestions = dashboard?.suggestions || [];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Heading level={1}>Operational Overview</Heading>
            <Text variant="body" className="mt-2">
              Real admin metrics for users, parking zones, live reports, and suggested parking zone intake.
            </Text>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="info">Live backend data</Badge>
            <Button variant="outline" size="sm" onClick={loadDashboard}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'Total Users',
              value: analyticsSummary?.total_users ?? 0,
              detail: `${analyticsSummary?.new_users_30d ?? 0} joined in the last 30 days`,
              icon: Users,
              tone: 'bg-blue-50 text-blue-700',
            },
            {
              label: 'Parking Zones',
              value: analyticsSummary?.total_zones ?? 0,
              detail: `${summary?.live_zone_count ?? 0} approved from suggestions`,
              icon: MapPin,
              tone: 'bg-emerald-50 text-emerald-700',
            },
            {
              label: 'Pending Suggestions',
              value: summary?.pending_count ?? analyticsSummary?.pending_suggestions ?? 0,
              detail: summary?.oldest_pending_at ? `Oldest pending ${formatRelativeTime(summary.oldest_pending_at)}` : 'Queue is clear',
              icon: Clock3,
              tone: 'bg-amber-50 text-amber-700',
            },
            {
              label: 'Active Live Reports',
              value: analyticsSummary?.live_reports_available ?? 0,
              detail: `${summary?.total_false_flags ?? 0} false flags logged`,
              icon: AlertTriangle,
              tone: 'bg-rose-50 text-rose-700',
            },
          ].map((item) => (
            <Card key={item.label} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Text variant="tiny">{item.label}</Text>
                  <div className="mt-2 text-3xl font-black tracking-tight text-slate-900">{item.value}</div>
                  <Text variant="small" className="mt-2">
                    {item.detail}
                  </Text>
                </div>
                <div className={`rounded-2xl p-3 ${item.tone}`}>
                  <item.icon className="h-5 w-5" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
          <Card className="xl:col-span-2 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <Heading level={2}>Suggestion Intake</Heading>
                <Text variant="small" className="mt-1">
                  Submissions received over the last 7 days.
                </Text>
              </div>
              <Badge variant="warning">{summary?.total_suggestions ?? 0} total</Badge>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={suggestionSeries}>
                  <defs>
                    <linearGradient id="dashboardSuggestionsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f172a" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="suggestions" stroke="#0f172a" strokeWidth={3} fill="url(#dashboardSuggestionsFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <Heading level={2}>Queue Snapshot</Heading>
            <div className="mt-6 space-y-4">
              {[
                { label: 'Pending', value: summary?.pending_count ?? 0, variant: 'warning' as const },
                { label: 'Reviewing', value: summary?.reviewing_count ?? 0, variant: 'info' as const },
                { label: 'Approved', value: summary?.approved_count ?? 0, variant: 'success' as const },
                { label: 'Rejected', value: summary?.rejected_count ?? 0, variant: 'danger' as const },
                { label: 'Contributors', value: summary?.contributor_count ?? 0, variant: 'neutral' as const },
                { label: 'Confirmations', value: summary?.total_confirmations ?? 0, variant: 'neutral' as const },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="text-sm font-semibold text-slate-700">{item.label}</div>
                  <div className="flex items-center gap-3">
                    <Badge variant={item.variant}>{item.label}</Badge>
                    <div className="text-xl font-black text-slate-900">{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
          <Card className="xl:col-span-2 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <Heading level={2}>Live Reports Last 7 Days</Heading>
                <Text variant="small" className="mt-1">
                  Fresh report volume from the live reports table.
                </Text>
              </div>
              <Badge variant="neutral">{analyticsSummary?.live_reports_available ?? 0} active now</Badge>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportSeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <Tooltip />
                  <Bar dataKey="reports" fill="#0f172a" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <Heading level={2}>Top Contributors</Heading>
            <div className="mt-6 space-y-4">
              {(analytics?.topContributors || []).slice(0, 5).map((user) => (
                <div key={user.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm font-bold text-slate-900">{user.full_name || user.email || 'Unknown user'}</div>
                  <Text variant="small" className="mt-1">
                    {user.total_reports} reports • {user.total_suggestions} suggestions
                  </Text>
                  <div className="mt-3 text-lg font-black text-slate-900">{user.total_activity}</div>
                </div>
              ))}
              {!loading && (analytics?.topContributors?.length ?? 0) === 0 ? (
                <Text variant="body">No contributor activity has been recorded yet.</Text>
              ) : null}
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <Heading level={2}>Latest Suggested Zones</Heading>
              <Text variant="small" className="mt-1">
                The newest pending and reviewing items from the admin queue.
              </Text>
            </div>
            <Badge variant="warning">{recentSuggestions.length} shown</Badge>
          </div>
          <div className="space-y-4">
            {recentSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="truncate text-sm font-bold text-slate-900">{formatZoneLabel(suggestion)}</div>
                    <Badge variant={suggestion.status === 'pending' ? 'warning' : 'info'}>{suggestion.status}</Badge>
                  </div>
                  <Text variant="small" className="mt-2">
                    {suggestion.submitter_name || suggestion.submitter_email || 'Unknown contributor'}
                    {' • '}
                    {suggestion.suggested_zone_type || 'Unknown type'}
                    {' • '}
                    {formatRelativeTime(suggestion.created_at)}
                  </Text>
                </div>
                <div className="flex items-center gap-6 text-sm font-semibold text-slate-700">
                  <span>{suggestion.confirmation_count} confirmations</span>
                  <span>{suggestion.false_flag_count} false flags</span>
                  <span>{suggestion.estimated_capacity_spaces ?? '—'} spaces</span>
                </div>
              </div>
            ))}
            {!loading && recentSuggestions.length === 0 ? (
              <Text variant="body">No pending or reviewing suggestions are waiting in the queue.</Text>
            ) : null}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
