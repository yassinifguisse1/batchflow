-- Enable real-time for webhook_requests table
ALTER TABLE public.webhook_requests REPLICA IDENTITY FULL;

-- Add webhook_requests to the realtime publication
ALTER publication supabase_realtime ADD TABLE public.webhook_requests;