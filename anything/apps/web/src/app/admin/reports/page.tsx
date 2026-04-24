import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Flag, MapPin, RefreshCw, Search } from 'lucide-react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Badge, Button, Card, Heading, Text } from '@/components/ui';
import { fetchAdminJson } from '@/utils/admin-api';
import { useSupabaseAuth } from '@/utils/supabase-auth';

type ReportRecord = {
  id: number;
  effective_status: 'available' | 'claimed' | 'expired';
  parking_type: string | null;
  quantity: number;
  created_at: string | null;
  expires_at: string | null;
  longitude: number;
  latitude: number;
  reporter_name: string | null;
  reporter_email: string | null;
  claimant_name: string | null;
  claimant_email: string | null;
  zone_name: string | null;
  zone_type: string | null;
  false_flag_count: number;
};

type ReportsResponse = {
  summary: {
    total_reports: number;
    claimed_reports: number;
    available_reports: number;
    expired_reports: number;
    total_quantity: number;
  } | null;
  reports: ReportRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
};

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

function getBadgeVariant(status: string) {
  if (status === 'available') {
    return 'success' as const;
  }

  if (status === 'claimed') {
    return 'info' as const;
  }

  return 'warning' as const;
}

export default function ReportsPage() {
  const { session, isLoading: isAuthLoading } = useSupabaseAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [response, setResponse] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchTerm]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!session) {
      setError("Authentication required");
      setLoading(false);
      return;
    }

    const loadReports = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchAdminJson<ReportsResponse>(
          `/api/admin/reports?status=${encodeURIComponent(activeTab)}&search=${encodeURIComponent(debouncedSearchTerm)}&limit=50&page=1`,
          {},
          session?.access_token,
        );
        setResponse(result);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Failed to load reports.');
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [activeTab, debouncedSearchTerm, isAuthLoading, refreshKey, session]);

  const summary = response?.summary;

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Heading level={1}>Live Parking Reports</Heading>
            <Text variant="body" className="mt-1">
              Monitor real parking availability reports, expired items, and false-flag pressure from the backend.
            </Text>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((current) => current + 1)}
            disabled={isAuthLoading || !session}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {[
            { label: 'Total Reports', value: summary?.total_reports ?? 0 },
            { label: 'Available', value: summary?.available_reports ?? 0 },
            { label: 'Claimed', value: summary?.claimed_reports ?? 0 },
            { label: 'Expired', value: summary?.expired_reports ?? 0 },
          ].map((item) => (
            <Card key={item.label} className="p-6">
              <Text variant="tiny">{item.label}</Text>
              <div className="mt-3 text-3xl font-black text-slate-900">{item.value}</div>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1">
            {[
              ['all', 'All'],
              ['available', 'Available'],
              ['claimed', 'Claimed'],
              ['expired', 'Expired'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setActiveTab(value)}
                className={`rounded-xl px-5 py-2 text-xs font-black uppercase tracking-widest transition-all ${
                  activeTab === value ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by zone, reporter, or parking type..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
            />
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        <div className="space-y-4">
          {loading ? (
            <Card className="p-6">
              <Text variant="body">Loading live parking reports...</Text>
            </Card>
          ) : null}

          {!loading && (response?.reports?.length ?? 0) === 0 ? (
            <Card className="p-6">
              <Text variant="body">No reports matched this filter.</Text>
            </Card>
          ) : null}

          {!loading &&
            response?.reports?.map((report) => (
              <Card key={report.id} className="p-6 transition-all hover:border-slate-300">
                <div className="flex flex-col gap-6 lg:flex-row">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-slate-50 p-2 text-slate-500">
                          <Flag className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Text variant="small" className="font-black text-slate-900">
                              {report.zone_name || 'Reported spot'}
                            </Text>
                            <Badge variant={getBadgeVariant(report.effective_status)}>{report.effective_status}</Badge>
                          </div>
                          <Text variant="tiny" className="mt-1">
                            Report #{report.id}
                          </Text>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">{formatDate(report.created_at)}</span>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <Text variant="small" className="font-bold">
                          Reporter
                        </Text>
                        <div className="mt-2 text-sm text-slate-700">
                          {report.reporter_name || report.reporter_email || 'Unknown'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{report.reporter_email || 'No email'}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <Text variant="small" className="font-bold">
                          Claim Status
                        </Text>
                        <div className="mt-2 text-sm text-slate-700">
                          {report.claimant_name || report.claimant_email || 'Not claimed'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">Expires {formatDate(report.expires_at)}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
                      </div>
                      <div>Type: {report.zone_type || report.parking_type || 'Unknown'}</div>
                      <div>Quantity: {report.quantity}</div>
                      <div>False flags: {report.false_flag_count}</div>
                    </div>
                  </div>

                  <div className="flex lg:w-48 lg:flex-col lg:items-center lg:justify-center">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                      <AlertTriangle className="mx-auto h-5 w-5 text-slate-500" />
                      <div className="mt-2 text-xs font-black uppercase tracking-widest text-slate-500">Live backend item</div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
        </div>
      </div>
    </AdminLayout>
  );
}
