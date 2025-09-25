-- Create workflow execution tracking table
CREATE TABLE public.workflow_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
  webhook_request_id UUID REFERENCES public.webhook_requests(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'error')),
  executed_nodes JSONB DEFAULT '[]'::jsonb,
  current_node_id TEXT,
  result_data JSONB,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their workflow executions" 
ON public.workflow_executions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert workflow executions" 
ON public.workflow_executions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update workflow executions" 
ON public.workflow_executions 
FOR UPDATE 
USING (true);

-- Create indexes for performance
CREATE INDEX idx_workflow_executions_workflow_id ON public.workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_webhook_request_id ON public.workflow_executions(webhook_request_id);
CREATE INDEX idx_workflow_executions_user_id ON public.workflow_executions(user_id);

-- Enable realtime for this table
ALTER TABLE public.workflow_executions REPLICA IDENTITY FULL;