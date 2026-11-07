-- ============================================================================
-- SafeAlert Guardian: Live Location Tracking & Emergency Database Schema
-- Run this in your Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ============================================================================

-- 1. Ensure UUID Extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. SOS ALERTS & LIVE GPS BREADCRUMBS TABLE
-- Stores emergency triggers and continuous real-time movement GPS coordinates
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sos_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT,
    accuracy DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    altitude DOUBLE PRECISION,
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ultra-fast indexing for live tracking map queries and chronological path reconstruction
CREATE INDEX IF NOT EXISTS idx_sos_alerts_user_triggered 
ON public.sos_alerts (user_id, triggered_at ASC);

CREATE INDEX IF NOT EXISTS idx_sos_alerts_recent
ON public.sos_alerts (user_id, triggered_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;

-- Allow trusted contacts and anonymous viewers with tracking link to read location pings
DROP POLICY IF EXISTS "Allow public select on sos_alerts" ON public.sos_alerts;
CREATE POLICY "Allow public select on sos_alerts" 
ON public.sos_alerts FOR SELECT 
USING (true);

-- Allow victim device to upload new GPS coordinates during continuous tracking
DROP POLICY IF EXISTS "Allow public insert on sos_alerts" ON public.sos_alerts;
CREATE POLICY "Allow public insert on sos_alerts" 
ON public.sos_alerts FOR INSERT 
WITH CHECK (true);


-- ============================================================================
-- 3. DEDICATED LIVE LOCATIONS STREAM TABLE (Optional / High Frequency Pings)
-- High-throughput table specifically for sub-10s GPS stream breadcrumbs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.live_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_locations_user_time 
ON public.live_locations (user_id, recorded_at DESC);

ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select on live_locations" ON public.live_locations;
CREATE POLICY "Allow public select on live_locations" 
ON public.live_locations FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow public insert on live_locations" ON public.live_locations;
CREATE POLICY "Allow public insert on live_locations" 
ON public.live_locations FOR INSERT 
WITH CHECK (true);


-- ============================================================================
-- 4. SAFETY STATUS TABLE
-- Real-time danger / warning / safe status of user
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.safety_status (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('safe', 'warning', 'danger', 'unknown')),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.safety_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select on safety_status" ON public.safety_status;
CREATE POLICY "Allow public select on safety_status" 
ON public.safety_status FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow public upsert on safety_status" ON public.safety_status;
CREATE POLICY "Allow public upsert on safety_status" 
ON public.safety_status FOR ALL 
USING (true);


-- ============================================================================
-- 5. ROUTE HISTORY LOG TABLE
-- Timeline stops and emergency milestone markers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.route_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_history_user_time
ON public.route_history (user_id, recorded_at DESC);

ALTER TABLE public.route_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select on route_history" ON public.route_history;
CREATE POLICY "Allow public select on route_history" 
ON public.route_history FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow public insert on route_history" ON public.route_history;
CREATE POLICY "Allow public insert on route_history" 
ON public.route_history FOR INSERT 
WITH CHECK (true);


-- ============================================================================
-- 6. SECURITY DEFINER RPC FUNCTION: UPDATE CHECK-IN STATUS
-- Allows background workers and frontend to update check-in status (e.g. missed,
-- completed, cleared) securely bypassing RLS even if using publishable key.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_check_in_status(
    p_check_in_id UUID,
    p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.check_ins
    SET status = p_status
    WHERE id = p_check_in_id;

    RETURN jsonb_build_object('success', true, 'id', p_check_in_id, 'status', p_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_check_in_status(UUID, TEXT) TO anon, authenticated;

-- ============================================================================
-- 7. ENABLE SUPABASE REALTIME (Optional)
-- Allows the tracking page to subscribe to live postgres changes via websocket
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'sos_alerts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_alerts;
    END IF;
END $$;

