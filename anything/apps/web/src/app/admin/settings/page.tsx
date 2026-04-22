'use client';

import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  User, 
  Bell, 
  Shield, 
  Mail, 
  Globe, 
  Smartphone,
  Save,
  Trash2,
  Key,
  Database,
  Lock
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Card, Heading, Text, Button, Input, Avatar, Badge } from '@/components/ui';
import { cn } from '@/utils/cn';
import { useSupabaseAuth } from '@/utils/supabase-auth';

export default function SettingsPage() {
  const { user } = useSupabaseAuth();
  const [activeTab, setActiveTab] = useState('Profile');

  const tabs = [
    { name: 'Profile', icon: User },
    { name: 'Notifications', icon: Bell },
    { name: 'Security', icon: Shield },
    { name: 'System', icon: SettingsIcon },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <Heading level={1}>Account Settings</Heading>
          <Text variant="body" className="mt-1">Manage your administrative profile and system preferences.</Text>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Tabs */}
          <div className="lg:w-64 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 rounded-xl font-bold text-sm transition-all",
                  activeTab === tab.name 
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10" 
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <tab.icon className={cn("w-4 h-4", activeTab === tab.name ? "text-white" : "text-slate-400")} />
                {tab.name}
              </button>
            ))}
          </div>

          {/* Main Content */}
          <div className="flex-1 max-w-3xl space-y-6">
            {activeTab === 'Profile' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Card className="p-8">
                  <div className="flex flex-col sm:flex-row items-center gap-8 border-b border-slate-50 pb-8 mb-8">
                    <div className="relative group">
                      <Avatar 
                        fallback={user?.email?.[0].toUpperCase() || 'A'} 
                        className="w-24 h-24 text-2xl font-black ring-4 ring-slate-50"
                      />
                      <button className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg border border-slate-100 text-slate-500 hover:text-slate-900 transition-all">
                        <Smartphone className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-center sm:text-left space-y-2">
                       <Heading level={2}>{user?.user_metadata?.full_name || 'Admin User'}</Heading>
                       <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                         <Badge variant="info">Level 4 Admin</Badge>
                         <Badge variant="neutral">Member since 2024</Badge>
                       </div>
                       <Text variant="description">Administrator access for all Australian zones.</Text>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Input label="Full Name" defaultValue={user?.user_metadata?.full_name || 'Admin User'} />
                    <Input label="Email Address" defaultValue={user?.email || 'admin@parkmate.com'} readOnly />
                    <Input label="Job Title" defaultValue="Platform Operations Manager" />
                    <Input label="Location" defaultValue="Melbourne, AU" />
                  </div>

                  <div className="mt-8 flex justify-end">
                    <Button>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </Card>

                <Card className="p-8 border-rose-100 bg-rose-50/10">
                   <Heading level={3} className="text-rose-600">Danger Zone</Heading>
                   <Text variant="description" className="mt-2">Permanent actions regarding your administrative account.</Text>
                   <div className="mt-6 flex flex-col sm:flex-row gap-4">
                      <Button variant="outline" className="text-rose-600 hover:bg-rose-50 hover:border-rose-100">Deactivate Account</Button>
                      <Button variant="outline" className="text-rose-600 hover:bg-rose-50 hover:border-rose-100">Delete All Data</Button>
                   </div>
                </Card>
              </div>
            )}

            {activeTab === 'Security' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Card className="p-8">
                   <div className="flex items-center gap-3 mb-8">
                     <div className="p-2 bg-slate-900 rounded-xl">
                       <Lock className="w-5 h-5 text-white" />
                     </div>
                     <Heading level={2}>Authentication Security</Heading>
                   </div>

                   <div className="space-y-8">
                     <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <div className="flex items-center gap-4">
                           <Key className="w-5 h-5 text-slate-400" />
                           <div>
                             <p className="text-sm font-bold text-slate-900">Two-Factor Authentication</p>
                             <p className="text-xs text-slate-500">Add an extra layer of security to your account.</p>
                           </div>
                        </div>
                        <Badge variant="success">Enabled</Badge>
                     </div>

                     <div className="space-y-4">
                        <Input label="Current Password" type="password" placeholder="••••••••" />
                        <Input label="New Password" type="password" />
                        <Input label="Confirm New Password" type="password" />
                     </div>

                     <div className="pt-4 flex justify-end">
                       <Button>Update Password</Button>
                     </div>
                   </div>
                </Card>
              </div>
            )}

            {activeTab === 'System' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Card className="p-8">
                   <div className="flex items-center gap-3 mb-8">
                     <div className="p-2 bg-slate-900 rounded-xl">
                       <Database className="w-5 h-5 text-white" />
                     </div>
                     <Heading level={2}>System Controls</Heading>
                   </div>

                   <div className="space-y-6">
                      {[
                        { label: 'Platform Maintenance Mode', desc: 'Disable public access to the platform for updates.', value: false },
                        { label: 'Real-time Analytics', desc: 'Stream live usage data to the analytics dashboard.', value: true },
                        { label: 'Auto-Reject Low Quality', desc: 'Automatically reject suggestions with multiple false flags.', value: true },
                      ].map((toggle, i) => (
                        <div key={i} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-all cursor-pointer">
                           <div className="flex-1 pr-8">
                              <p className="text-sm font-bold text-slate-900">{toggle.label}</p>
                              <p className="text-xs text-slate-500 mt-1">{toggle.desc}</p>
                           </div>
                           <div className={cn(
                             "w-12 h-6 rounded-full relative transition-all duration-300",
                             toggle.value ? "bg-slate-900" : "bg-slate-200"
                           )}>
                              <div className={cn(
                                "w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-300",
                                toggle.value ? "left-7" : "left-1"
                              )} />
                           </div>
                        </div>
                      ))}
                   </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
