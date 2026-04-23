import { useEffect, useState } from 'react';
import { BarChart3, Download, RefreshCw, TrendingUp, Users } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Badge, Button, Card, Heading, Text } from '@/components/ui';
import { fetchAdminJson } from '@/utils/admin-api';

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

export default function AnalyticsPage() {
  const [response, setResponse] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchAdminJson<AnalyticsResponse>('/api/admin/analytics');
      setResponse(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const summary = response?.summary;

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Heading level={1}>Platform Analytics</Heading>
            <Text variant="body" className="mt-1">
              Real usage and moderation volume pulled from users, zones, live reports, and suggested zones.
            </Text>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={loadAnalytics}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" disabled>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            { label: 'Total Users', value: summary?.total_users ?? 0, icon: Users, color: 'text-blue-600' },
            { label: 'Live Reports Available', value: summary?.live_reports_available ?? 0, icon: TrendingUp, color: 'text-emerald-600' },
            { label: 'Pending Suggestions', value: summary?.pending_suggestions ?? 0, icon: BarChart3, color: 'text-slate-900' },
          ].map((item) => (
            <Card key={item.label} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <Text variant="tiny">{item.label}</Text>
                  <div className={`mt-2 text-3xl font-black tracking-tight ${item.color}`}>{item.value}</div>
                </div>
                <item.icon className="h-6 w-6 text-slate-300" />
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <Card className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <Heading level={2}>Suggestions over last 7 days</Heading>
              <Badge variant="info">Suggested Zones</Badge>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={response?.charts?.suggestionsByDay || []}>
                  <defs>
                    <linearGradient id="suggestionsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f172a" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="suggestions" stroke="#0f172a" strokeWidth={3} fill="url(#suggestionsFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <Heading level={2}>Live reports over last 7 days</Heading>
              <Badge variant="neutral">Live Reports</Badge>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={response?.charts?.reportsByDay || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="reports" fill="#0f172a" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <Card className="p-6">
            <Heading level={2}>Top Zones by Report Volume</Heading>
            <div className="mt-6 space-y-4">
              {(response?.topZones || []).map((zone) => (
                <div key={zone.zone_name} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{zone.zone_name}</div>
                    <Text variant="small" className="mt-1">
                      Live reports attached to this zone
                    </Text>
                  </div>
                  <div className="text-xl font-black text-slate-900">{zone.report_count}</div>
                </div>
              ))}
              {!loading && (response?.topZones?.length ?? 0) === 0 ? (
                <Text variant="body">No zone activity has been recorded yet.</Text>
              ) : null}
            </div>
          </Card>

          <Card className="p-6">
            <Heading level={2}>Top Contributors</Heading>
            <div className="mt-6 space-y-4">
              {(response?.topContributors || []).map((user) => (
                <div key={user.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{user.full_name || user.email || 'Unknown user'}</div>
                      <Text variant="small" className="mt-1">
                        {user.total_reports} reports • {user.total_suggestions} suggestions
                      </Text>
                    </div>
                    <div className="text-xl font-black text-slate-900">{user.total_activity}</div>
                  </div>
                </div>
              ))}
              {!loading && (response?.topContributors?.length ?? 0) === 0 ? (
                <Text variant="body">No contributor activity has been recorded yet.</Text>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
