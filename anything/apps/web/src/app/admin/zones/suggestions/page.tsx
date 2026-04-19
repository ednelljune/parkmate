'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSupabaseAuth } from '@/utils/supabase-auth';

const STATUS_OPTIONS = ['pending', 'reviewing', 'approved', 'rejected'];

const DEFAULT_APPROVAL_FORM = {
  zoneName: '',
  zoneType: 'Public',
  capacitySpaces: '',
  rulesDescription: '',
  reviewNotes: '',
  latOffset: '0.00045',
  lngOffset: '0.00055',
};

function formatDate(value) {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleString();
}

export default function AdminZoneSuggestionsPage() {
  const { isLoading, session, user } = useSupabaseAuth();
  const [status, setStatus] = useState('pending');
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [activeSuggestionId, setActiveSuggestionId] = useState(null);
  const [approvalForm, setApprovalForm] = useState(DEFAULT_APPROVAL_FORM);
  const [submittingAction, setSubmittingAction] = useState(false);

  const activeSuggestion = useMemo(
    () => suggestions.find((item) => item.id === activeSuggestionId) || null,
    [activeSuggestionId, suggestions],
  );

  const getAccessToken = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    const { data, error: sessionError } = await client.auth.getSession();
    if (sessionError) {
      throw sessionError;
    }

    const accessToken = data.session?.access_token;
    if (!accessToken) {
      throw new Error('You must be signed in to use admin review.');
    }

    return accessToken;
  }, []);

  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`/api/admin/zones/suggestions?status=${status}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = await response.json();
      if (!response.ok || result?.success === false) {
        throw new Error(result?.message || result?.error || 'Failed to load suggestions.');
      }

      setSuggestions(Array.isArray(result.suggestions) ? result.suggestions : []);
    } catch (loadError) {
      setSuggestions([]);
      setError(loadError.message || 'Failed to load suggestions.');
    } finally {
      setLoadingSuggestions(false);
    }
  }, [getAccessToken, status]);

  useEffect(() => {
    if (!session) {
      return;
    }

    loadSuggestions();
  }, [loadSuggestions, session]);

  useEffect(() => {
    if (!activeSuggestion) {
      return;
    }

    setApprovalForm((current) => ({
      ...current,
      zoneName: activeSuggestion.area_name || current.zoneName || '',
    }));
  }, [activeSuggestion]);

  const openApprovePanel = (suggestion) => {
    setActiveSuggestionId(suggestion.id);
    setApprovalForm({
      ...DEFAULT_APPROVAL_FORM,
      zoneName: suggestion.area_name || '',
    });
  };

  const runAction = async (suggestionId, payload) => {
    setSubmittingAction(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`/api/admin/zones/suggestions/${suggestionId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok || result?.success === false) {
        throw new Error(result?.message || result?.error || 'Action failed.');
      }

      setActiveSuggestionId(null);
      setApprovalForm(DEFAULT_APPROVAL_FORM);
      await loadSuggestions();
    } catch (actionError) {
      setError(actionError.message || 'Action failed.');
    } finally {
      setSubmittingAction(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-slate-950 text-white p-8">Loading admin tools...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8">
          <h1 className="text-3xl font-black tracking-tight">Zone Suggestion Review</h1>
          <p className="mt-3 text-sm text-slate-300">
            Sign in on the web first, then reload this page.
          </p>
          <a
            href="/account/signin?callbackUrl=/admin/zones/suggestions"
            className="mt-6 inline-flex rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_32%),linear-gradient(180deg,#020617_0%,#0f172a_45%,#111827_100%)] text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-[28px] border border-cyan-400/20 bg-slate-900/70 p-7 shadow-2xl shadow-cyan-950/30 backdrop-blur">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-300/80">
                Admin Review
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight">Missing Public Zone Suggestions</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Review coordinate-based zone suggestions from the mobile app, approve them into live
                parking zones, or reject them with notes.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
              Signed in as <span className="font-semibold text-white">{user?.email || 'Unknown'}</span>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStatus(option)}
                className={`rounded-2xl px-4 py-2 text-sm font-bold capitalize transition ${
                  status === option
                    ? 'bg-cyan-400 text-slate-950'
                    : 'border border-white/10 bg-white/5 text-slate-200 hover:border-cyan-300/30'
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
            <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h2 className="text-lg font-bold capitalize">{status} suggestions</h2>
                <button
                  type="button"
                  onClick={loadSuggestions}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-200"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {loadingSuggestions ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                    Loading suggestions...
                  </div>
                ) : null}

                {!loadingSuggestions && suggestions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
                    No suggestions found for this status.
                  </div>
                ) : null}

                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-cyan-400/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">
                            #{suggestion.id}
                          </span>
                          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-200">
                            {suggestion.status}
                          </span>
                        </div>

                        <h3 className="mt-3 text-lg font-bold text-white">
                          {suggestion.area_name || 'Unnamed suggestion'}
                        </h3>
                        <p className="mt-1 text-sm text-slate-300">
                          {Number(suggestion.latitude).toFixed(6)}, {Number(suggestion.longitude).toFixed(6)}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          Submitted by {suggestion.submitter_name || suggestion.submitter_email || 'Unknown'} on{' '}
                          {formatDate(suggestion.created_at)}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Confirmations</div>
                          <div className="mt-1 text-base font-bold text-white">{suggestion.confirmation_count}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">False Flags</div>
                          <div className="mt-1 text-base font-bold text-white">{suggestion.false_flag_count}</div>
                        </div>
                      </div>
                    </div>

                    {suggestion.review_notes ? (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Review Notes</div>
                        <div className="mt-2">{suggestion.review_notes}</div>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => openApprovePanel(suggestion)}
                        className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => runAction(suggestion.id, { action: 'review' })}
                        disabled={submittingAction}
                        className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-100"
                      >
                        Mark Reviewing
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runAction(suggestion.id, {
                            action: 'reject',
                            reviewNotes: 'Rejected during admin review.',
                          })
                        }
                        disabled={submittingAction}
                        className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-2 text-sm font-bold text-rose-100"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-5">
              <h2 className="text-lg font-bold">Approval panel</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Select a suggestion and publish it as a live parking zone. This first version creates
                a box-shaped zone around the reported coordinates.
              </p>

              {!activeSuggestion ? (
                <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                  Pick a suggestion from the left to approve it.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Selected suggestion</div>
                    <div className="mt-2 text-base font-bold text-white">
                      {activeSuggestion.area_name || `Suggestion #${activeSuggestion.id}`}
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      {Number(activeSuggestion.latitude).toFixed(6)}, {Number(activeSuggestion.longitude).toFixed(6)}
                    </div>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                      Zone name
                    </span>
                    <input
                      value={approvalForm.zoneName}
                      onChange={(event) =>
                        setApprovalForm((current) => ({ ...current, zoneName: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                        Zone type
                      </span>
                      <input
                        value={approvalForm.zoneType}
                        onChange={(event) =>
                          setApprovalForm((current) => ({ ...current, zoneType: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                        Capacity spaces
                      </span>
                      <input
                        value={approvalForm.capacitySpaces}
                        onChange={(event) =>
                          setApprovalForm((current) => ({ ...current, capacitySpaces: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                        Lat offset
                      </span>
                      <input
                        value={approvalForm.latOffset}
                        onChange={(event) =>
                          setApprovalForm((current) => ({ ...current, latOffset: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                        Lng offset
                      </span>
                      <input
                        value={approvalForm.lngOffset}
                        onChange={(event) =>
                          setApprovalForm((current) => ({ ...current, lngOffset: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                      Rules description
                    </span>
                    <textarea
                      value={approvalForm.rulesDescription}
                      onChange={(event) =>
                        setApprovalForm((current) => ({ ...current, rulesDescription: event.target.value }))
                      }
                      rows={4}
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                      Review notes
                    </span>
                    <textarea
                      value={approvalForm.reviewNotes}
                      onChange={(event) =>
                        setApprovalForm((current) => ({ ...current, reviewNotes: event.target.value }))
                      }
                      rows={3}
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        runAction(activeSuggestion.id, {
                          action: 'approve',
                          ...approvalForm,
                        })
                      }
                      disabled={submittingAction}
                      className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950"
                    >
                      {submittingAction ? 'Submitting...' : 'Approve and publish'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSuggestionId(null);
                        setApprovalForm(DEFAULT_APPROVAL_FORM);
                      }}
                      className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

