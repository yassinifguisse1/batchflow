-- Enable full replica identity for webhook_requests table to capture complete row data
ALTER TABLE public.webhook_requests REPLICA IDENTITY FULL;