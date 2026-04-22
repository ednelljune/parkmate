'use client';

import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  MapPin, 
  Calendar,
  Download,
  Filter,
  ArrowUpRight,
  ChevronDown
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Card, Heading, Text, Button, Badge } from '@/components/ui';
import { cn } from '@/utils/cn';

// Mock Data
const revenueData = [
  { name: 'Mon', value: 4500 },
  { name: 'Tue', value: 5200 },
  { name: 'Wed', value: 4800 },
  { name: 'Thu', value: 6100 },
  { name: 'Fri', value: 5900 },
  { name: 'Sat', value: 7200 },
  { name: 'Sun', value: 6800 },
];

const usageData = [
  { name: '08:00', users: 120, searches: 450 },
  { name: '10:00', users: 240, searches: 800 },
  { name: '12:00', users: 450, searches: 1200 },
  { name: '14:00', users: 380, searches: 950 },
  { name: '16:00', users: 560, searches: 1500 },
  { name: '18:00', users: 820, searches: 2100 },
  { name: '20:00', users: 650, searches: 1400 },
];

export default function AnalyticsPage() {
  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <Heading level={1}>Platform Analytics</Heading>
            <Text variant="body" className="mt-1">Deep dive into user behavior, zone performance, and platform growth.</Text>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 shadow-sm cursor-pointer hover:bg-slate-50 transition-all">
              <Calendar className="w-4 h-4 mr-2 text-slate-400" />
              Last 30 Days
              <ChevronDown className="w-4 h-4 ml-8 text-slate-400" />
            </div>
            <Button variant="primary" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
          </div>
        </div>

        {/* Top Insights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Active Sessions', value: '2,482', trend: '+14%', color: 'text-blue-600' },
            { label: 'Avg. Search Time', value: '1.2s', trend: '-8%', color: 'text-emerald-600 text-sm' },
            { label: 'Conversion Rate', value: '4.8%', trend: '+0.5%', color: 'text-slate-900' },
          ].map((insight, i) => (
            <Card key={i} className="p-6">
               <Text variant="tiny">{insight.label}</Text>
               <div className="flex items-end justify-between mt-2">
                 <div className={cn("text-3xl font-black tracking-tight", insight.color)}>{insight.value}</div>
                 <div className="flex items-center gap-1 text-emerald-600 text-xs font-black bg-emerald-50 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-3 h-3" />
                    {insight.trend}
                 </div>
               </div>
            </Card>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-8">
              <Heading level={2}>Engagement Trends</Heading>
              <div className="flex gap-2">
                <Badge variant="info">Users</Badge>
                <Badge variant="neutral">Searches</Badge>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={usageData}>
                  <defs>
                    <linearGradient id="colorUsersAn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f172a" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#0f172a" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="users" stroke="#0f172a" strokeWidth={3} fillOpacity={1} fill="url(#colorUsersAn)" />
                  <Area type="monotone" dataKey="searches" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <Heading level={2} className="mb-8">Weekly Peak Load</Heading>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} hide />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" fill="#0f172a" radius={[12, 12, 12, 12]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Detailed Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
           {[
             { label: 'Popular Suburb', value: 'Richmond', sub: '452 claims today' },
             { label: 'Top Contributor', value: 'James W.', sub: '24 zones suggested' },
             { label: 'Avg. Stay Time', value: '42m', sub: '+12% from last week' },
             { label: 'Successful Nav', value: '82%', sub: 'Based on app data' },
           ].map((stat, i) => (
             <Card key={i} className="p-6 hover:shadow-md transition-shadow">
               <Text variant="tiny" className="mb-4">{stat.label}</Text>
               <div className="text-xl font-black text-slate-900">{stat.value}</div>
               <Text variant="small" className="mt-1">{stat.sub}</Text>
             </Card>
           ))}
        </div>
      </div>
    </AdminLayout>
  );
}
