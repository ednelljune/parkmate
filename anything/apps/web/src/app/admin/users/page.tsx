'use client';

import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  MoreVertical, 
  UserX, 
  UserCheck, 
  Trash2, 
  Mail, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Card, Heading, Text, Badge, Button, Input, Table, Avatar } from '@/components/ui';
import { cn } from '@/utils/cn';

// Mock Users Data
const MOCK_USERS = [
  { id: '1', name: 'James Wilson', email: 'james.w@example.com', date: 'Oct 12, 2025', status: 'Active', reports: 12 },
  { id: '2', name: 'Elena Rodriguez', email: 'elena.ro@techmail.io', date: 'Oct 14, 2025', status: 'Active', reports: 5 },
  { id: '3', name: 'Marcus Chen', email: 'mchen@studio.com', date: 'Oct 15, 2025', status: 'Suspended', reports: 24 },
  { id: '4', name: 'Sarah Parker', email: 'sparker@outlook.com', date: 'Oct 18, 2025', status: 'Active', reports: 0 },
  { id: '5', name: 'David Kim', email: 'dkim@global.net', date: 'Oct 20, 2025', status: 'Active', reports: 8 },
  { id: '6', name: 'Lisa Thompson', email: 'lisa.t@freelance.co', date: 'Oct 22, 2025', status: 'Suspended', reports: 15 },
  { id: '7', name: 'Robert Miller', email: 'rmiller@proto.io', date: 'Oct 25, 2025', status: 'Active', reports: 3 },
  { id: '8', name: 'Anna Garcia', email: 'anna.g@design.me', date: 'Oct 28, 2025', status: 'Active', reports: 1 },
];

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredUsers = useMemo(() => {
    return MOCK_USERS.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || user.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  const stats = [
    { label: 'Total Users', value: '12,482', icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Active Today', value: '1,240', icon: UserCheck, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Suspended', value: '84', icon: UserX, color: 'text-rose-600 bg-rose-50' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Heading level={1}>User Management</Heading>
            <Text variant="body" className="mt-1">Monitor and manage the ParkMate user community.</Text>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {stats.map((stat, i) => (
            <Card key={i} className="p-6 flex items-center gap-4">
              <div className={cn("p-3 rounded-2xl", stat.color)}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <Text variant="small" className="font-bold">{stat.label}</Text>
                <div className="text-2xl font-black text-slate-900 mt-0.5">{stat.value}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Main Content Area */}
        <Card>
          {/* Table Controls */}
          <div className="p-6 border-b border-slate-100 space-y-4 md:space-y-0 md:flex md:items-center md:justify-between gap-6">
            <div className="flex-1 relative group max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
              <input 
                type="text" 
                placeholder="Search users..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-100">
                {['All', 'Active', 'Suspended'].map((status) => (
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
              <Button variant="outline" size="sm" className="h-full">
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">User</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Email</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Date Registered</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Reports</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar fallback={user.name[0]} className="w-8 h-8 font-black" />
                        <div>
                          <p className="text-sm font-bold text-slate-900">{user.name}</p>
                          <p className="text-[10px] font-medium text-slate-400">ID: PF-{user.id.padStart(4, '0')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {user.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {user.date}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={user.status === 'Active' ? 'success' : 'danger'}>
                        {user.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-full max-w-[60px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full",
                              user.reports > 15 ? "bg-rose-500" : user.reports > 5 ? "bg-amber-500" : "bg-emerald-500"
                            )}
                            style={{ width: `${Math.min(100, (user.reports / 25) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-black text-slate-700">{user.reports}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all">
                          <UserX className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-6 border-t border-slate-50 flex items-center justify-between">
            <Text variant="small">Showing 1 to {filteredUsers.length} of 12,482 users</Text>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="p-2 h-9 w-9">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-1">
                {[1, 2, 3, '...', 1248].map((page, i) => (
                  <button 
                    key={i} 
                    className={cn(
                      "w-9 h-9 text-xs font-black rounded-xl transition-all",
                      page === 1 ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" : "text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    {page}
                  </button>
                ))}
              </div>
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
