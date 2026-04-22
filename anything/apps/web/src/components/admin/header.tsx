import React from 'react';
import { Search, Bell, User, LogOut } from 'lucide-react';
import { useSupabaseAuth } from '@/utils/supabase-auth';
import { Avatar } from '@/components/ui';
import { cn } from '@/utils/cn';

export function Header() {
  const { user } = useSupabaseAuth();
  
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
        <button className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="h-8 w-[1px] bg-slate-100 mx-2"></div>

        <div className="flex items-center gap-3 pl-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-900 leading-none">{user?.user_metadata?.full_name || 'Admin User'}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">{user?.email}</p>
          </div>
          <button className="flex items-center gap-2 group">
            <Avatar 
              fallback={user?.email ? user.email[0].toUpperCase() : 'A'} 
              className="ring-2 ring-transparent group-hover:ring-slate-200 transition-all"
            />
          </button>
        </div>
      </div>
    </header>
  );
}
