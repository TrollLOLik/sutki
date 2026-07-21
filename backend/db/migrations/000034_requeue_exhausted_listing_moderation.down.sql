-- Queue recovery is intentionally not reversed. A down migration must not
-- turn an already retrying moderation job back into a permanent failure.
SELECT 1;
