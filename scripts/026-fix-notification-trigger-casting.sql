-- ============================================
-- FIX NOTIFICATION TRIGGER TYPE CASTING
-- Sửa lỗi: trigger notify_event_created gọi create_notification với tham số không đúng kiểu
-- ============================================

-- Recreate the trigger function with proper type casting and user existence check
CREATE OR REPLACE FUNCTION notify_event_created()
RETURNS TRIGGER AS $$
DECLARE
  user_exists BOOLEAN;
BEGIN
  -- Check if user exists before creating notification
  IF NEW.user_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.users WHERE id = NEW.user_id) INTO user_exists;
    
    -- Only create notification if user exists (prevents FK violations for test data)
    IF user_exists THEN
      PERFORM create_notification(
        NEW.user_id::UUID,
        'event_created'::TEXT,
        'Event Created Successfully'::TEXT,
        ('Your ' || NEW.event_type || ' event has been recorded')::TEXT,
        'normal'::TEXT,
        'event'::TEXT,
        NEW.id::UUID,
        ('/events/' || NEW.id::TEXT)::TEXT
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS event_created_notification ON public.events;
CREATE TRIGGER event_created_notification
AFTER INSERT ON public.events
FOR EACH ROW
WHEN (NEW.source_type = 'manual')
EXECUTE FUNCTION notify_event_created();

COMMENT ON FUNCTION notify_event_created IS 'Fixed version with explicit type casting and user existence check to prevent FK violations';
