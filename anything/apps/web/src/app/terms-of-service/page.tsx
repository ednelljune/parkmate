import { Link } from "react-router";

export const meta = () => [
  { title: "ParkMate Terms of Service" },
  { name: "description", content: "Terms of Service for ParkMate." },
];

function LegalLayout({ eyebrow, title, accentClassName, children }) {
  return (
    <div className="min-h-screen bg-[#0b1f33] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#071827]/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img src="/parkmate-logo.svg" alt="ParkMate" className="h-11 w-11 rounded-xl" />
            <span className="text-2xl font-black tracking-tight text-white">ParkMate</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link to="/#features" className="text-sm font-semibold text-slate-300 hover:text-white">
              Features
            </Link>
            <Link to="/#contact" className="text-sm font-semibold text-slate-300 hover:text-white">
              Contact
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="rounded-[32px] border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/30 sm:p-10">
          <div className="mb-8">
            <p className={`mb-4 inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${accentClassName}`}>
              {eyebrow}
            </p>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">{title}</h1>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function TermsOfServicePage() {
  return (
    <LegalLayout
      eyebrow="Terms of Service"
      title="ParkMate Terms of Service"
      accentClassName="border-sky-500/20 bg-sky-500/10 text-sky-300"
    >
      <p className="mt-4 text-sm text-slate-400">Effective Date: 14 April 2026</p>
      <p className="text-sm text-slate-400">Last Updated: 14 April 2026</p>

      <div className="mt-8 space-y-8 text-slate-300">
        <section>
          <p>
            These Terms govern your use of the ParkMate mobile app and related services provided by ParkMate. By using
            ParkMate, you agree to these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white">1. Service Scope</h2>
          <p className="mt-4">
            ParkMate provides tools and information related to parking, including parking zone discovery, live or
            recent parking reports, spot claim features, timers, notifications, profiles, leaderboards, and map-based
            directions.
          </p>
          <p className="mt-4">
            ParkMate is an informational tool only. It does not guarantee that parking is available, lawful, safe,
            accurate, current, or suitable for your needs.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white">2. User Responsibilities</h2>
          <ul className="mt-4 list-disc space-y-2 pl-6">
            <li>Provide accurate account information and protect your credentials.</li>
            <li>Check signage, restrictions, permits, meter rules, and local laws before parking.</li>
            <li>Do not submit false, manipulated, abusive, fraudulent, or spammy parking reports.</li>
            <li>Do not interfere with the app, misuse automation, or attempt unauthorized access.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white">3. User Content</h2>
          <p className="mt-4">
            If you submit reports, claims, flags, or other content through ParkMate, you represent that the submission
            is accurate to the best of your knowledge and does not violate any law or third-party right. You grant
            ParkMate a non-exclusive, worldwide, royalty-free license to use that content as needed to operate,
            improve, and promote the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white">4. Suspension and Termination</h2>
          <p className="mt-4">
            We may suspend, restrict, or terminate access if you violate these Terms, create risk for users or the
            service, if we are required to do so by law, or if we discontinue all or part of the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white">5. Disclaimers and Liability</h2>
          <p className="mt-4">
            To the maximum extent permitted by law, ParkMate is provided &quot;as is&quot; and &quot;as available&quot;
            without warranties of accuracy, reliability, availability, fitness for a particular purpose,
            non-infringement, or merchantability.
          </p>
          <p className="mt-4">
            ParkMate is not responsible for fines, towing, penalties, missed time limits, permit violations, or
            similar parking-related loss.
          </p>
          <p className="mt-4">
            To the maximum extent permitted by law, total liability for claims relating to the service will not exceed
            the greater of the amount you paid us for the service in the 12 months before the claim, or AUD $100.
          </p>
          <p className="mt-4">Our services come with guarantees that cannot be excluded under the Australian Consumer Law.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white">6. Governing Law</h2>
          <p className="mt-4">
            These Terms are governed by the laws of Victoria, Australia, unless applicable law requires otherwise.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white">7. Contact Us</h2>
          <p className="mt-4 font-semibold text-white">ParkMate</p>
          <p className="font-semibold text-white">support@getparkmate.app</p>
          <p className="font-semibold text-white">Melbourne VIC, Australia</p>
        </section>
      </div>
    </LegalLayout>
  );
}
