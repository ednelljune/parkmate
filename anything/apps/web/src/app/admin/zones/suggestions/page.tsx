import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  PlusCircle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MapPin, 
  User, 
  Building2, 
  Car, 
  MessageSquare, 
  ChevronRight,
  Info,
  Maximize2,
  RefreshCw,
  Search
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Card, Heading, Text, Badge, Button, Input, Avatar } from '@/components/ui';
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

export default function SuggestedZonesPage() {
  const { session } = useSupabaseAuth();
  const [status, setStatus] = useState('pending');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

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

  const selectedSuggestion = useMemo(() => 
    suggestions.find(s => s.id === selectedId), [suggestions, selectedId]
  );

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

        {/* Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Main List */}
          <div className="xl:col-span-2 space-y-6">
            {loading && !suggestions.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map(i => (
                  <Card key={i} className="h-[280px] animate-pulse bg-slate-50" />
                ))}
              </div>
            ) : !suggestions.length ? (
              <Card className="p-12 text-center border-dashed">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-slate-300" />
                </div>
                <Heading level={3}>No suggestions found</Heading>
                <Text variant="description" className="mt-2">There are currently no {status} suggestions to review.</Text>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {suggestions.map((suggestion) => (
                  <Card 
                    key={suggestion.id} 
                    className={cn(
                      "group cursor-pointer transition-all duration-300 hover:shadow-xl hover:translate-y-[-4px]",
                      selectedId === suggestion.id ? "ring-2 ring-slate-900 shadow-xl" : ""
                    )}
                    onClick={() => setSelectedId(suggestion.id)}
                  >
                    <div className="aspect-[16/9] w-full bg-slate-100 relative overflow-hidden">
                      {suggestion.evidence_photo_url ? (
                        <img 
                          src={suggestion.evidence_photo_url} 
                          alt="Evidence" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                          <Building2 className="w-8 h-8 opacity-20" />
                          <span className="text-[10px] font-black uppercase tracking-widest">No Image Provided</span>
                        </div>
                      )}
                      <div className="absolute top-3 left-3 flex gap-2">
                        <Badge variant="neutral" className="bg-white/90 backdrop-blur-sm border-none shadow-sm">
                          ID #{suggestion.id}
                        </Badge>
                      </div>
                      <div className="absolute bottom-3 left-3">
                         <Badge variant="info" className="bg-slate-900 text-white border-none shadow-lg">
                            {suggestion.suggested_zone_type || 'Unknown Type'}
                         </Badge>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <Heading level={3} className="text-base line-clamp-1">
                            {suggestion.zone_name || suggestion.street_name || 'Unnamed Street'}
                          </Heading>
                          <div className="flex items-center gap-1.5 mt-1 text-slate-400">
                            <MapPin className="w-3 h-3" />
                            <span className="text-xs font-medium">{suggestion.area_name || 'Melbourne Area'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-emerald-600 font-black text-xs">
                             <CheckCircle2 className="w-3.5 h-3.5" />
                             {suggestion.confirmation_count}
                          </div>
                          <div className="flex items-center gap-1 text-rose-500 font-black text-xs mt-1">
                             <XCircle className="w-3.5 h-3.5" />
                             {suggestion.false_flag_count}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-4">
                        <div className="flex items-center gap-2">
                          <Avatar fallback={suggestion.submitter_name?.[0] || 'U'} className="w-6 h-6 text-[8px]" />
                          <span className="text-[10px] font-bold text-slate-500 truncate max-w-[80px]">
                            {suggestion.submitter_name || 'Unknown'}
                          </span>
                        </div>
                        <button className="text-[11px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-1 group-hover:gap-2 transition-all">
                          Review Request <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Right Detail Panel */}
          <div className="space-y-6">
            <Card className="p-6 sticky top-24">
              {selectedSuggestion ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <Heading level={2}>V-{selectedSuggestion.id}</Heading>
                    <Badge variant={status === 'pending' ? 'warning' : status === 'approved' ? 'success' : 'danger'}>
                      {status}
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

                    <div className="space-y-3 pt-4">
                       <Button className="w-full py-6" variant="primary">
                          <CheckCircle2 className="w-5 h-5 mr-2" />
                          Approve Submission
                       </Button>
                       <div className="grid grid-cols-2 gap-3">
                          <Button variant="outline" className="w-full">
                             <MessageSquare className="w-4 h-4 mr-2" />
                             Info Required
                          </Button>
                          <Button variant="outline" className="w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-100">
                             <XCircle className="w-4 h-4 mr-2" />
                             Reject
                          </Button>
                       </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-6">
                    <div className="flex items-center justify-between mb-4">
                       <Text variant="tiny">Location Preview</Text>
                       <button className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-1">
                          Open Map <Maximize2 className="w-3 h-3" />
                       </button>
                    </div>
                    <div className="aspect-[16/9] w-full bg-slate-900 rounded-2xl overflow-hidden relative group">
                       <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+900(0,0)/0,0,1,0/400x300@2x?access_token=pk.xxx')] bg-cover bg-center opacity-70 group-hover:scale-110 transition-transform duration-1000" />
                       <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center animate-pulse">
                             <MapPin className="text-white fill-white" />
                          </div>
                       </div>
                    </div>
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
    </AdminLayout>
  );
}
