import { useEffect, useState } from 'react';
import { Database, Lock, Save, Settings as SettingsIcon, Shield, User } from 'lucide-react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Avatar, Badge, Button, Card, Heading, Input, Text } from '@/components/ui';
import { fetchAdminJson } from '@/utils/admin-api';
import { useSupabaseAuth } from '@/utils/supabase-auth';

type SettingsResponse = {
  profile: {
    id: string;
    email: string | null;
    full_name: string | null;
    contribution_score: number;
    trust_score: number;
    created_at: string | null;
    is_admin: boolean;
  };
  system: {
    database_configured: boolean;
    google_maps_configured: boolean;
    api_base_configured: boolean;
    total_users: number;
    total_zones: number;
    total_reports: number;
    total_suggestions: number;
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

export default function SettingsPage() {
  const { session, isLoading: isAuthLoading } = useSupabaseAuth();
  const [activeTab, setActiveTab] = useState('Profile');
  const [response, setResponse] = useState<SettingsResponse | null>(null);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const tabs = [
    { name: 'Profile', icon: User },
    { name: 'Security', icon: Shield },
    { name: 'System', icon: SettingsIcon },
  ];

  const loadSettings = async () => {
    if (isAuthLoading || !session) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchAdminJson<SettingsResponse>('/api/admin/settings', {}, session?.access_token);
      setResponse(result);
      setFullName(result.profile?.full_name || '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!session) {
      setLoading(false);
      return;
    }

    loadSettings();
  }, [isAuthLoading, session]);

  const saveProfile = async () => {
    if (isAuthLoading || !session) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await fetchAdminJson<SettingsResponse>('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ full_name: fullName }),
      }, session?.access_token);
      setResponse(result);
      setSuccess('Profile updated.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  const profile = response?.profile;
  const system = response?.system;

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <Heading level={1}>Account Settings</Heading>
          <Text variant="body" className="mt-1">
            Manage your admin profile and inspect the backend configuration this admin web depends on.
          </Text>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}
        {success ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
        ) : null}

        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="space-y-1 lg:w-64">
            {tabs.map((tab) => (
              <button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                  activeTab === tab.name ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.name}
              </button>
            ))}
          </div>

          <div className="max-w-3xl flex-1 space-y-6">
            {loading ? (
              <Card className="p-8">
                <Text variant="body">Loading settings...</Text>
              </Card>
            ) : null}

            {!loading && activeTab === 'Profile' ? (
              <div className="space-y-6">
                <Card className="p-8">
                  <div className="mb-8 flex flex-col items-center gap-6 border-b border-slate-50 pb-8 sm:flex-row">
                    <Avatar
                      fallback={(profile?.full_name || profile?.email || 'A')[0]?.toUpperCase() || 'A'}
                      className="h-24 w-24 text-2xl font-black ring-4 ring-slate-50"
                    />
                    <div className="space-y-2 text-center sm:text-left">
                      <Heading level={2}>{profile?.full_name || 'Admin User'}</Heading>
                      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                        <Badge variant={profile?.is_admin ? 'info' : 'neutral'}>{profile?.is_admin ? 'Admin Access' : 'Standard Access'}</Badge>
                        <Badge variant="neutral">Joined {formatDate(profile?.created_at)}</Badge>
                      </div>
                      <Text variant="description">{profile?.email || 'No email address found'}</Text>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <Input label="Full Name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
                    <Input label="Email Address" value={profile?.email || ''} readOnly />
                    <Input label="Contribution Score" value={String(profile?.contribution_score ?? 0)} readOnly />
                    <Input label="Trust Score" value={String(profile?.trust_score ?? 0)} readOnly />
                  </div>

                  <div className="mt-8 flex justify-end">
                    <Button onClick={saveProfile} disabled={saving}>
                      <Save className="mr-2 h-4 w-4" />
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </Card>
              </div>
            ) : null}

            {!loading && activeTab === 'Security' ? (
              <Card className="p-8">
                <div className="mb-8 flex items-center gap-3">
                  <div className="rounded-xl bg-slate-900 p-2">
                    <Lock className="h-5 w-5 text-white" />
                  </div>
                  <Heading level={2}>Authentication Security</Heading>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                    <div>
                      <div className="text-sm font-bold text-slate-900">Admin allowlist</div>
                      <Text variant="small" className="mt-1">
                        Access is currently gated by your configured admin email list on the backend.
                      </Text>
                    </div>
                    <Badge variant={profile?.is_admin ? 'success' : 'warning'}>{profile?.is_admin ? 'Allowed' : 'Blocked'}</Badge>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                    <div>
                      <div className="text-sm font-bold text-slate-900">Auth provider</div>
                      <Text variant="small" className="mt-1">
                        Password and session handling are managed through Supabase authentication.
                      </Text>
                    </div>
                    <Badge variant="info">Supabase</Badge>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <Text variant="body">
                      Password changes and MFA enrollment should be managed from the Supabase auth flow rather than this admin panel.
                    </Text>
                  </div>
                </div>
              </Card>
            ) : null}

            {!loading && activeTab === 'System' ? (
              <div className="space-y-6">
                <Card className="p-8">
                  <div className="mb-8 flex items-center gap-3">
                    <div className="rounded-xl bg-slate-900 p-2">
                      <Database className="h-5 w-5 text-white" />
                    </div>
                    <Heading level={2}>System Snapshot</Heading>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <Text variant="small" className="font-bold">
                        Database
                      </Text>
                      <div className="mt-2">
                        <Badge variant={system?.database_configured ? 'success' : 'danger'}>
                          {system?.database_configured ? 'Configured' : 'Missing'}
                        </Badge>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <Text variant="small" className="font-bold">
                        Google Maps
                      </Text>
                      <div className="mt-2">
                        <Badge variant={system?.google_maps_configured ? 'success' : 'warning'}>
                          {system?.google_maps_configured ? 'Configured' : 'Not set'}
                        </Badge>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <Text variant="small" className="font-bold">
                        API Base URL
                      </Text>
                      <div className="mt-2">
                        <Badge variant={system?.api_base_configured ? 'success' : 'warning'}>
                          {system?.api_base_configured ? 'Configured' : 'Not set'}
                        </Badge>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <Text variant="small" className="font-bold">
                        Platform Totals
                      </Text>
                      <div className="mt-2 text-sm text-slate-700">
                        {system?.total_users ?? 0} users • {system?.total_zones ?? 0} zones • {system?.total_reports ?? 0} reports • {system?.total_suggestions ?? 0} suggestions
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
