CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  contribution_score INTEGER NOT NULL DEFAULT 0,
  trust_score INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parking_zones (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  zone_type TEXT NOT NULL,
  boundary geometry(Geometry, 4326) NOT NULL,
  capacity_spaces INTEGER,
  rules_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT parking_zones_name_zone_type_key UNIQUE (name, zone_type)
);

ALTER TABLE parking_zones
ADD COLUMN IF NOT EXISTS capacity_spaces INTEGER;

CREATE TABLE IF NOT EXISTS live_reports (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  location geometry(Point, 4326) NOT NULL,
  zone_id BIGINT REFERENCES parking_zones(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'available',
  parking_type TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  client_report_id TEXT,
  claimed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS push_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_id BIGINT NOT NULL REFERENCES live_reports(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS false_reports (
  id BIGSERIAL PRIMARY KEY,
  report_id BIGINT NOT NULL REFERENCES live_reports(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT false_reports_report_id_reported_by_key UNIQUE (report_id, reported_by)
);

CREATE TABLE IF NOT EXISTS user_hidden_notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feed_type TEXT NOT NULL,
  notification_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_hidden_notifications_user_feed_item_key UNIQUE (user_id, feed_type, notification_id)
);

CREATE TABLE IF NOT EXISTS suggested_parking_zones (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  location geometry(Point, 4326) NOT NULL,
  area_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  confirmation_count INTEGER NOT NULL DEFAULT 0,
  false_flag_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'mobile',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION public.sync_supabase_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inferred_name TEXT;
BEGIN
  inferred_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), '')
  );

  INSERT INTO public.users (id, email, full_name, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    inferred_name,
    COALESCE(NEW.created_at, CURRENT_TIMESTAMP)
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.users.full_name, EXCLUDED.full_name);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_or_updated ON auth.users;
CREATE TRIGGER on_auth_user_created_or_updated
AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_supabase_auth_user();

INSERT INTO public.users (id, email, full_name, created_at)
SELECT
  id,
  email,
  COALESCE(
    raw_user_meta_data ->> 'full_name',
    raw_user_meta_data ->> 'name',
    NULLIF(split_part(COALESCE(email, ''), '@', 1), '')
  ),
  COALESCE(created_at, CURRENT_TIMESTAMP)
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  full_name = COALESCE(public.users.full_name, EXCLUDED.full_name);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_live_reports_user_id ON live_reports (user_id);
CREATE INDEX IF NOT EXISTS idx_live_reports_zone_id ON live_reports (zone_id);
CREATE INDEX IF NOT EXISTS idx_live_reports_status_expires_at ON live_reports (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_report_id ON notification_logs (report_id);
CREATE INDEX IF NOT EXISTS idx_false_reports_report_id ON false_reports (report_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_reports_client_report_id ON live_reports (client_report_id);
CREATE INDEX IF NOT EXISTS idx_parking_zones_boundary_gist ON parking_zones USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_live_reports_location_gist ON live_reports USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_user_hidden_notifications_user_feed_created
ON user_hidden_notifications (user_id, feed_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggested_parking_zones_user_created
ON suggested_parking_zones (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggested_parking_zones_status_created
ON suggested_parking_zones (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggested_parking_zones_location_gist
ON suggested_parking_zones USING GIST (location);
