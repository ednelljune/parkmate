import { Link } from "react-router";

export const meta = () => [
  { title: "ParkMate Privacy Policy" },
  { name: "description", content: "Privacy Policy for ParkMate." },
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

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout
      eyebrow="Privacy Policy"
      title="ParkMate Privacy Policy"
      accentClassName="border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
    >
      <p className="mt-4 text-sm text-slate-400">Effective Date: 14 April 2026</p>
      <p className="text-sm text-slate-400">Last Updated: 14 April 2026</p>

      <div className="mt-8 space-y-8 text-slate-300">
        <section>
          <p>
            ParkMate provides a mobile app that helps users find parking zones, view and share parking availability
            reports, receive alerts, manage parking timers, and access related account features.
          </p>
          <p className="mt-4">
            This Privacy Policy explains how we collect, use, disclose, and protect information when you use the
            ParkMate app and related services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white">1. Information We Collect</h2>
          <ul className="mt-4 list-disc space-y-2 pl-6">
            <li>Account information such as your name, email address, login credentials, and authentication data.</li>
            <li>Approximate or precise location data when you allow location access.</li>
            <li>Parking reports, claims, flags, activity feed data, and reputation metrics.</li>
            <li>Push notification tokens, device identifiers, and notification interaction data.</li>
            <li>Device type, operating system, app version, crash logs, and performance diagnostics.</li>
            <li>Locally stored app data such as login session state, timers, and cached report data.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white">2. How We Use Information</h2>
          <ul className="mt-4 list-disc space-y-2 pl-6">
            <li>Create and manage your account.</li>
            <li>Show nearby parking zones, live reports, directions, and app activity.</li>
            <li>Send alerts, reminders, and service notifications.</li>
            <li>Improve app reliability, security, and performance.</li>
            <li>Detect fraud, spam, abuse, and inaccurate reporting.</li>
            <li>Comply with legal obligations.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white">3. Sharing and Providers</h2>
          <p className="mt-4">
            We may share information with providers that help operate ParkMate, including hosting, authentication,
            analytics, crash reporting, notification, and mapping providers. We may also share information when
            required by law, to protect rights or safety, or in connection with a merger, acquisition, financing, or
            sale of assets.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white">4. Retention and Security</h2>
          <p className="mt-4">
            We retain information for as long as reasonably necessary to provide the service, maintain account
            functionality, support safety and moderation, meet legal obligations, resolve disputes, and enforce our
            terms.
          </p>
          <p className="mt-4">
            We use reasonable administrative, technical, and organizational measures to help protect personal
            information. No method of transmission or storage is completely secure, and we cannot guarantee absolute
            security.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white">5. Your Choices</h2>
          <ul className="mt-4 list-disc space-y-2 pl-6">
            <li>Access or update account information where available.</li>
            <li>Disable location permissions or notifications in your device settings.</li>
            <li>Delete the app and local app data from your device.</li>
            <li>Request deletion of your account and associated personal information by contacting us.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white">6. Contact Us</h2>
          <p className="mt-4">If you have questions or requests about this Privacy Policy, contact us at:</p>
          <p className="mt-4 font-semibold text-white">ParkMate</p>
          <p className="font-semibold text-white">support@getparkmate.app</p>
          <p className="font-semibold text-white">Melbourne VIC, Australia</p>
        </section>
      </div>
    </LegalLayout>
  );
}
