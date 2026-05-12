#!/usr/bin/env bash
# Seed 3 demo tanks with 7 days of realistic sensor readings.
# Run from anywhere on the VPS:
#   bash /var/www/firesky/scripts/seed-demo-tanks.sh
#
# Uses the local PostgreSQL socket — no password needed when run as root or postgres.

DB="${DATABASE_URL:-postgresql://firesky:Design4231@localhost:5432/firesky}"

echo "Seeding demo tanks into $DB ..."

psql "$DB" <<'SQL'

-- ── 1. Upsert the 3 demo tanks ───────────────────────────────────────────────
INSERT INTO tanks (serial_number, name, capacity_litres, height_cm, tank_type, alert_threshold_percent, last_seen_at)
VALUES
  ('FS-DEMO-001', 'Main House Tank',   5000,  185, 'vertical_round', 20, now()),
  ('FS-DEMO-002', 'Barn Tank',         2500,  150, 'vertical_round', 20, now()),
  ('FS-DEMO-003', 'Farm Reserve Tank', 10000, 250, 'vertical_round', 20, now())
ON CONFLICT (serial_number) DO UPDATE
  SET name             = EXCLUDED.name,
      capacity_litres  = EXCLUDED.capacity_litres,
      height_cm        = EXCLUDED.height_cm,
      last_seen_at     = now();

-- ── 2. Clear old demo readings ────────────────────────────────────────────────
DELETE FROM tank_readings
WHERE tank_id IN (
  SELECT id FROM tanks WHERE serial_number IN ('FS-DEMO-001','FS-DEMO-002','FS-DEMO-003')
);

-- ── 3. Generate 7 days × 48 readings (30-min intervals) per tank ──────────────
--
--  Tank params:  start_pct  drift_per_step  capacity  height_cm
--  FS-DEMO-001:  82         -0.04           5000      185
--  FS-DEMO-002:  45         -0.06           2500      150
--  FS-DEMO-003:  18         -0.02           10000     250
--
--  Rain event: 3 days ago, lasts 2 hours (4 readings spike +3.5%)
--  Temperature: sinusoidal day/night 14-30°C (SA spring)
--  Wind: SW ~210°, 10-25 km/h normal, 28-43 km/h during rain
--  Pressure: drops 5 hPa in 6 h before rain, 1006 during, recovers after
--  Battery: 95% → 80% over the week

WITH params AS (
  SELECT
    t.id                                                    AS tank_id,
    CASE t.serial_number
      WHEN 'FS-DEMO-001' THEN 82.0
      WHEN 'FS-DEMO-002' THEN 45.0
      ELSE                    18.0
    END                                                     AS start_pct,
    CASE t.serial_number
      WHEN 'FS-DEMO-001' THEN -0.04
      WHEN 'FS-DEMO-002' THEN -0.06
      ELSE                    -0.02
    END                                                     AS drift,
    t.capacity_litres::numeric                              AS capacity,
    COALESCE(t.height_cm, 185)::numeric                    AS height_cm,
    (now() - interval '7 days')                            AS series_start,
    (now() - interval '3 days')                            AS rain_start,
    (now() - interval '3 days' + interval '2 hours')       AS rain_end
  FROM tanks t
  WHERE t.serial_number IN ('FS-DEMO-001','FS-DEMO-002','FS-DEMO-003')
),
steps AS (
  SELECT
    p.*,
    s.i,
    (p.series_start + (s.i * interval '30 minutes'))       AS ts
  FROM params p
  CROSS JOIN generate_series(0, 335) AS s(i)   -- 336 = 7*24*2
),
computed AS (
  SELECT
    tank_id,
    ts,
    i,
    capacity,
    height_cm,
    rain_start,
    rain_end,
    -- is this reading inside the rain event?
    (ts >= rain_start AND ts < rain_end)                   AS is_rain,
    -- running level: start_pct + cumulative drift + noise (deterministic via sin/cos trick)
    GREATEST(0, LEAST(100,
      start_pct
      + (drift * i)
      -- pseudo-noise: small oscillation based on step index
      + 0.15 * sin(i * 1.7)
      -- rain spike: add 3.5% during rain event
      + CASE WHEN (ts >= rain_start AND ts < rain_end) THEN 3.5 ELSE 0 END
    ))                                                     AS level_pct,
    -- hour of day for temperature curve
    EXTRACT(HOUR FROM ts) + EXTRACT(MINUTE FROM ts) / 60.0 AS hour_of_day,
    -- battery: 95 → 80 over 336 steps
    ROUND(95 - (i::numeric / 335) * 15)                   AS battery_pct
  FROM steps
),
final AS (
  SELECT
    tank_id,
    ts                                                     AS recorded_at,
    level_pct                                              AS level_percent,
    ROUND((level_pct / 100.0) * height_cm, 2)             AS level_cm,
    ROUND((level_pct / 100.0) * capacity,  2)             AS litres,
    battery_pct                                            AS battery_percent,
    -- temperature: sinusoidal 14-30°C, peak at noon
    ROUND((14 + 16 * sin(((hour_of_day - 6) / 24.0) * pi() * 2)
           + 0.4 * sin(i * 2.3))::numeric, 1)             AS temperature_celsius,
    -- rainfall: 0 normally, 1.5-3.5 mm per reading during rain
    CASE WHEN is_rain
      THEN ROUND((1.5 + 1.5 * abs(sin(i * 3.7)))::numeric, 1)
      ELSE 0
    END                                                    AS rainfall_mm,
    -- wind speed
    ROUND((CASE WHEN is_rain THEN 28 + 10 * abs(sin(i * 1.1))
                ELSE            10 + 12 * abs(sin(i * 0.9)) END)::numeric, 1)
                                                           AS wind_speed_kmh,
    -- wind direction: SW ~210°
    210 + ROUND(20 * sin(i * 0.5))                        AS wind_direction_deg,
    -- pressure: drops before rain, low during, recovers after
    ROUND((CASE
      WHEN is_rain THEN 1006.0
      WHEN ts < rain_start
        THEN 1013.0 - GREATEST(0, EXTRACT(EPOCH FROM (rain_start - ts)) / 21600.0) * 5
      ELSE 1012.0 + 2 * abs(sin(i * 0.3))
    END)::numeric, 1)                                      AS pressure_hpa
  FROM computed
)
INSERT INTO tank_readings
  (tank_id, recorded_at, level_percent, level_cm, litres,
   battery_percent, temperature_celsius, rainfall_mm,
   wind_speed_kmh, wind_direction_deg, pressure_hpa)
SELECT
  tank_id, recorded_at, level_percent, level_cm, litres,
  battery_percent, temperature_celsius, rainfall_mm,
  wind_speed_kmh, wind_direction_deg, pressure_hpa
FROM final;

-- ── 4. Summary ────────────────────────────────────────────────────────────────
SELECT
  t.serial_number,
  t.name,
  COUNT(r.id)                                    AS readings,
  ROUND(MAX(r.level_percent)::numeric, 1)        AS max_pct,
  ROUND(MIN(r.level_percent)::numeric, 1)        AS min_pct,
  ROUND(AVG(r.temperature_celsius)::numeric, 1)  AS avg_temp_c,
  MAX(r.rainfall_mm)                             AS max_rain_mm
FROM tanks t
JOIN tank_readings r ON r.tank_id = t.id
WHERE t.serial_number IN ('FS-DEMO-001','FS-DEMO-002','FS-DEMO-003')
GROUP BY t.serial_number, t.name
ORDER BY t.serial_number;

SQL

echo ""
echo "Done. Register FS-DEMO-001, FS-DEMO-002, or FS-DEMO-003 in the Tank Monitor portal to see the data."
