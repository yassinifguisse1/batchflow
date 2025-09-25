-- Create webhooks table to store webhook configurations
CREATE TABLE public.webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url_path TEXT NOT NULL UNIQUE, -- The unique path for this webhook
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  api_keys JSONB DEFAULT '[]'::jsonb, -- Store API keys as JSON array
  workflow_data JSONB DEFAULT '{}'::jsonb, -- Store workflow configuration
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

-- Create policies for webhook access
CREATE POLICY "Users can view their own webhooks" 
ON public.webhooks 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own webhooks" 
ON public.webhooks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own webhooks" 
ON public.webhooks 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own webhooks" 
ON public.webhooks 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON public.webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create webhook_requests table to log incoming webhook requests
CREATE TABLE public.webhook_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID REFERENCES public.webhooks(id) ON DELETE CASCADE,
  request_body JSONB,
  request_headers JSONB,
  response_body JSONB,
  response_status INTEGER,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for webhook_requests
ALTER TABLE public.webhook_requests ENABLE ROW LEVEL SECURITY;

-- Policy to allow webhook owners to view their request logs
CREATE POLICY "Users can view their webhook request logs" 
ON public.webhook_requests 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.webhooks 
    WHERE webhooks.id = webhook_requests.webhook_id 
    AND webhooks.user_id = auth.uid()
  )
);

-- Allow the webhook function to insert request logs (public access for function)
CREATE POLICY "Allow webhook function to log requests" 
ON public.webhook_requests 
FOR INSERT 
WITH CHECK (true);