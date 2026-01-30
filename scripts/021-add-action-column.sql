-- Migration: Add action column to events table
-- Purpose: Provide simplified action field for UI/API usage (maps to EPCIS biz_step)
-- Date: 2026-01-30

-- Add action column
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS action TEXT;

COMMENT ON COLUMN public.events.action IS 'Simplified action for UI: receiving, shipping, production, packing, inspection, transformation, observation';

-- Add constraint for valid actions
ALTER TABLE public.events
DROP CONSTRAINT IF EXISTS check_action_types;

ALTER TABLE public.events 
ADD CONSTRAINT check_action_types 
CHECK (action IN (
  'receiving',      -- Nhận hàng
  'shipping',       -- Xuất hàng
  'production',     -- Sản xuất
  'packing',        -- Đóng gói
  'inspection',     -- Kiểm tra
  'transformation', -- Chuyển đổi
  'observation',    -- Quan sát
  'aggregation',    -- Tập hợp
  'disaggregation', -- Tháo gỡ
  'storing',        -- Lưu kho
  'transporting',   -- Vận chuyển
  'destroying'      -- Hủy bỏ
) OR action IS NULL);

-- Create index for action queries
CREATE INDEX IF NOT EXISTS idx_events_action ON events(action);

-- Create function to auto-populate action from biz_step
CREATE OR REPLACE FUNCTION sync_action_from_biz_step()
RETURNS TRIGGER AS $$
BEGIN
  -- Map EPCIS biz_step to simplified action
  IF NEW.action IS NULL AND NEW.biz_step IS NOT NULL THEN
    NEW.action := CASE 
      WHEN NEW.biz_step IN ('receiving', 'accepting') THEN 'receiving'
      WHEN NEW.biz_step IN ('shipping', 'departing') THEN 'shipping'
      WHEN NEW.biz_step IN ('commissioning', 'creating') THEN 'production'
      WHEN NEW.biz_step IN ('packing', 'aggregating') THEN 'packing'
      WHEN NEW.biz_step IN ('inspecting', 'observing') THEN 'inspection'
      WHEN NEW.biz_step IN ('transforming') THEN 'transformation'
      WHEN NEW.biz_step IN ('storing', 'warehousing') THEN 'storing'
      WHEN NEW.biz_step IN ('transporting', 'in_transit') THEN 'transporting'
      WHEN NEW.biz_step IN ('destroying', 'decommissioning') THEN 'destroying'
      ELSE 'observation'
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-sync action
DROP TRIGGER IF EXISTS trigger_sync_action_from_biz_step ON events;

CREATE TRIGGER trigger_sync_action_from_biz_step
  BEFORE INSERT OR UPDATE OF biz_step ON events
  FOR EACH ROW
  EXECUTE FUNCTION sync_action_from_biz_step();

-- Backfill existing records
UPDATE events 
SET action = CASE 
  WHEN biz_step IN ('receiving', 'accepting') THEN 'receiving'
  WHEN biz_step IN ('shipping', 'departing') THEN 'shipping'
  WHEN biz_step IN ('commissioning', 'creating') THEN 'production'
  WHEN biz_step IN ('packing', 'aggregating') THEN 'packing'
  WHEN biz_step IN ('inspecting', 'observing') THEN 'inspection'
  WHEN biz_step IN ('transforming') THEN 'transformation'
  WHEN biz_step IN ('storing', 'warehousing') THEN 'storing'
  WHEN biz_step IN ('transporting', 'in_transit') THEN 'transporting'
  WHEN biz_step IN ('destroying', 'decommissioning') THEN 'destroying'
  ELSE 'observation'
END
WHERE action IS NULL AND biz_step IS NOT NULL;

-- Grant permissions
GRANT SELECT ON events TO authenticated;
GRANT INSERT, UPDATE ON events TO authenticated;

COMMENT ON CONSTRAINT check_action_types ON events IS 'Ensures action values are valid supply chain actions';
