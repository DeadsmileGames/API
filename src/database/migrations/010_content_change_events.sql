ALTER TABLE content_events DROP CONSTRAINT content_events_event_type_check;
ALTER TABLE content_events ADD CONSTRAINT content_events_event_type_check CHECK (event_type IN ('news.published', 'game.published', 'video.published', 'news.updated', 'game.updated', 'video.updated', 'news.deleted', 'game.deleted', 'video.deleted', 'wishlist.updated'));
