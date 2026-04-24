import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  X,
  Clock, 
  MapPin, 
  Building2, 
  Car, 
  MessageSquare, 
  Info,
  Maximize2,
  RefreshCw,
  Search
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Card, Heading, Text, Badge, Button, Avatar } from '@/components/ui';
import { cn } from '@/utils/cn';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { getApiUrl } from '@/utils/api-base';
import { useSupabaseAuth } from '@/utils/supabase-auth';

// Types
type Suggestion = {
  id: number;
  zone_name?: string | null;
  street_name?: string | null;
  area_name?: string | null;
  status: string;
  confirmation_count: number;
  false_flag_count: number;
  suggested_zone_type?: string | null;
  estimated_capacity_spaces?: number | null;
  created_at: string | null;
  latitude: number;
  longitude: number;
  submitter_name?: string | null;
  submitter_email?: string | null;
  evidence_photo_url?: string | null;
  description?: string | null;
};

function formatSuggestionLabel(suggestion: Suggestion) {
  return suggestion.zone_name || suggestion.street_name || suggestion.area_name || `Suggestion ${suggestion.id}`;
}

function formatSuggestionDate(value: string | null) {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleDateString();
}

function getStatusBadgeVariant(status: string) {
  if (status === 'pending') {
    return 'warning' as const;
  }

  if (status === 'approved') {
    return 'success' as const;
  }

  if (status === 'reviewing') {
    return 'info' as const;
  }

  return 'danger' as const;
}

export default function SuggestedZonesPage() {
  const { session } = useSupabaseAuth();
  const [status, setStatus] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [photoPreview, setPhotoPreview] = useState<{ url: string; alt: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<'review' | 'reject' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionReasonError, setActionReasonError] = useState<string | null>(null);

  const getAccessToken = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    const { data } = await client.auth.getSession();
    return data.session?.access_token;
  }, []);

  const loadSuggestions = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/admin/zones/suggestions?status=${status}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSuggestions(data.suggestions || []);
      } else {
        throw new Error(data.error || 'Failed to load');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, status, getAccessToken]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  useEffect(() => {
    if (suggestions.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!suggestions.some((suggestion) => suggestion.id === selectedId)) {
      setSelectedId(suggestions[0].id);
    }
  }, [selectedId, suggestions]);

  const filteredSuggestions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return suggestions;
    }

    return suggestions.filter((suggestion) =>
      [
        formatSuggestionLabel(suggestion),
        suggestion.area_name,
        suggestion.submitter_name,
        suggestion.submitter_email,
        suggestion.suggested_zone_type,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [searchTerm, suggestions]);

  const selectedSuggestion = useMemo(() => filteredSuggestions.find((suggestion) => suggestion.id === selectedId) ?? suggestions.find((suggestion) => suggestion.id === selectedId), [filteredSuggestions, selectedId, suggestions]);

  const openPhotoPreview = useCallback((suggestion: Suggestion) => {
    if (!suggestion.evidence_photo_url) {
      return;
    }

    const alt =
      suggestion.zone_name ||
      suggestion.street_name ||
      suggestion.area_name ||
      `Suggestion ${suggestion.id}`;

    setPhotoPreview({ url: suggestion.evidence_photo_url, alt });
  }, []);

  const closePhotoPreview = useCallback(() => {
    setPhotoPreview(null);
  }, []);

  const closeActionDialog = useCallback(() => {
    if (actionLoading) {
      return;
    }

    setPendingAction(null);
    setActionReason('');
    setActionReasonError(null);
  }, [actionLoading]);

  const submitSuggestionAction = useCallback(
    async (action: 'approve' | 'review' | 'reject', reviewNotes?: string) => {
      if (!selectedSuggestion) {
        return;
      }

      setActionLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const token = await getAccessToken();
        const response = await fetch(
          getApiUrl(`/api/admin/zones/suggestions/${selectedSuggestion.id}/action`),
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action,
              reviewNotes,
              zoneName:
                selectedSuggestion.zone_name ||
                selectedSuggestion.street_name ||
                selectedSuggestion.area_name ||
                `Suggested public zone ${selectedSuggestion.id}`,
              zoneType: selectedSuggestion.suggested_zone_type || 'P1',
              capacitySpaces: selectedSuggestion.estimated_capacity_spaces ?? null,
            }),
          },
        );

        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || data?.message || 'Failed to update suggestion.');
        }

        setSuccess(data.message || 'Suggestion updated.');
        await loadSuggestions();
      } catch (err: any) {
        setError(err?.message || 'Failed to update suggestion.');
      } finally {
        setActionLoading(false);
      }
    },
    [getAccessToken, loadSuggestions, selectedSuggestion],
  );

  const openActionDialog = useCallback(
    (action: 'review' | 'reject') => {
      const currentReason = selectedSuggestion?.description || '';
      setPendingAction(action);
      setActionReason('');
      setActionReasonError(null);
    },
    [selectedSuggestion],
  );

  const confirmPendingAction = useCallback(async () => {
    if (!pendingAction) {
      return;
    }

    const normalizedReason = actionReason.trim();
    if (!normalizedReason) {
      setActionReasonError('A reason is required before confirming this action.');
      return;
    }

    setActionReasonError(null);
    await submitSuggestionAction(pendingAction, normalizedReason);
    setPendingAction(null);
    setActionReason('');
  }, [actionReason, pendingAction, submitSuggestionAction]);

  const openMap = useCallback(() => {
    if (!selectedSuggestion || typeof window === 'undefined') {
      return;
    }

    const { latitude, longitude } = selectedSuggestion;
    const label =
      selectedSuggestion.zone_name ||
      selectedSuggestion.street_name ||
      selectedSuggestion.area_name ||
      `Suggestion ${selectedSuggestion.id}`;
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${latitude},${longitude} (${label})`,
    )}`;
    window.open(mapUrl, '_blank', 'noopener,noreferrer');
  }, [selectedSuggestion]);

  useEffect(() => {
    if (!photoPreview || typeof window === 'undefined') {
      return;
    }

                  const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (photoPreview) {
          closePhotoPreview();
          return;
        }

        if (pendingAction) {
          closeActionDialog();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeActionDialog, closePhotoPreview, pendingAction, photoPreview]);

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Heading level={1}>Suggested Zones</Heading>
            <Text variant="body" className="mt-1">Review and verify user-submitted parking locations.</Text>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => loadSuggestions()} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 w-fit">
          {['pending', 'reviewing', 'approved', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "px-6 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
                status === s 
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20" 
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {error && (
          <Card className="p-4 bg-rose-50 border-rose-100 flex items-center gap-3 text-rose-700">
            <XCircle className="w-5 h-5" />
            <Text variant="small" className="font-bold">{error}</Text>
          </Card>
        )}

        {success && (
          <Card className="p-4 bg-emerald-50 border-emerald-100 flex items-center gap-3 text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
            <Text variant="small" className="font-bold">{success}</Text>
          </Card>
        )}

        {/* Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Main List */}
          <div className="xl:col-span-2 space-y-6">
            {loading && !suggestions.length ? (
              <Card className="h-[420px] animate-pulse bg-slate-50" />
            ) : !suggestions.length ? (
              <Card className="p-12 text-center border-dashed">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-slate-300" />
                </div>
                <Heading level={3}>No suggestions found</Heading>
                <Text variant="description" className="mt-2">There are currently no {status} suggestions to review.</Text>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <Heading level={3}>Review Queue</Heading>
                    <Text variant="small" className="mt-1">
                      Click a row to load the preview panel and moderation actions.
                    </Text>
                  </div>
                  <div className="relative w-full md:max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search by zone, area, or submitter..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-100"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70">
                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Request</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Type</th>
                        <th className="hidden px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 lg:table-cell">Submitted By</th>
                        <th className="hidden px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 sm:table-cell">Parking Category</th>
                        <th className="hidden px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 md:table-cell">Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                            Loading suggestions...
                          </td>
                        </tr>
                      ) : null}

                      {!loading && filteredSuggestions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                            No suggestions matched this filter.
                          </td>
                        </tr>
                      ) : null}

                      {!loading &&
                        filteredSuggestions.map((suggestion) => {
                          const isSelected = selectedId === suggestion.id;

                          return (
                            <tr
                              key={suggestion.id}
                              className={cn(
                                'cursor-pointer border-b border-slate-50 transition-colors hover:bg-slate-50',
                                isSelected && 'bg-slate-900 text-white hover:bg-slate-900',
                              )}
                              onClick={() => setSelectedId(suggestion.id)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  setSelectedId(suggestion.id);
                                }
                              }}
                              tabIndex={0}
                              role="button"
                              aria-pressed={isSelected}
                            >
                              <td className="px-5 py-4">
                                <div className="flex items-start gap-3">
                                  <div
                                    className={cn(
                                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-xs font-black',
                                      isSelected ? 'border-white/15 bg-white/10 text-white' : 'border-slate-200 bg-slate-50 text-slate-900',
                                    )}
                                  >
                                    V-{suggestion.id}
                                  </div>
                                  <div className="min-w-0">
                                    <div className={cn('truncate text-sm font-black', isSelected ? 'text-white' : 'text-slate-900')}>
                                      {formatSuggestionLabel(suggestion)}
                                    </div>
                                    <div className={cn('mt-1 text-xs', isSelected ? 'text-white/70' : 'text-slate-500')}>
                                      {suggestion.latitude.toFixed(5)}, {suggestion.longitude.toFixed(5)}
                                    </div>
                                    <div className={cn('mt-2 flex flex-wrap gap-2 text-[11px] lg:hidden', isSelected ? 'text-white/75' : 'text-slate-500')}>
                                      <span>{suggestion.area_name || 'Melbourne Area'}</span>
                                      <span className={cn(isSelected ? 'text-white/45' : 'text-slate-300')}>•</span>
                                      <span>{suggestion.submitter_name || 'Unknown'}</span>
                                      <span className={cn(isSelected ? 'text-white/45' : 'text-slate-300')}>•</span>
                                      <span>{formatSuggestionDate(suggestion.created_at)}</span>
                                    </div>
                                    <div className={cn('mt-2 flex flex-wrap gap-2 text-[11px]', isSelected ? 'text-white/80' : 'text-slate-600')}>
                                      <span className={cn('inline-flex items-center gap-1', isSelected ? 'text-emerald-200' : 'text-emerald-600')}>
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        {suggestion.confirmation_count}
                                      </span>
                                      <span className={cn('inline-flex items-center gap-1', isSelected ? 'text-rose-200' : 'text-rose-500')}>
                                        <XCircle className="h-3.5 w-3.5" />
                                        {suggestion.false_flag_count}
                                      </span>
                                      <span className={cn('inline-flex items-center gap-1 sm:hidden', isSelected ? 'text-white/70' : 'text-slate-500')}>
                                        {suggestion.evidence_photo_url ? 'Photo attached' : 'No photo'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <Badge variant={isSelected ? 'neutral' : 'info'}>{suggestion.suggested_zone_type || 'Unknown'}</Badge>
                              </td>
                              <td className="hidden px-5 py-4 lg:table-cell">
                                <div className="flex items-center gap-3">
                                  <Avatar fallback={suggestion.submitter_name?.[0] || 'U'} className="h-8 w-8 text-[10px]" />
                                  <div className="min-w-0">
                                    <div className={cn('truncate text-sm font-semibold', isSelected ? 'text-white' : 'text-slate-900')}>
                                      {suggestion.submitter_name || 'Unknown'}
                                    </div>
                                    <div className={cn('truncate text-xs', isSelected ? 'text-white/70' : 'text-slate-500')}>
                                      {suggestion.submitter_email || 'No email'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="hidden px-5 py-4 sm:table-cell">
                                <span className={cn('text-sm font-medium', isSelected ? 'text-white/85' : 'text-slate-600')}>
                                  {suggestion.parking_category || 'Unknown'}
                                </span>
                              </td>
                              <td className={cn('hidden px-5 py-4 text-sm md:table-cell', isSelected ? 'text-white/85' : 'text-slate-600')}>
                                {formatSuggestionDate(suggestion.created_at)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>

          {/* Right Detail Panel */}
          <div className="space-y-6">
            <Card className="p-6 sticky top-24">
              {selectedSuggestion ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <Heading level={2}>V-{selectedSuggestion.id}</Heading>
                    <Badge
                      variant={getStatusBadgeVariant(selectedSuggestion.status)}
                    >
                      {selectedSuggestion.status}
                    </Badge>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                           <MapPin className="w-4 h-4 text-slate-900" />
                        </div>
                        <div>
                          <Text variant="tiny">Coordinates</Text>
                          <Text variant="small" className="font-black text-slate-900">
                             {selectedSuggestion.latitude.toFixed(6)}, {selectedSuggestion.longitude.toFixed(6)}
                          </Text>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                           <Car className="w-4 h-4 text-slate-900" />
                        </div>
                        <div>
                          <Text variant="tiny">Est. Capacity</Text>
                          <Text variant="small" className="font-black text-slate-900">
                             {selectedSuggestion.estimated_capacity_spaces || 'Unknown'} spaces
                          </Text>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                       <Text variant="tiny">Description / Evidence</Text>
                       <div className="bg-white border border-slate-100 rounded-2xl p-4 text-sm text-slate-600 leading-relaxed italic">
                          "{selectedSuggestion.description || 'No additional description provided by user.'}"
                       </div>
                    </div>

                    {selectedSuggestion.evidence_photo_url ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Text variant="tiny">Submitted Photo</Text>
                          <Button type="button" variant="outline" size="sm" onClick={() => openPhotoPreview(selectedSuggestion)}>
                            <Maximize2 className="mr-2 h-4 w-4" />
                            View Full Photo
                          </Button>
                        </div>
                        <button
                          type="button"
                          className="block w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-50"
                          onClick={() => openPhotoPreview(selectedSuggestion)}
                        >
                          <img
                            src={selectedSuggestion.evidence_photo_url}
                            alt={`Submitted evidence for ${selectedSuggestion.zone_name || selectedSuggestion.street_name || selectedSuggestion.area_name || `suggestion ${selectedSuggestion.id}`}`}
                            className="h-56 w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                          />
                        </button>
                      </div>
                    ) : null}

                    <div className="space-y-3 pt-4">
                       <Button
                          className="w-full py-6"
                          variant="primary"
                          onClick={() => submitSuggestionAction('approve')}
                          disabled={actionLoading}
                       >
                          <CheckCircle2 className="w-5 h-5 mr-2" />
                          {actionLoading ? 'Working...' : 'Approve Submission'}
                       </Button>
                       <div className="grid grid-cols-2 gap-3">
                          <Button
                             variant="outline"
                             className="w-full"
                             onClick={() => openActionDialog('review')}
                             disabled={actionLoading}
                          >
                             <MessageSquare className="w-4 h-4 mr-2" />
                             Info Required
                          </Button>
                          <Button
                             variant="outline"
                             className="w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-100"
                             onClick={() => openActionDialog('reject')}
                             disabled={actionLoading}
                          >
                             <XCircle className="w-4 h-4 mr-2" />
                             Reject
                          </Button>
                       </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-6">
                    <div className="flex items-center justify-between mb-4">
                       <Text variant="tiny">Location Preview</Text>
                       <button
                          className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-1"
                          onClick={openMap}
                          type="button"
                       >
                          Open Map <Maximize2 className="w-3 h-3" />
                       </button>
                    </div>
                    <button
                      className="aspect-[16/9] w-full bg-slate-900 rounded-2xl overflow-hidden relative group block"
                      onClick={openMap}
                      type="button"
                    >
                       <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+900(0,0)/0,0,1,0/400x300@2x?access_token=pk.xxx')] bg-cover bg-center opacity-70 group-hover:scale-110 transition-transform duration-1000" />
                       <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center animate-pulse">
                             <MapPin className="text-white fill-white" />
                          </div>
                       </div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center flex flex-col items-center gap-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
                     <Info className="w-6 h-6 text-slate-300" />
                  </div>
                  <Text variant="small" className="font-bold max-w-[200px]">
                    Select a suggestion from the list to see detailed verification data
                  </Text>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {photoPreview ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
          onClick={closePhotoPreview}
          role="dialog"
          aria-modal="true"
          aria-label="Submitted evidence photo preview"
        >
          <div
            className="relative w-full max-w-6xl overflow-hidden rounded-3xl bg-slate-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
              <div>
                <div className="text-sm font-black uppercase tracking-widest text-white/70">Submitted Photo</div>
                <div className="mt-1 text-sm text-white">{photoPreview.alt}</div>
              </div>
              <Button type="button" variant="outline" size="sm" className="border-white/20 bg-white/5 text-white hover:bg-white/10" onClick={closePhotoPreview}>
                <X className="mr-2 h-4 w-4" />
                Close
              </Button>
            </div>
            <div className="max-h-[80vh] overflow-auto bg-black">
              <img src={photoPreview.url} alt={photoPreview.alt} className="h-auto max-h-[80vh] w-full object-contain" />
            </div>
          </div>
        </div>
      ) : null}

      {pendingAction ? (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onClick={closeActionDialog}
          role="dialog"
          aria-modal="true"
          aria-label={pendingAction === 'review' ? 'Add info required reason' : 'Add rejection reason'}
        >
          <Card
            className="w-full max-w-xl p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <Heading level={2}>
                  {pendingAction === 'review' ? 'Reason For Info Required' : 'Reason For Rejection'}
                </Heading>
                <Text variant="body" className="mt-2">
                  This note will be saved with the suggestion and shown to the user in their update.
                </Text>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={closeActionDialog} disabled={actionLoading}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-5 space-y-2">
              <Text variant="tiny">Admin Reason</Text>
              <textarea
                value={actionReason}
                onChange={(event) => {
                  setActionReason(event.target.value);
                  if (actionReasonError) {
                    setActionReasonError(null);
                  }
                }}
                placeholder={
                  pendingAction === 'review'
                    ? 'Tell the user what extra details, photos, or corrections are needed...'
                    : 'Tell the user why this suggestion was rejected...'
                }
                className="min-h-36 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
              />
              {actionReasonError ? (
                <Text variant="small" className="text-rose-600">
                  {actionReasonError}
                </Text>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={closeActionDialog} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                type="button"
                variant={pendingAction === 'reject' ? 'danger' : 'primary'}
                onClick={confirmPendingAction}
                disabled={actionLoading}
              >
                {actionLoading
                  ? 'Working...'
                  : pendingAction === 'review'
                  ? 'Confirm Info Required'
                  : 'Confirm Reject'}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </AdminLayout>
  );
}
