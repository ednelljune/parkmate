# Supabase Auth Setup

ParkMate now expects Supabase Auth instead of the legacy authjs/custom-credentials flow.

## Required environment variables

Web: `anything/apps/web/.env`

```
NEXT_PUBLIC_SUPABASE_URL=https://tkjqredjgkijcrrfewbj.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=optional-legacy-anon-key
```

Mobile: `anything/apps/mobile/.env`

```
EXPO_PUBLIC_SUPABASE_URL=https://tkjqredjgkijcrrfewbj.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
EXPO_PUBLIC_SUPABASE_ANON_KEY=optional-legacy-anon-key
```

EAS build:

- Add the same mobile `EXPO_PUBLIC_SUPABASE_*` values to your EAS environment before building the APK.
- The mobile app now also reads these values from Expo `extra.publicConfig`, so standalone builds can use the same config that was injected at build time.

## Supabase dashboard configuration

Auth provider:

- Enable Email auth with password sign-in.

Redirect URLs:

- `http://localhost:4000/*`
- `https://6132a2af-033f-484f-933b-f835894cf39d.created.app/*`
- `parkmate://**`

Site URL:

- `https://6132a2af-033f-484f-933b-f835894cf39d.created.app`

## Notes

- Mobile signup confirmation now uses the Expo scheme already configured in `apps/mobile/app.json`: `parkmate`.
- The ParkMate public schema is bootstrapped from `apps/web/db/schema.sql` and mirrors `auth.users` into `public.users` via a database trigger.
- The client now prefers the publishable key and falls back to the legacy anon key if needed.
