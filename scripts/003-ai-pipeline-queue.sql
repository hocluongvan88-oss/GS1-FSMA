-- ============================================
-- AI PIPELINE QUEUE SYSTEM
-- Queue for batch AI processing with retry logic
-- ============================================

-- 1. AI PROCESSING QUEUE
CREATE TABLE IF NOT EXISTS ai_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Job Details
  job_type TEXT NOT NULL CHECK (job_type IN ('voice_transcription', 'vision_ocr', 'vision_counting', 'nlp_extraction', 'validation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'review_required')),
  priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
  
  -- Input
  input_data JSONB NOT NULL, -- {audio_url, image_url, text, etc.}
  user_id UUID REFERENCES users(id),
  location_gln TEXT REFERENCES locations(gln),
  
  -- Processing
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  processing_time_ms INTEGER,
  
  -- Output
  result JSONB, -- AI processing result
  confidence_score DECIMAL(5,4), -- 0.0000 to 1.0000
  confidence_threshold DECIMAL(5,4) DEFAULT 0.8500, -- Minimum confidence required
  
  -- Error Handling
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  error_details JSONB,
  
  -- Review (Human-in-the-Loop)
  requires_review BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_decision TEXT CHECK (review_decision IN ('approved', 'rejected', 'modified')),
  review_notes TEXT,
  
  -- Related Event
  event_id UUID REFERENCES events(id),
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_queue_status ON ai_processing_queue(status);
CREATE INDEX idx_ai_queue_priority ON ai_processing_queue(priority, created_at);
CREATE INDEX idx_ai_queue_job_type ON ai_processing_queue(job_type);
CREATE INDEX idx_ai_queue_user ON ai_processing_queue(user_id);
CREATE INDEX idx_ai_queue_requires_review ON ai_processing_queue(requires_review) WHERE requires_review = TRUE;

-- 2. AI MODEL CONFIGURATIONS
CREATE TABLE IF NOT EXISTS ai_model_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_type TEXT NOT NULL CHECK (model_type IN ('voice', 'vision', 'nlp')),
  provider TEXT NOT NULL, -- 'openai', 'google', 'gemini', etc.
  model_name TEXT NOT NULL, -- 'whisper-1', 'gpt-4o', 'gemini-1.5-pro', etc.
  
  -- Configuration
  config JSONB NOT NULL, -- API settings, parameters, etc.
  confidence_threshold DECIMAL(5,4) DEFAULT 0.8500,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  
  -- Performance Metrics
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  avg_processing_time_ms INTEGER,
  avg_confidence_score DECIMAL(5,4),
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_models_type ON ai_model_configs(model_type);
CREATE INDEX idx_ai_models_active ON ai_model_configs(is_active) WHERE is_active = TRUE;

-- 3. FUNCTIONS

-- Get next job from queue
CREATE OR REPLACE FUNCTION get_next_ai_job()
RETURNS ai_processing_queue AS $$
DECLARE
  next_job ai_processing_queue;
BEGIN
  SELECT * INTO next_job
  FROM ai_processing_queue
  WHERE status = 'pending'
    AND retry_count < max_retries
  ORDER BY priority ASC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF next_job.id IS NOT NULL THEN
    UPDATE ai_processing_queue
    SET status = 'processing',
        processing_started_at = NOW(),
        updated_at = NOW()
    WHERE id = next_job.id;
  END IF;
  
  RETURN next_job;
END;
$$ LANGUAGE plpgsql;

-- Mark job as completed
CREATE OR REPLACE FUNCTION complete_ai_job(
  job_id UUID,
  job_result JSONB,
  job_confidence DECIMAL,
  job_processing_time INTEGER
)
RETURNS VOID AS $$
DECLARE
  threshold DECIMAL;
BEGIN
  SELECT confidence_threshold INTO threshold
  FROM ai_processing_queue
  WHERE id = job_id;
  
  UPDATE ai_processing_queue
  SET 
    status = CASE 
      WHEN job_confidence < threshold THEN 'review_required'
      ELSE 'completed'
    END,
    result = job_result,
    confidence_score = job_confidence,
    processing_completed_at = NOW(),
    processing_time_ms = job_processing_time,
    requires_review = (job_confidence < threshold),
    updated_at = NOW()
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql;

-- Mark job as failed with retry logic
CREATE OR REPLACE FUNCTION fail_ai_job(
  job_id UUID,
  error_msg TEXT,
  error_detail JSONB
)
RETURNS VOID AS $$
DECLARE
  current_retry INTEGER;
  max_retry INTEGER;
BEGIN
  SELECT retry_count, max_retries INTO current_retry, max_retry
  FROM ai_processing_queue
  WHERE id = job_id;
  
  UPDATE ai_processing_queue
  SET 
    status = CASE 
      WHEN current_retry + 1 >= max_retry THEN 'failed'
      ELSE 'pending'
    END,
    retry_count = current_retry + 1,
    error_message = error_msg,
    error_details = error_detail,
    processing_completed_at = NOW(),
    updated_at = NOW()
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql;

-- 4. TRIGGERS

-- Auto-update timestamp
CREATE TRIGGER update_ai_queue_updated_at 
  BEFORE UPDATE ON ai_processing_queue 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_model_configs_updated_at 
  BEFORE UPDATE ON ai_model_configs 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 5. RLS POLICIES

ALTER TABLE ai_processing_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI jobs"
  ON ai_processing_queue FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR requires_review = TRUE);

CREATE POLICY "Users can create AI jobs"
  ON ai_processing_queue FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all AI jobs"
  ON ai_processing_queue FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'factory_manager'))
  );

ALTER TABLE ai_model_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active AI models"
  ON ai_model_configs FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

CREATE POLICY "Admins can manage AI models"
  ON ai_model_configs FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. SAMPLE DATA

-- Insert default AI model configurations
INSERT INTO ai_model_configs (model_type, provider, model_name, config, is_default) VALUES
  ('voice', 'openai', 'whisper-1', '{"language": "vi", "temperature": 0}', TRUE),
  ('vision', 'google', 'vision-api', '{"features": ["TEXT_DETECTION", "LABEL_DETECTION"]}', TRUE),
  ('nlp', 'openai', 'gpt-4o', '{"temperature": 0.3, "max_tokens": 2000}', TRUE)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE ai_processing_queue IS 'Queue hệ thống xử lý AI với retry logic và human review';
COMMENT ON TABLE ai_model_configs IS 'Cấu hình và metrics các AI models';
COMMENT ON FUNCTION get_next_ai_job IS 'Lấy job tiếp theo từ queue (FIFO với priority)';
COMMENT ON FUNCTION complete_ai_job IS 'Đánh dấu job hoàn thành, tự động flag review nếu confidence thấp';
COMMENT ON FUNCTION fail_ai_job IS 'Đánh dấu job thất bại với retry logic';
