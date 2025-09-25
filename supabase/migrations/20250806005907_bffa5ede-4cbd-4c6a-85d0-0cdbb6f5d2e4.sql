-- Enable real-time for workflow_executions table
ALTER TABLE public.workflow_executions REPLICA IDENTITY FULL;

-- Add the table to the realtime publication if not already added
DO $$
BEGIN
  -- Check if the table is already in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'workflow_executions'
  ) THEN
    -- Add the table to the publication
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_executions;
  END IF;
END $$;