'use client';

import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Search, 
  Filter, 
  MessageSquare, 
  ChevronRight,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Flag,
  MapPin,
  Clock
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Card, Heading, Text, Badge, Button, Avatar } from '@/components/ui';
import { cn } from '@/utils/cn';

// Mock Reports Data
const MOCK_REPORTS = [
  { id: '1', type: 'False Flag', description: 'This zone is actually private parking.', zone: 'Richmond Central', user: 'James W.', date: '2h ago', status: 'New' },
  { id: '2', type: 'Incorrect Info', description: 'Capacity is 10, not 25.', zone: 'CBD North', user: 'Elena R.', date: '5h ago', status: 'In Review' },
  { id: '3', type: 'Duplicate', description: 'This zone exists twice on the map.', zone: 'St Kilda', user: 'Marcus C.', date: '1d ago', status: 'Resolved' },
  { id: '4', type: 'Inappropriate Content', description: 'Offensive language in zone notes.', zone: 'South Yarra', user: 'Sarah P.', date: '2d ago', status: 'New' },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('New');

  const filteredReports = MOCK_REPORTS.filter(r => activeTab === 'All' || r.status === activeTab);

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <Heading level={1}>Platform Reports</Heading>
          <Text variant="body" className="mt-1">Review and resolve issues flagged by the ParkMate community.</Text>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200">
            {['All', 'New', 'In Review', 'Resolved'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-5 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
                  activeTab === tab ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter Type
            </Button>
          </div>
        </div>

        {/* Reports List */}
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <Card key={report.id} className="p-6 transition-all hover:border-slate-300">
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-xl",
                        report.status === 'New' ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-400"
                      )}>
                        <Flag className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Text variant="small" className="font-black text-slate-900">{report.type}</Text>
                          <Badge variant={report.status === 'New' ? 'danger' : report.status === 'In Review' ? 'warning' : 'success'}>
                            {report.status}
                          </Badge>
                        </div>
                        <Text variant="tiny" className="mt-1">Report #REP-{report.id.padStart(4, '0')}</Text>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{report.date}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4">
                    <Text variant="body" className="text-sm italic">"{report.description}"</Text>
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2">
                       <MapPin className="w-4 h-4 text-slate-400" />
                       <span className="text-sm font-bold text-slate-700">{report.zone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <Avatar fallback={report.user[0]} className="w-6 h-6 text-[8px]" />
                       <span className="text-sm font-medium text-slate-500">Reported by {report.user}</span>
                    </div>
                  </div>
                </div>

                <div className="lg:w-48 flex lg:flex-col items-center justify-center gap-3 lg:border-l lg:border-slate-100 lg:pl-6">
                  {report.status !== 'Resolved' ? (
                    <>
                      <Button className="w-full" size="sm">
                        Resolve
                      </Button>
                      <Button variant="outline" className="w-full" size="sm">
                        View Details
                      </Button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-emerald-600">
                      <CheckCircle2 className="w-8 h-8" />
                      <span className="text-xs font-black uppercase tracking-widest">Resolved</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
