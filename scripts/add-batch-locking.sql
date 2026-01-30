-- Add optimistic locking version column to batches table
ALTER TABLE batches ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Create index on version for better performance
CREATE INDEX IF NOT EXISTS idx_batches_version ON batches(version);

-- Function to atomically consume batch quantity with row-level locking
CREATE OR REPLACE FUNCTION consume_batch_quantity(
  p_batch_id UUID,
  p_quantity_to_consume INTEGER
)
RETURNS TABLE (
  id UUID,
  batch_number TEXT,
  quantity_available INTEGER,
  quantity_produced INTEGER,
  unit_of_measure TEXT,
  version INTEGER
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_available INTEGER;
  v_current_version INTEGER;
BEGIN
  -- Lock the row for update to prevent concurrent modifications
  SELECT b.quantity_available, b.version
  INTO v_current_available, v_current_version
  FROM batches b
  WHERE b.id = p_batch_id
  FOR UPDATE; -- This locks the row until transaction ends

  -- Check if batch exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found: %', p_batch_id;
  END IF;

  -- Check if sufficient quantity available
  IF v_current_available < p_quantity_to_consume THEN
    RAISE EXCEPTION 'Insufficient quantity. Available: %, Requested: %', 
      v_current_available, p_quantity_to_consume;
  END IF;

  -- Update quantity and increment version (optimistic locking)
  UPDATE batches
  SET 
    quantity_available = quantity_available - p_quantity_to_consume,
    version = version + 1,
    updated_at = NOW()
  WHERE batches.id = p_batch_id
    AND batches.version = v_current_version -- Ensure version hasn't changed
  RETURNING 
    batches.id,
    batches.batch_number,
    batches.quantity_available,
    batches.quantity_produced,
    batches.unit_of_measure,
    batches.version
  INTO id, batch_number, quantity_available, quantity_produced, unit_of_measure, version;

  -- If no rows updated, version conflict occurred
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Concurrent modification detected. Please retry.';
  END IF;

  RETURN NEXT;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION consume_batch_quantity TO authenticated;

-- Comment for documentation
COMMENT ON FUNCTION consume_batch_quantity IS 
'Atomically consumes quantity from a batch with row-level locking and optimistic concurrency control. 
Prevents race conditions in concurrent environments.';
