-- Auto-validation triggers for EPCIS events and batches
-- Automatically queue validation jobs when new records are created

-- Function to queue validation job
CREATE OR REPLACE FUNCTION queue_validation_job()
RETURNS TRIGGER AS $$
DECLARE
  entity_type TEXT;
  entity_id UUID;
BEGIN
  -- Determine entity type
  IF TG_TABLE_NAME = 'events' THEN
    entity_type := 'event';
    entity_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'batches' THEN
    entity_type := 'batch';
    entity_id := NEW.id;
  ELSE
    RETURN NEW;
  END IF;

  -- Insert validation job into queue
  INSERT INTO ai_processing_queue (
    job_type,
    status,
    priority,
    event_id,
    input_data,
    created_at
  ) VALUES (
    'validation',
    'pending',
    2, -- Lower priority than AI processing
    CASE WHEN entity_type = 'event' THEN entity_id ELSE NULL END,
    jsonb_build_object(
      'entity_type', entity_type,
      'entity_id', entity_id
    ),
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for events table
DROP TRIGGER IF EXISTS trigger_queue_event_validation ON events;
CREATE TRIGGER trigger_queue_event_validation
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION queue_validation_job();

-- Create trigger for batches table
DROP TRIGGER IF EXISTS trigger_queue_batch_validation ON batches;
CREATE TRIGGER trigger_queue_batch_validation
  AFTER INSERT ON batches
  FOR EACH ROW
  EXECUTE FUNCTION queue_validation_job();

-- Function to auto-process validation queue (can be called by pg_cron)
CREATE OR REPLACE FUNCTION process_validation_queue(batch_size INT DEFAULT 10)
RETURNS TABLE(processed_count INT) AS $$
DECLARE
  job_record RECORD;
  total_processed INT := 0;
BEGIN
  FOR job_record IN 
    SELECT id 
    FROM ai_processing_queue
    WHERE job_type = 'validation'
      AND status = 'pending'
    ORDER BY created_at ASC
    LIMIT batch_size
  LOOP
    -- Mark as processing
    UPDATE ai_processing_queue
    SET status = 'processing',
        processing_started_at = NOW()
    WHERE id = job_record.id;
    
    total_processed := total_processed + 1;
  END LOOP;

  RETURN QUERY SELECT total_processed;
END;
$$ LANGUAGE plpgsql;

-- Create index for faster queue processing
CREATE INDEX IF NOT EXISTS idx_validation_queue_pending 
  ON ai_processing_queue(job_type, status, created_at) 
  WHERE job_type = 'validation' AND status = 'pending';

-- Grant permissions
GRANT EXECUTE ON FUNCTION queue_validation_job() TO authenticated;
GRANT EXECUTE ON FUNCTION process_validation_queue(INT) TO authenticated;

COMMENT ON FUNCTION queue_validation_job() IS 'Automatically queue validation jobs for new events and batches';
COMMENT ON FUNCTION process_validation_queue(INT) IS 'Process pending validation jobs in batch';
