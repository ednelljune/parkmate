import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { 
  LayoutDashboard, 
  MapPin, 
  PlusCircle, 
  Users, 
  AlertTriangle, 
  BarChart3, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  LogOut
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

import logo from '@/__create/parkmate-logo.png';

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  isActive: boolean;
  isCollapsed: boolean;
}

function SidebarItem({ icon: Icon, label, href, isActive, isCollapsed }: SidebarItemProps) {
  return (
    <Link
      to={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
        isActive 
          ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" 
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      <Icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-900")} />
      {!isCollapsed && <span className="font-medium text-sm whitespace-nowrap">{label}</span>}
      
      {isCollapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
          {label}
        </div>
      )}
    </Link>
  );
}

export function Sidebar({ isCollapsed, setIsCollapsed }: { isCollapsed: boolean, setIsCollapsed: (v: boolean) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [isSignoutLoading, setIsSignoutLoading] = useState(false);

  const handleSignOut = async () => {
    setIsSignoutLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      navigate('/account/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsSignoutLoading(false);
    }
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/admin' },
    { icon: MapPin, label: 'Parking Zones', href: '/admin/zones' },
    { icon: PlusCircle, label: 'Suggested Zones', href: '/admin/zones/suggestions' },
    { icon: Users, label: 'Users', href: '/admin/users' },
    { icon: AlertTriangle, label: 'Reports', href: '/admin/reports' },
    { icon: BarChart3, label: 'Analytics', href: '/admin/analytics' },
    { icon: Settings, label: 'Settings', href: '/admin/settings' },
  ];

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-screen bg-white border-r border-slate-200 transition-all duration-300 z-40 flex flex-col",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      <div className="h-16 flex items-center px-6 border-b border-slate-100 shrink-0">
        <Link to="/admin" className="flex items-center gap-3 overflow-hidden group">
          <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-slate-900/10 group-hover:scale-105 transition-transform">
            <img src={logo} alt="ParkMate" className="w-6 h-6 object-contain" />
          </div>
          {!isCollapsed && <span className="font-black text-xl tracking-tight text-slate-900">ParkMate</span>}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        {menuItems.map((item) => (
          <SidebarItem
            key={item.href}
            {...item}
            isActive={currentPath === item.href}
            isCollapsed={isCollapsed}
          />
        ))}
      </nav>

      <div className="p-4 border-t border-slate-100 space-y-2">
        <button
          onClick={handleSignOut}
          disabled={isSignoutLoading}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all disabled:opacity-50",
            isCollapsed ? "justify-center" : ""
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && <span className="font-medium text-sm">Sign Out</span>}
        </button>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center justify-center w-full p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : (
            <div className="flex items-center gap-3 w-full px-2">
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Collapse</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
