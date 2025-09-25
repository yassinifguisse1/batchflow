-- Enable replica identity and realtime for workflow_executions table
ALTER TABLE workflow_executions REPLICA IDENTITY FULL;

-- Add to realtime publication immediately
ALTER publication supabase_realtime ADD TABLE workflow_executions;