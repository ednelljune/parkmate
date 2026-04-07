# ParkMate Backend Deploy Checklist

## Current diagnosis

The mobile app is currently pointed at:

`https://6132a2af-033f-484f-933b-f835894cf39d.created.app`

That live backend is not a working ParkMate API deployment:

- `GET /api/auth/providers` responds, but exposes an older auth setup.
- `POST /api/auth/mobile-login` returns `400 Bad Request`.
- `POST /api/reports/create` returns `404`.
- Auth callback testing returns `error=Configuration`.

This means the hosted backend is stale, misconfigured, or missing ParkMate API routes.

## Required backend environment variables

The web backend needs these variables at runtime:

- `DATABASE_POOLER_URL` or `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  or `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `AUTH_SECRET`
- `AUTH_URL`

Optional but recommended:

- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGINS`
- `ANYTHING_PROJECT_TOKEN`

## Render service settings

Deploy `anything/apps/web` to Render as a Node web service.

- Blueprint file: repo-root `render.yaml`
- Root Directory: `anything/apps/web`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`
- Runtime: `node`

Set `AUTH_URL` to the public Render URL for this service, for example:

- `AUTH_URL=https://parkmate-api.onrender.com`

## Required auth/backend behavior

The deployed backend must include the current `apps/web` code with these routes working:

- `/api/auth/mobile-login`
- `/api/auth/mobile-signup`
- `/api/auth/login`
- `/api/reports/create`
- `/api/reports/nearby`
- `/api/notifications/register-token`
- `/api/notifications/create`

## Database tables used by current code

Authentication:

- `auth_users`
- `auth_accounts`
- `auth_sessions`
- `auth_verification_token`
- `users`

Reporting and notifications:

- `live_reports`
- `parking_zones`
- `push_tokens`
- `notification_logs`
- `false_reports`

## Minimum live checks after deploy

Run these against the deployed backend URL:

1. `GET /api/auth/providers`
   Expected:
   - returns JSON
   - auth is configured

2. `POST /api/auth/mobile-login`
   Expected:
   - not `400 "Bad request."`
   - returns either `401 Invalid email or password` or `200` with `{ jwt, user }`

3. `POST /api/reports/create`
   Expected:
   - not `404`

4. `POST /api/reports/nearby`
   Expected:
   - returns JSON payload with `spots`

## Mobile app config after backend deploy

Update `apps/mobile/.env`:

- `EXPO_PUBLIC_BASE_URL=https://parkmate-api.onrender.com`
- `EXPO_PUBLIC_APP_URL=https://parkmate-api.onrender.com`
- `EXPO_PUBLIC_HOST=parkmate-api.onrender.com`

Then restart Expo with cache clear:

`npx expo start -c`

## Monday fallback plan

If production deploy is still not ready, use a tunnel to your local backend:

1. Set local backend env vars.
2. Start the local web backend on port `4000`.
3. Start a public tunnel to port `4000`.
4. Point `EXPO_PUBLIC_BASE_URL` at the tunnel URL.
5. Restart Expo.
