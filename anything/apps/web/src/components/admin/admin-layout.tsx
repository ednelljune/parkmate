import React, { useState, useEffect } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { cn } from '@/utils/cn';
import { useSupabaseAuth } from '@/utils/supabase-auth';
import { useNavigate } from 'react-router';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { session, isLoading } = useSupabaseAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/account/signin?callbackUrl=/admin');
    }
  }, [session, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      
      <div className={cn(
        "flex-1 transition-all duration-300 flex flex-col min-w-0",
        isCollapsed ? "ml-20" : "ml-64"
      )}>
        <Header />
        
        <main className="flex-1 p-6 lg:p-10 max-w-[1600px] mx-auto w-full">
          {children}
        </main>

        <footer className="px-6 py-4 border-t border-slate-200 bg-white text-center">
          <p className="text-xs text-slate-400 font-medium tracking-tight">
            &copy; {new Date().getFullYear()} ParkMate Admin Dashboard. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}
