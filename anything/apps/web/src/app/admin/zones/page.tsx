import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Layers, MapPin, RefreshCw, Search } from 'lucide-react';
import { Link } from 'react-router';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Badge, Button, Card, Heading, Text } from '@/components/ui';
import { fetchAdminJson } from '@/utils/admin-api';
import { useSupabaseAuth } from '@/utils/supabase-auth';

type ZoneRecord = {
  id: number;
  name: string;
  zone_type: string;
  capacity_spaces: number | null;
  rules_description: string | null;
  created_at: string | null;
  center_lat: number | null;
  center_lng: number | null;
};

type ZonesResponse = {
  summary: {
    total_zones: number;
    zone_types_count: number;
    total_capacity: number;
  } | null;
  zoneTypes: Array<{ zone_type: string; count: number }>;
  zones: ZoneRecord[];
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

  return date.toLocaleDateString();
}

export default function ZonesPage() {
  const { session, isLoading: isAuthLoading } = useSupabaseAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [zoneTypeFilter, setZoneTypeFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [response, setResponse] = useState<ZonesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!session) {
      setLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchAdminJson<ZonesResponse>(
          `/api/admin/zones?search=${encodeURIComponent(searchTerm)}&zoneType=${encodeURIComponent(zoneTypeFilter)}&page=${page}&limit=25`,
          {},
          session?.access_token,
        );
        setResponse(result);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Failed to load zones.');
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isAuthLoading, page, refreshKey, searchTerm, session, zoneTypeFilter]);

  const zoneTypes = useMemo(
    () => ['All', ...(response?.zoneTypes?.map((item) => item.zone_type).filter(Boolean) ?? [])],
    [response?.zoneTypes],
  );

  const pagination = response?.pagination;
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.limit)) : 1;

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Heading level={1}>Parking Zones</Heading>
            <Text variant="body" className="mt-1">
              Browse live parking zones already imported into the backend and jump into suggested additions.
            </Text>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefreshKey((current) => current + 1)}
              disabled={isAuthLoading || !session}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Link to="/admin/zones/suggestions">
              <Button size="sm">Open Suggested Zones</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-900">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <Text variant="small" className="font-bold">
                  Total Zones
                </Text>
                <div className="mt-0.5 text-2xl font-black text-slate-900">{response?.summary?.total_zones ?? 0}</div>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-sky-50 p-3 text-sky-600">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <Text variant="small" className="font-bold">
                  Zone Types
                </Text>
                <div className="mt-0.5 text-2xl font-black text-slate-900">{response?.summary?.zone_types_count ?? 0}</div>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <Text variant="small" className="font-bold">
                  Total Capacity
                </Text>
                <div className="mt-0.5 text-2xl font-black text-slate-900">{response?.summary?.total_capacity ?? 0}</div>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <div className="space-y-4 border-b border-slate-100 p-6 md:flex md:items-center md:justify-between md:space-y-0">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by zone name or type..."
                value={searchTerm}
                onChange={(event) => {
                  setPage(1);
                  setSearchTerm(event.target.value);
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-100"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {zoneTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setPage(1);
                    setZoneTypeFilter(type);
                  }}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                    zoneTypeFilter === type ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="border-b border-rose-100 bg-rose-50 px-6 py-3 text-sm text-rose-700">{error}</div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Zone</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Type</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Capacity</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Center</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                      Loading zones...
                    </td>
                  </tr>
                ) : null}

                {!loading && (response?.zones?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                      No zones matched this filter.
                    </td>
                  </tr>
                ) : null}

                {!loading &&
                  response?.zones?.map((zone) => (
                    <tr key={zone.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-bold text-slate-900">{zone.name}</div>
                          <div className="text-xs text-slate-500">ID #{zone.id}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="info">{zone.zone_type}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-800">{zone.capacity_spaces ?? 'Unknown'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {zone.center_lat != null && zone.center_lng != null
                          ? `${zone.center_lat.toFixed(5)}, ${zone.center_lng.toFixed(5)}`
                          : 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatDate(zone.created_at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-50 p-6">
            <Text variant="small">
              Showing page {pagination?.page ?? page} of {totalPages}
            </Text>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-9 w-9 p-2" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-9 w-9 p-2" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loading}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
