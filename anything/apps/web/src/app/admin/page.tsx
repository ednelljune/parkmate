'use client';

import React from 'react';
import { 
  Users, 
  MapPin, 
  PlusCircle, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingUp,
  Clock,
  ChevronRight
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Card, Heading, Text, Badge, Button } from '@/components/ui';
import { cn } from '@/utils/cn';

// Mock Data
const userGrowthData = [
  { name: 'Jan', users: 400 },
  { name: 'Feb', users: 600 },
  { name: 'Mar', users: 800 },
  { name: 'Apr', users: 1200 },
  { name: 'May', users: 1500 },
  { name: 'Jun', users: 2100 },
  { name: 'Jul', users: 2400 },
];

const zonesBySuburbData = [
  { name: 'CBD', zones: 45 },
  { name: 'Richmond', zones: 32 },
  { name: 'St Kilda', zones: 28 },
  { name: 'Brunswick', zones: 24 },
  { name: 'South Yarra', zones: 20 },
];

const categoryData = [
  { name: 'Public', value: 45, color: '#0f172a' },
  { name: 'Private', value: 25, color: '#334155' },
  { name: 'Restricted', value: 20, color: '#64748b' },
  { name: 'Disabled', value: 10, color: '#94a3b8' },
];

const recentActivity = [
  { id: 1, type: 'new_zone', label: 'New zone suggested', suburb: 'Richmond', time: '5m ago' },
  { id: 2, type: 'report', label: 'False flag reported', suburb: 'St Kilda', time: '12m ago' },
  { id: 3, type: 'new_user', label: 'New user registered', user: 'Sarah J.', time: '24m ago' },
  { id: 4, type: 'approval', label: 'Zone approved', suburb: 'CBD', time: '45m ago' },
];

export default function AdminDashboard() {
  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <Heading level={1}>Operational Overview</Heading>
            <Text variant="body" className="mt-2">
              Welcome back, Admin. System is running stable with <span className="text-emerald-600 font-bold">24 new submissions</span> today.
            </Text>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Clock className="w-4 h-4 mr-2" />
              Real-time
            </Button>
            <Button size="sm">Download Report</Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Total Users', value: '12,482', trend: '+12%', up: true, icon: Users, color: 'bg-blue-50 text-blue-600' },
            { label: 'Total Zones', value: '842', trend: '+5%', up: true, icon: MapPin, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Pending Suggestions', value: '24', trend: '-18%', up: false, icon: PlusCircle, color: 'bg-amber-50 text-amber-600' },
            { label: 'Today\'s Reports', value: '156', trend: '+24%', up: true, icon: AlertTriangle, color: 'bg-rose-50 text-rose-600' },
          ].map((stat, i) => (
            <Card key={i} className="p-6">
              <div className="flex items-start justify-between">
                <div className={cn("p-2.5 rounded-xl", stat.color)}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div className={cn(
                  "flex items-center text-xs font-bold px-2 py-1 rounded-full",
                  stat.up ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"
                )}>
                  {stat.up ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                  {stat.trend}
                </div>
              </div>
              <div className="mt-4">
                <Text variant="small" className="font-bold">{stat.label}</Text>
                <div className="text-3xl font-black tracking-tight text-slate-900 mt-1">{stat.value}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Main Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <Heading level={2}>User Growth</Heading>
                <Text variant="small">New registrations over the last 6 months</Text>
              </div>
              <select className="bg-slate-50 border-none text-xs font-bold rounded-lg px-3 py-1.5 focus:ring-0">
                <option>Last 6 months</option>
                <option>Last year</option>
              </select>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={userGrowthData}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f172a" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#0f172a" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#64748b' }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#64748b' }} 
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="users" 
                    stroke="#0f172a" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorUsers)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <Heading level={2} className="mb-6">Recent Activity</Heading>
            <div className="space-y-6">
              {recentActivity.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <div className={cn(
                    "w-2 h-2 rounded-full mt-2 shrink-0",
                    item.type === 'new_zone' ? "bg-emerald-500" : 
                    item.type === 'report' ? "bg-rose-500" :
                    item.type === 'new_user' ? "bg-blue-500" : "bg-amber-500"
                  )} />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900 leading-none">{item.label}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {item.suburb ? `Location: ${item.suburb}` : `User: ${item.user}`}
                    </p>
                  </div>
                  <div className="text-[10px] font-bold text-slate-400">{item.time}</div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-8" size="sm">
              View all activity
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </Card>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <Heading level={2} className="mb-8 text-center sm:text-left">Zones per Suburb</Heading>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={zonesBySuburbData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fontSize: 12, fontStyle: 'bold', fill: '#0f172a' }}
                    width={100}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="zones" fill="#0f172a" radius={[0, 8, 8, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <Heading level={2} className="mb-8">Parking Categories</Heading>
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <div className="h-[200px] w-[200px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-4">
                {categoryData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm font-bold text-slate-700">{item.name}</span>
                    </div>
                    <span className="text-sm font-black text-slate-900">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
