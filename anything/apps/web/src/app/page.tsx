import { Link } from "react-router";

const navigationItems = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#problem", label: "The Problem" },
  { href: "#contact", label: "Contact" },
];

const featureCards = [
  {
    title: "Public zone discovery",
    body: "See public parking zones on the map faster, without guessing which streets are paid or permit-only.",
  },
  {
    title: "Live community intel",
    body: "Fresh user reports help surface spots that were actually open recently, not just theoretically available.",
  },
  {
    title: "Missing-zone suggestions",
    body: "Drivers can suggest unmapped public parking areas so coverage keeps expanding where people actually park.",
  },
];

const workflowSteps = [
  "Open ParkMate and check nearby public parking zones.",
  "Use live reports to decide where to head first.",
  "Claim a reported opening or submit a new report for the next driver.",
];

const problems = [
  "Street parking rules are fragmented and slow to verify when you are already driving.",
  "Most maps can guide you to a destination, but not to the best legal public parking nearby.",
  "Parking availability changes quickly, so static map data is not enough on its own.",
];

export const meta = () => [
  { title: "ParkMate | Find Public Parking Across Victoria" },
  {
    name: "description",
    content:
      "ParkMate helps drivers find free public parking across Victoria with live parking intel, directions, and early access beta access.",
  },
];

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#071827]/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/parkmate-logo.svg"
            alt="ParkMate"
            className="h-11 w-11 rounded-xl shadow-lg shadow-emerald-500/20"
          />
          <span className="text-2xl font-black tracking-tight text-white">ParkMate</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navigationItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-semibold text-slate-300 transition-colors hover:text-white"
            >
              {item.label}
            </a>
          ))}
          <Link
            to="/account/signin"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#071522]">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-400 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>ParkMate. Public parking guidance for Victoria.</div>
        <div className="flex flex-wrap gap-4">
          <Link to="/privacy-policy" className="transition-colors hover:text-white">
            Privacy Policy
          </Link>
          <Link to="/terms-of-service" className="transition-colors hover:text-white">
            Terms of Service
          </Link>
          <Link to="/admin/zones/suggestions" className="transition-colors hover:text-white">
            Admin Review
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default function Page() {
  return (
    <div className="min-h-screen bg-[#0b1f33] text-slate-100">
      <Header />

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.16),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(56,189,248,0.18),transparent_30%)]" />
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-28">
            <div className="relative z-10">
              <div className="inline-flex rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-200">
                Now covering public parking across Victoria
              </div>
              <h1 className="mt-6 max-w-3xl text-5xl font-black leading-tight tracking-tight text-white sm:text-6xl">
                Find better public parking before you start circling the block.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                ParkMate combines mapped public parking zones with live community reports so drivers can make faster,
                cleaner parking decisions.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <a
                  href="#join-beta"
                  className="rounded-full bg-emerald-500 px-7 py-4 text-center text-base font-bold text-slate-950 shadow-lg shadow-emerald-500/30 transition-transform hover:-translate-y-0.5"
                >
                  Join the TestFlight Beta
                </a>
                <a
                  href="#how-it-works"
                  className="rounded-full border border-white/15 bg-white/5 px-7 py-4 text-center text-base font-bold text-white transition-colors hover:bg-white/10"
                >
                  See how it works
                </a>
              </div>
            </div>

            <div className="relative z-10">
              <div className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/40 p-4 shadow-2xl shadow-cyan-950/30 backdrop-blur">
                <div className="overflow-hidden rounded-[26px] border border-white/10 bg-[#11263b]">
                  <img
                    src="/pakenham-map-bg.jpg"
                    alt="ParkMate map preview"
                    className="h-[420px] w-full object-cover opacity-85"
                  />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Coverage</div>
                    <div className="mt-2 text-lg font-bold text-white">Victoria-wide</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Reports</div>
                    <div className="mt-2 text-lg font-bold text-white">Live spot intel</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Admin</div>
                    <div className="mt-2 text-lg font-bold text-white">Web review tools</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-cyan-300">Features</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
              A parking product built around public-zone decisions, not generic maps.
            </h2>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {featureCards.map((card) => (
              <article
                key={card.title}
                className="rounded-[28px] border border-white/10 bg-slate-950/35 p-6 shadow-xl shadow-slate-950/20"
              >
                <h3 className="text-xl font-bold text-white">{card.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="bg-[#081726]">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.28em] text-emerald-300">How it works</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Faster parking choices in three steps.
              </h2>
            </div>
            <div className="space-y-4">
              {workflowSteps.map((step, index) => (
                <div
                  key={step}
                  className="flex gap-4 rounded-[26px] border border-white/10 bg-white/[0.04] p-5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-400 font-black text-slate-950">
                    {index + 1}
                  </div>
                  <p className="pt-1 text-base leading-7 text-slate-200">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="problem" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-[32px] border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-8">
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-amber-300">The problem</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Parking friction is usually an information problem first.
            </h2>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {problems.map((problem) => (
                <div key={problem} className="rounded-[24px] border border-white/10 bg-slate-950/35 p-5">
                  <p className="text-sm leading-7 text-slate-300">{problem}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="join-beta" className="bg-[#081726]">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.28em] text-sky-300">Join the beta</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Test the newest reporting and zone-discovery flows before public launch.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                ParkMate is being refined with real user feedback. Join TestFlight, try the live reporting flows, and
                help surface missing public parking zones that should be on the map.
              </p>
            </div>
            <div className="rounded-[30px] border border-white/10 bg-slate-950/50 p-6 text-center shadow-xl shadow-slate-950/25">
              <img src="/testflight-qr.svg" alt="TestFlight QR code" className="mx-auto w-full max-w-[220px]" />
              <p className="mt-4 text-sm font-semibold text-white">Scan to join TestFlight</p>
              <p className="mt-2 text-xs leading-6 text-slate-400">Use your iPhone camera to open the beta invite.</p>
            </div>
          </div>
        </section>

        <section id="contact" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-[32px] border border-cyan-400/20 bg-cyan-500/10 p-8">
            <h2 className="text-3xl font-black tracking-tight text-white">Contact</h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-200">
              Questions about the app, privacy, or beta access can go directly to{" "}
              <a className="font-bold text-white underline decoration-cyan-300/60" href="mailto:support@getparkmate.app">
                support@getparkmate.app
              </a>
              .
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
