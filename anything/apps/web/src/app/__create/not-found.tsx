import { Link, useLocation } from 'react-router';

const fallbackLinks = [
  { to: '/', label: 'Admin entry' },
  { to: '/admin', label: 'Admin dashboard' },
  { to: '/admin/zones/suggestions', label: 'Zone review queue' },
  { to: '/account/signin', label: 'Sign in' },
];

export default function NotFoundPage() {
  const location = useLocation();
  const missingPath = location.pathname || '/';

  return (
    <div className="min-h-screen bg-[#0b1f33] px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-4xl rounded-[32px] border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/30">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-300">404</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-white">Page not found</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
          The path <span className="font-semibold text-white">{missingPath}</span> does not exist in this
          web app. Use one of the routes below to get back to the admin tools.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {fallbackLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:bg-white/[0.07]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
