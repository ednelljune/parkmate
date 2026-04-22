'use client';

import React, { useState, useMemo } from 'react';
import { 
  MapPin, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  ExternalLink, 
  Navigation, 
  Layers, 
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Plus
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Card, Heading, Text, Badge, Button, Input, Table } from '@/components/ui';
import { cn } from '@/utils/cn';

// Mock Zones Data
const MOCK_ZONES = [
  { id: '1', suburb: 'Richmond', capacity: 45, category: 'Public', added: 'Oct 10, 2025', status: 'Active' },
  { id: '2', suburb: 'CBD', capacity: 120, category: 'Multi-level', added: 'Oct 12, 2025', status: 'Active' },
  { id: '3', suburb: 'St Kilda', capacity: 30, category: 'Public', added: 'Oct 15, 2025', status: 'Under Review' },
  { id: '4', suburb: 'Brunswick', capacity: 15, category: 'Street', added: 'Oct 18, 2025', status: 'Active' },
  { id: '5', suburb: 'South Yarra', capacity: 60, category: 'Public', added: 'Oct 20, 2025', status: 'Active' },
  { id: '6', suburb: 'Fitzroy', capacity: 25, category: 'Permit', added: 'Oct 22, 2025', status: 'Under Review' },
  { id: '7', suburb: 'Collingwood', capacity: 10, category: 'Street', added: 'Oct 25, 2025', status: 'Active' },
  { id: '8', suburb: 'Melbourne', capacity: 85, category: 'Public', added: 'Oct 28, 2025', status: 'Active' },
];

export default function ZonesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const filteredZones = useMemo(() => {
    return MOCK_ZONES.filter(zone => {
      const matchesSearch = zone.suburb.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || zone.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Heading level={1}>Parking Zones</Heading>
            <Text variant="body" className="mt-1">Manage all active and reviewed parking zones on the platform.</Text>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Layers className="w-4 h-4 mr-2" />
              Manage Categories
            </Button>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Zone
            </Button>
          </div>
        </div>

        {/* Filters Card */}
        <Card className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
              <input 
                type="text" 
                placeholder="Search by suburb..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-100">
                {['All', 'Active', 'Under Review'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                      statusFilter === status 
                        ? "bg-white text-slate-900 shadow-sm" 
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {status}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter Category
              </Button>
            </div>
          </div>
        </Card>

        {/* Zones Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">ID</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Suburb</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Capacity</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Category</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Date Added</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filteredZones.map((zone) => (
                  <tr key={zone.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="text-xs font-black text-slate-400">Z-{zone.id.padStart(4, '0')}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-bold text-slate-900">{zone.suburb}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-slate-900 rounded-full"
                            style={{ width: `${Math.min(100, (zone.capacity / 150) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-black text-slate-700">{zone.capacity}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-600">{zone.category}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-500">{zone.added}</span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={zone.status === 'Active' ? 'success' : 'warning'}>
                        {zone.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 rounded-xl text-slate-400 hover:bg-white hover:text-slate-900 hover:shadow-sm border border-transparent hover:border-slate-100 transition-all">
                          <Navigation className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-xl text-slate-400 hover:bg-white hover:text-slate-900 hover:shadow-sm border border-transparent hover:border-slate-100 transition-all">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 border border-transparent hover:border-rose-100 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-6 border-t border-slate-50 flex items-center justify-between">
            <Text variant="small">Showing {filteredZones.length} zones</Text>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="p-2 h-9 w-9">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <button className="w-9 h-9 text-xs font-black bg-slate-900 text-white rounded-xl shadow-md shadow-slate-900/10">1</button>
              <Button variant="outline" size="sm" className="p-2 h-9 w-9">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
