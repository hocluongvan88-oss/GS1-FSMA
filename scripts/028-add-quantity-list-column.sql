-- Add quantity_list column for ObjectEvent and AggregationEvent
-- This column stores quantity information for non-transformation events

-- Add the column
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS quantity_list JSONB DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN events.quantity_list IS 'Quantity list for ObjectEvent and AggregationEvent. Format: [{epc_class: string, quantity: number, uom: string}]';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_events_quantity_list ON events USING GIN (quantity_list);

-- Update existing events to have empty array instead of NULL
UPDATE events 
SET quantity_list = '[]'::jsonb 
WHERE quantity_list IS NULL;
