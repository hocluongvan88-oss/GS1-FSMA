-- Migration: Notifications System
-- Description: Create notifications table with real-time support
-- Author: System
-- Date: 2026-01-26

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User reference
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Notification details
    type TEXT NOT NULL CHECK (type IN (
        'event_created',
        'quality_check_required',
        'quality_check_completed',
        'shipment_dispatched',
        'shipment_delivered',
        'batch_created',
        'batch_expiring',
        'certification_expiring',
        'ai_review_required',
        'system_alert'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    
    -- Related entities (nullable based on notification type)
    related_entity_type TEXT CHECK (related_entity_type IN (
        'event', 'batch', 'shipment', 'product', 'location', 
        'certification', 'partner', 'ai_queue'
    )),
    related_entity_id UUID,
    
    -- Status tracking
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Priority
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Additional data
    action_url TEXT, -- URL to navigate when clicking notification
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for user's unread notifications (most common query)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON public.notifications(user_id, is_read, created_at DESC) 
WHERE is_read = FALSE;

-- Index for user's all notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON public.notifications(user_id, created_at DESC);

-- Index for notification type
CREATE INDEX IF NOT EXISTS idx_notifications_type 
ON public.notifications(type);

-- Index for related entities
CREATE INDEX IF NOT EXISTS idx_notifications_related_entity 
ON public.notifications(related_entity_type, related_entity_id) 
WHERE related_entity_type IS NOT NULL;

-- GIN index for metadata JSONB queries
CREATE INDEX IF NOT EXISTS idx_notifications_metadata 
ON public.notifications USING GIN(metadata);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can mark their own notifications as read
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- System can create notifications for any user (service role only)
CREATE POLICY "System can create notifications"
ON public.notifications
FOR INSERT
TO service_role
WITH CHECK (true);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS notifications_updated_at_trigger ON public.notifications;
CREATE TRIGGER notifications_updated_at_trigger
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notifications_updated_at();

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = TRUE, read_at = NOW()
    WHERE id = notification_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS VOID AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = TRUE, read_at = NOW()
    WHERE user_id = auth.uid() AND is_read = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM public.notifications
        WHERE user_id = auth.uid() AND is_read = FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION TO CREATE NOTIFICATIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_priority TEXT DEFAULT 'normal',
    p_related_entity_type TEXT DEFAULT NULL,
    p_related_entity_id UUID DEFAULT NULL,
    p_action_url TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        priority,
        related_entity_type,
        related_entity_id,
        action_url,
        metadata
    ) VALUES (
        p_user_id,
        p_type,
        p_title,
        p_message,
        p_priority,
        p_related_entity_type,
        p_related_entity_id,
        p_action_url,
        p_metadata
    )
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- AUTO-NOTIFICATION TRIGGERS
-- ============================================================================

-- Create notification when a new batch requires quality check
CREATE OR REPLACE FUNCTION notify_quality_check_required()
RETURNS TRIGGER AS $$
DECLARE
    v_users UUID[];
    v_user UUID;
BEGIN
    -- Get all quality inspectors
    SELECT ARRAY_AGG(id) INTO v_users
    FROM public.users
    WHERE role IN ('quality_inspector', 'factory_manager', 'admin');
    
    -- Create notification for each quality inspector
    FOREACH v_user IN ARRAY v_users
    LOOP
        PERFORM create_notification(
            v_user,
            'quality_check_required',
            'Quality Check Required',
            'New batch ' || NEW.batch_number || ' requires quality inspection',
            'high',
            'batch',
            NEW.id,
            '/batches/' || NEW.id
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS batch_quality_check_notification ON public.batches;
CREATE TRIGGER batch_quality_check_notification
    AFTER INSERT ON public.batches
    FOR EACH ROW
    WHEN (NEW.quality_status = 'pending')
    EXECUTE FUNCTION notify_quality_check_required();

-- Create notification when a new EPCIS event is created
CREATE OR REPLACE FUNCTION notify_event_created()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify the user who created the event
    IF NEW.user_id IS NOT NULL THEN
        PERFORM create_notification(
            NEW.user_id,
            'event_created',
            'Event Created Successfully',
            'Your ' || NEW.event_type || ' event has been recorded',
            'normal',
            'event',
            NEW.id,
            '/events/' || NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS event_created_notification ON public.events;
CREATE TRIGGER event_created_notification
    AFTER INSERT ON public.events
    FOR EACH ROW
    WHEN (NEW.source_type = 'manual')
    EXECUTE FUNCTION notify_event_created();

-- Create notification when a shipment is dispatched
CREATE OR REPLACE FUNCTION notify_shipment_dispatched()
RETURNS TRIGGER AS $$
DECLARE
    v_users UUID[];
    v_user UUID;
BEGIN
    -- Get logistics managers and admins
    SELECT ARRAY_AGG(id) INTO v_users
    FROM public.users
    WHERE role IN ('logistics_manager', 'factory_manager', 'admin');
    
    -- Create notification for each relevant user
    FOREACH v_user IN ARRAY v_users
    LOOP
        PERFORM create_notification(
            v_user,
            'shipment_dispatched',
            'Shipment Dispatched',
            'Shipment ' || NEW.shipment_number || ' has been dispatched',
            'normal',
            'shipment',
            NEW.id,
            '/shipments/' || NEW.id
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shipment_dispatched_notification ON public.shipments;
CREATE TRIGGER shipment_dispatched_notification
    AFTER UPDATE ON public.shipments
    FOR EACH ROW
    WHEN (OLD.status = 'preparing' AND NEW.status = 'in_transit')
    EXECUTE FUNCTION notify_shipment_dispatched();

-- Create notification when a shipment is delivered
CREATE OR REPLACE FUNCTION notify_shipment_delivered()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify the user who received the shipment
    IF NEW.received_by IS NOT NULL THEN
        PERFORM create_notification(
            NEW.received_by,
            'shipment_delivered',
            'Shipment Delivered',
            'Shipment ' || NEW.shipment_number || ' has been delivered successfully',
            'normal',
            'shipment',
            NEW.id,
            '/shipments/' || NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shipment_delivered_notification ON public.shipments;
CREATE TRIGGER shipment_delivered_notification
    AFTER UPDATE ON public.shipments
    FOR EACH ROW
    WHEN (OLD.status != 'delivered' AND NEW.status = 'delivered')
    EXECUTE FUNCTION notify_shipment_delivered();

-- Create notification when certification is expiring soon (30 days)
CREATE OR REPLACE FUNCTION notify_certification_expiring()
RETURNS VOID AS $$
DECLARE
    v_cert RECORD;
    v_users UUID[];
    v_user UUID;
BEGIN
    -- Get all certifications expiring in 30 days
    FOR v_cert IN 
        SELECT * FROM public.certifications
        WHERE status = 'active'
        AND expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')
    LOOP
        -- Get admins and factory managers
        SELECT ARRAY_AGG(id) INTO v_users
        FROM public.users
        WHERE role IN ('admin', 'factory_manager');
        
        -- Create notification for each relevant user
        FOREACH v_user IN ARRAY v_users
        LOOP
            PERFORM create_notification(
                v_user,
                'certification_expiring',
                'Certification Expiring Soon',
                'Certification ' || v_cert.certificate_number || ' expires on ' || v_cert.expiry_date,
                'high',
                'certification',
                v_cert.id,
                '/certifications/' || v_cert.id
            );
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.notifications IS 'User notifications for system events and alerts';
COMMENT ON COLUMN public.notifications.type IS 'Type of notification event';
COMMENT ON COLUMN public.notifications.priority IS 'Notification priority level';
COMMENT ON COLUMN public.notifications.is_read IS 'Whether the notification has been read';
COMMENT ON COLUMN public.notifications.action_url IS 'URL to navigate when notification is clicked';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
