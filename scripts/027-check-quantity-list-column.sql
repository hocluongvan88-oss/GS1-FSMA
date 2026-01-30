-- Check quantity_list column in events table
-- Run this to verify the column exists and see sample data

-- 1. Check column definition
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'events' 
  AND column_name = 'quantity_list';

-- 2. Check recent events with their quantity_list values
SELECT 
  id,
  event_type,
  created_at,
  quantity_list,
  jsonb_typeof(quantity_list) as quantity_list_type,
  jsonb_array_length(quantity_list) as array_length
FROM events
ORDER BY created_at DESC
LIMIT 10;
