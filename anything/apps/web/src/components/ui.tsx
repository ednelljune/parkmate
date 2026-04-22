import React from 'react';
import { cn } from '@/utils/cn'; // Assuming I'll create this or use a simple one
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden', className)}>
      {children}
    </div>
  );
}

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}) {
  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
    outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all active:scale-[0.98] rounded-xl outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  className,
  variant = 'neutral',
}: {
  children: React.ReactNode;
  className?: string;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const variants = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border-amber-100',
    danger: 'bg-rose-50 text-rose-700 border-rose-100',
    info: 'bg-sky-50 text-sky-700 border-sky-100',
  };

  return (
    <span
      className={cn(
        'px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-full border',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({
  src,
  fallback,
  className,
}: {
  src?: string;
  fallback: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 overflow-hidden',
        className
      )}
    >
      {src ? (
        <img src={src} alt="Avatar" className="w-full h-full object-cover" />
      ) : (
        <span className="text-sm font-bold text-slate-500">{fallback}</span>
      )}
    </div>
  );
}

export function Heading({
  children,
  className,
  level = 1,
}: {
  children: React.ReactNode;
  className?: string;
  level?: 1 | 2 | 3;
}) {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  const styles = {
    1: 'text-3xl font-black tracking-tight text-slate-900',
    2: 'text-xl font-bold text-slate-900',
    3: 'text-lg font-bold text-slate-800',
  };

  return <Tag className={cn(styles[level], className)}>{children}</Tag>;
}

export function Text({
  children,
  className,
  variant = 'body',
}: {
  children: React.ReactNode;
  className?: string;
  variant?: 'body' | 'description' | 'small' | 'tiny';
}) {
  const styles = {
    body: 'text-slate-600 leading-relaxed',
    description: 'text-slate-500 text-sm leading-relaxed',
    small: 'text-slate-500 text-xs font-medium',
    tiny: 'text-slate-400 text-[10px] font-bold uppercase tracking-widest',
  };

  return <p className={cn(styles[variant], className)}>{children}</p>;
}

export function Input({
  className,
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <div className="space-y-1.5 w-full">
      {label && <label className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">{label}</label>}
      <input
        className={cn(
          'w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm transition-all focus:border-slate-400 focus:ring-4 focus:ring-slate-100 outline-none',
          error && 'border-rose-300 focus:border-rose-400 focus:ring-rose-50',
          className
        )}
        {...props}
      />
      {error && <p className="text-[11px] font-medium text-rose-500">{error}</p>}
    </div>
  );
}

export function Table({
  headers,
  rows,
  renderRow,
  className,
}: {
  headers: string[];
  rows: any[];
  renderRow: (row: any, index: number) => React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-100">
            {headers.map((header) => (
              <th
                key={header}
                className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => renderRow(row, index))}
        </tbody>
      </table>
    </div>
  );
}
