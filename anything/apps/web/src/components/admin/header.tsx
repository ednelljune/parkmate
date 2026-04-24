import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Bell, LogOut, MapPin, RefreshCw, Users, AlertTriangle } from 'lucide-react';
import { useSupabaseAuth } from '@/utils/supabase-auth';
import { Avatar, Button } from '@/components/ui';
import { cn } from '@/utils/cn';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useNavigate } from 'react-router';
import { fetchAdminJson } from '@/utils/admin-api';

const ADMIN_NOTIFICATIONS_VIEWED_AT_KEY = 'parkmate-admin-notifications-viewed-at';
const ADMIN_NOTIFICATIONS_REFRESH_MS = 30000;

type AdminNotificationItem = {
  notification_id: string;
  notification_type: 'zone_suggestion' | 'report' | 'user';
  entity_id: string;
  href: string;
  title: string | null;
  actor_name: string | null;
  actor_email: string | null;
  zone_name: string | null;
  zone_type: string | null;
  parking_category: string | null;
  status: string;
  confirmation_count: number | null;
  false_flag_count: number | null;
  created_at: string;
};

type AdminNotificationsResponse = {
  summary: {
    totalCount: number;
    zoneSuggestionCount: number;
    reportCount: number;
    userCount: number;
    unreadCount: number;
    latestCreatedAt: string | null;
  };
  notifications: AdminNotificationItem[];
};

function formatNotificationTime(value: string | null) {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function Header() {
  const { user, session } = useSupabaseAuth();
  const navigate = useNavigate();
  const [isSignoutLoading, setIsSignoutLoading] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotificationsResponse | null>(null);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [lastViewedAt, setLastViewedAt] = useState<string | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  const handleSignOut = async () => {
    setIsSignoutLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      navigate('/account/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsSignoutLoading(false);
    }
  };

  const markNotificationsViewed = (value?: string | null) => {
    const resolvedValue = value || notifications?.summary?.latestCreatedAt || null;
    if (!resolvedValue || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(ADMIN_NOTIFICATIONS_VIEWED_AT_KEY, resolvedValue);
    setLastViewedAt(resolvedValue);
    setNotifications((current) =>
      current
        ? {
            ...current,
            summary: {
              ...current.summary,
              unreadCount: 0,
            },
          }
        : current,
    );
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setLastViewedAt(window.localStorage.getItem(ADMIN_NOTIFICATIONS_VIEWED_AT_KEY));
  }, []);

  useEffect(() => {
    if (!session) {
      setNotifications(null);
      setNotificationsLoading(false);
      return;
    }

    let isActive = true;

    const loadNotifications = async () => {
      setNotificationsLoading(true);
      setNotificationsError(null);

      try {
        const params = new URLSearchParams();
        if (lastViewedAt) {
          params.set('since', lastViewedAt);
        }

        const result = await fetchAdminJson<AdminNotificationsResponse>(
          `/api/admin/notifications${params.toString() ? `?${params.toString()}` : ''}`,
          {},
          session.access_token,
        );

        if (!isActive) {
          return;
        }

        setNotifications(result);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setNotificationsError(error instanceof Error ? error.message : 'Failed to load notifications.');
      } finally {
        if (isActive) {
          setNotificationsLoading(false);
        }
      }
    };

    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, ADMIN_NOTIFICATIONS_REFRESH_MS);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [lastViewedAt, session]);

  useEffect(() => {
    if (!isNotificationsOpen) {
      return;
    }

    markNotificationsViewed();
  }, [isNotificationsOpen, notifications?.summary?.latestCreatedAt]);

  useEffect(() => {
    if (!isNotificationsOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (notificationsRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsNotificationsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isNotificationsOpen]);

  const unreadCount = notifications?.summary?.unreadCount ?? 0;
  const totalCount = notifications?.summary?.totalCount ?? 0;
  const zoneSuggestionCount = notifications?.summary?.zoneSuggestionCount ?? 0;
  const reportCount = notifications?.summary?.reportCount ?? 0;
  const userCount = notifications?.summary?.userCount ?? 0;
  const hasUnread = unreadCount > 0;
  const visibleNotifications = notifications?.notifications || [];
  
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex-1 max-w-md relative group">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
        </div>
        <input
          type="text"
          placeholder="Search for zones, users, reports..."
          className="w-full bg-slate-50 border-none rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-950/5 focus:bg-white transition-all outline-none"
        />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative" ref={notificationsRef}>
          <button
            className={cn(
              'p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors relative',
              isNotificationsOpen && 'bg-slate-100 text-slate-900',
            )}
            onClick={() => setIsNotificationsOpen((current) => !current)}
            type="button"
            aria-label="Admin notifications"
          >
            <Bell className="h-5 w-5" />
            {hasUnread ? (
              <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 bg-rose-500 rounded-full border-2 border-white text-[10px] font-black text-white flex items-center justify-center">
                {Math.min(unreadCount, 99)}
              </span>
            ) : null}
          </button>

          {isNotificationsOpen ? (
            <div className="absolute right-0 top-12 w-[360px] rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400">Admin Notifications</div>
                    <div className="mt-2 text-sm font-bold text-slate-900">
                      {totalCount} recent web system {totalCount === 1 ? 'event' : 'events'}
                    </div>
                  </div>
                  {notificationsLoading ? <RefreshCw className="h-4 w-4 animate-spin text-slate-400" /> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
                  <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700">{zoneSuggestionCount} zone suggestions</span>
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">{reportCount} reports</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">{userCount} users</span>
                </div>
              </div>

              <div className="max-h-[420px] overflow-y-auto">
                {notificationsError ? (
                  <div className="px-5 py-4 text-sm text-rose-600">{notificationsError}</div>
                ) : null}

                {!notificationsError && !notificationsLoading && visibleNotifications.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                    <div className="text-sm font-bold text-slate-900">No new system activity</div>
                    <div className="mt-2 text-sm text-slate-500">New users, reports, and zone suggestions will show up here.</div>
                  </div>
                ) : null}

                {visibleNotifications.map((item) => (
                  <button
                    key={item.notification_id}
                    type="button"
                    className="w-full border-b border-slate-100 px-5 py-4 text-left transition-colors hover:bg-slate-50"
                    onClick={() => {
                      markNotificationsViewed(item.created_at);
                      setIsNotificationsOpen(false);
                      navigate(item.href);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'mt-0.5 rounded-2xl p-2',
                          item.notification_type === 'zone_suggestion' && 'bg-sky-50 text-sky-700',
                          item.notification_type === 'report' && 'bg-amber-50 text-amber-700',
                          item.notification_type === 'user' && 'bg-emerald-50 text-emerald-700',
                        )}
                      >
                        {item.notification_type === 'zone_suggestion' ? (
                          <MapPin className="h-4 w-4" />
                        ) : item.notification_type === 'report' ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : (
                          <Users className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate text-sm font-bold text-slate-900">{item.title || item.zone_name || 'System event'}</div>
                          <div className="shrink-0 text-[11px] font-medium text-slate-400">{formatNotificationTime(item.created_at)}</div>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.notification_type === 'zone_suggestion'
                            ? `${item.actor_name || item.actor_email || 'Unknown user'} suggested a missing zone.`
                            : item.notification_type === 'report'
                            ? `${item.actor_name || item.actor_email || 'Unknown user'} created a parking report.`
                            : `${item.actor_name || item.actor_email || 'Unknown user'} joined ParkMate.`}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
                          {item.zone_type ? (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                              {item.zone_type}
                            </span>
                          ) : null}
                          {item.parking_category ? (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                              {item.parking_category}
                            </span>
                          ) : null}
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                            {item.notification_type === 'zone_suggestion'
                              ? 'Suggested Zone'
                              : item.notification_type === 'report'
                              ? 'Live Report'
                              : 'New User'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="border-t border-slate-100 p-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    markNotificationsViewed();
                    setIsNotificationsOpen(false);
                    navigate('/admin');
                  }}
                >
                  Open Admin Dashboard
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        
        <div className="h-8 w-[1px] bg-slate-100 mx-2"></div>

        <div className="flex items-center gap-3 pl-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-900 leading-none">{user?.name || 'Admin User'}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Avatar 
              fallback={user?.email ? user.email[0].toUpperCase() : 'A'} 
              className="ring-2 ring-transparent transition-all"
            />
            <button 
              onClick={handleSignOut}
              disabled={isSignoutLoading}
              className="p-2 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all disabled:opacity-50"
              title="Sign Out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
