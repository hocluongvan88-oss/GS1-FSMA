-- ============================================
-- ADD 'validation' TO job_type CONSTRAINT
-- Fix: ai_processing_queue_job_type_check constraint
-- ============================================

-- Drop existing constraint
ALTER TABLE ai_processing_queue 
DROP CONSTRAINT IF EXISTS ai_processing_queue_job_type_check;

-- Add new constraint with 'validation' included
ALTER TABLE ai_processing_queue 
ADD CONSTRAINT ai_processing_queue_job_type_check 
CHECK (job_type IN ('voice_transcription', 'vision_ocr', 'vision_counting', 'nlp_extraction', 'validation'));

-- Comment
COMMENT ON CONSTRAINT ai_processing_queue_job_type_check ON ai_processing_queue IS 
'Updated to include validation job type for automated validation queue';
