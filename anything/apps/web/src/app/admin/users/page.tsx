import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Search, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Avatar, Badge, Button, Card, Heading, Text } from '@/components/ui';
import { fetchAdminJson } from '@/utils/admin-api';

type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  contribution_score: number;
  trust_score: number;
  created_at: string | null;
  total_reports: number;
  total_suggestions: number;
  total_claims: number;
  last_activity_at: string | null;
};

type UsersResponse = {
  summary: {
    total_users: number;
    trusted_users: number;
    low_trust_users: number;
    active_contributors: number;
  } | null;
  users: AdminUser[];
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

function getTrustLabel(score: number) {
  if (score >= 70) {
    return { label: 'Trusted', variant: 'success' as const };
  }

  if (score < 50) {
    return { label: 'Needs review', variant: 'warning' as const };
  }

  return { label: 'Standard', variant: 'neutral' as const };
}

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchAdminJson<UsersResponse>(
          `/api/admin/users?search=${encodeURIComponent(searchTerm)}&page=${page}&limit=25`,
        );
        setResponse(result);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Failed to load users.');
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [page, searchTerm]);

  const filteredUsers = useMemo(() => {
    const users = response?.users || [];

    if (statusFilter === 'Trusted') {
      return users.filter((user) => user.trust_score >= 70);
    }

    if (statusFilter === 'Needs review') {
      return users.filter((user) => user.trust_score < 50);
    }

    return users;
  }, [response?.users, statusFilter]);

  const summary = response?.summary;
  const pagination = response?.pagination;
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.limit)) : 1;

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Heading level={1}>User Management</Heading>
            <Text variant="body" className="mt-1">
              Review real ParkMate users, trust levels, and contributor activity from the backend.
            </Text>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPage(1)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-900">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <Text variant="small" className="font-bold">
                  Total Users
                </Text>
                <div className="mt-0.5 text-2xl font-black text-slate-900">{summary?.total_users ?? 0}</div>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <Text variant="small" className="font-bold">
                  Trusted Users
                </Text>
                <div className="mt-0.5 text-2xl font-black text-slate-900">{summary?.trusted_users ?? 0}</div>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <Text variant="small" className="font-bold">
                  Active Contributors
                </Text>
                <div className="mt-0.5 text-2xl font-black text-slate-900">{summary?.active_contributors ?? 0}</div>
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
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(event) => {
                  setPage(1);
                  setSearchTerm(event.target.value);
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-xl border border-slate-100 bg-slate-50 p-1">
                {['All', 'Trusted', 'Needs review'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
                      statusFilter === status ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error ? (
            <div className="border-b border-rose-100 bg-rose-50 px-6 py-3 text-sm text-rose-700">{error}</div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">User</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Trust</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Reports</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Suggestions</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Claims</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                      Loading users...
                    </td>
                  </tr>
                ) : null}

                {!loading && filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                      No users matched this filter.
                    </td>
                  </tr>
                ) : null}

                {!loading &&
                  filteredUsers.map((user) => {
                    const trust = getTrustLabel(user.trust_score);
                    const fallback = (user.full_name || user.email || 'U')[0]?.toUpperCase() || 'U';

                    return (
                      <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar fallback={fallback} className="h-9 w-9 font-black" />
                            <div>
                              <div className="text-sm font-bold text-slate-900">{user.full_name || 'Unnamed user'}</div>
                              <div className="text-xs text-slate-500">{user.email || 'No email'} • Joined {formatDate(user.created_at)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            <Badge variant={trust.variant}>{trust.label}</Badge>
                            <div className="text-xs font-bold text-slate-600">Score {user.trust_score}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-800">{user.total_reports}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-800">{user.total_suggestions}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-800">{user.total_claims}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{formatDate(user.last_activity_at)}</td>
                      </tr>
                    );
                  })}
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
