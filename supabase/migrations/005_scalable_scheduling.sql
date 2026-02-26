-- Optimized composite index for the scheduler's windowed query.
-- Covers: WHERE status = 'scheduled' AND scheduled_at <= ?
-- This replaces the less efficient separate indexes for high-volume lookups.
CREATE INDEX IF NOT EXISTS idx_content_items_scheduled_composite
    ON content_items(status, scheduled_at)
    WHERE status IN ('scheduled', 'publishing');

-- Index for quick lookups of publishing-in-progress posts (prevents double-enqueue)
CREATE INDEX IF NOT EXISTS idx_content_items_publishing
    ON content_items(status)
    WHERE status = 'publishing';
