-- IoT Devices Management System
-- Manages IoT devices, sensors, and their data streams

-- Create IoT devices table
CREATE TABLE IF NOT EXISTS iot_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('temperature_sensor', 'humidity_sensor', 'gps_tracker', 'rfid_reader', 'scale', 'camera', 'other')),
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  manufacturer TEXT,
  model TEXT,
  firmware_version TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'error')),
  last_seen_at TIMESTAMPTZ,
  battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create IoT device readings table
CREATE TABLE IF NOT EXISTS iot_device_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES iot_devices(id) ON DELETE CASCADE,
  reading_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_iot_devices_device_id ON iot_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_iot_devices_location ON iot_devices(location_id);
CREATE INDEX IF NOT EXISTS idx_iot_devices_status ON iot_devices(status);
CREATE INDEX IF NOT EXISTS idx_iot_devices_type ON iot_devices(device_type);
CREATE INDEX IF NOT EXISTS idx_iot_device_readings_device ON iot_device_readings(device_id);
CREATE INDEX IF NOT EXISTS idx_iot_device_readings_time ON iot_device_readings(recorded_at);

-- Enable RLS
ALTER TABLE iot_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE iot_device_readings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for iot_devices
CREATE POLICY "Allow authenticated users to read devices"
  ON iot_devices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to create devices"
  ON iot_devices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update devices"
  ON iot_devices FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to delete devices"
  ON iot_devices FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for iot_device_readings
CREATE POLICY "Allow authenticated users to read readings"
  ON iot_device_readings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to create readings"
  ON iot_device_readings FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_iot_devices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER iot_devices_updated_at_trigger
  BEFORE UPDATE ON iot_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_iot_devices_updated_at();

-- View for device statistics
CREATE OR REPLACE VIEW v_device_statistics AS
SELECT 
  d.id,
  d.device_id,
  d.device_name,
  d.device_type,
  d.status,
  d.last_seen_at,
  COUNT(r.id) as total_readings,
  MAX(r.recorded_at) as last_reading_at
FROM iot_devices d
LEFT JOIN iot_device_readings r ON d.id = r.device_id
GROUP BY d.id, d.device_id, d.device_name, d.device_type, d.status, d.last_seen_at;

COMMENT ON TABLE iot_devices IS 'IoT devices for monitoring supply chain conditions';
COMMENT ON TABLE iot_device_readings IS 'Time-series data from IoT devices';
