import { memo, useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Zap, Webhook, Calendar, Database, Layers, Zap as ExecutionStart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ExecutionNotification from '../workflow/ExecutionNotification';
import ExecutionResultDialog from '../workflow/ExecutionResultDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
const TriggerNode = memo(({
  data,
  id
}: {
  data: any;
  id: string;
}) => {
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [webhookRequests, setWebhookRequests] = useState<any[]>([]);
  const [latestRequest, setLatestRequest] = useState<any>(null);
  const { toast } = useToast();

  // Listen for workflow execution updates to force completion
  useEffect(() => {
    const executionChannel = supabase
      .channel(`trigger-${id}-execution`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_executions'
        },
        (payload) => {
          console.log(`🎯 Trigger ${id} received execution update:`, payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const execution = payload.new;
            const executedNodeIds = execution.executed_nodes || [];
            const currentNodeId = execution.current_node_id;
            const status = execution.status;
            const nodeResults = execution.result_data?.nodeResults;
            
            // Check if this node is being executed or has been executed
            const isExecuted = executedNodeIds.includes(id);
            const isCurrent = currentNodeId === id;
            const hasResult = nodeResults && nodeResults[id];
            
            console.log(`🎯 Trigger ${id}: isExecuted=${isExecuted}, isCurrent=${isCurrent}, hasResult=${!!hasResult}, status=${status}, currentStatus=${data.status}`);
            
            if (data.onNodeUpdate) {
              let nodeStatus = data.status || 'idle';
              
              // FORCE COMPLETION: If workflow is completed/success, force ALL nodes to completed
              if (status === 'completed' || status === 'success') {
                console.log(`🔄 FORCING Trigger ${id} to completed due to workflow completion`);
                nodeStatus = 'completed';
                data.onNodeUpdate(id, {
                  status: 'completed',
                  hasResult: !!hasResult || !!data.executionResult || !!latestRequest,
                  executionResult: hasResult ? nodeResults[id] : data.executionResult,
                  hasCompletedExecution: true
                });
                return;
              }
              
              if (status === 'running' && isCurrent) {
                nodeStatus = 'running';
                toast({
                  title: "Trigger Started",
                  description: `${data.label} is processing...`,
                });
              } else if (isExecuted && status === 'completed') {
                nodeStatus = 'completed';
                toast({
                  title: "Trigger Completed", 
                  description: `${data.label} completed successfully`,
                });
              } else if (status === 'failed') {
                // Check if this specific node failed
                const errorDetails = execution.error_details;
                if (errorDetails && errorDetails.failed_node_id === id) {
                  nodeStatus = 'error';
                  toast({
                    title: "Trigger Failed",
                    description: `${data.label}: ${errorDetails.error_message}`,
                    variant: "destructive"
                  });
                } else if (isExecuted || isCurrent) {
                  // Node was part of failed workflow
                  nodeStatus = 'error';
                  toast({
                    title: "Trigger Failed",
                    description: `${data.label} encountered an error`,
                    variant: "destructive"
                  });
                }
              }
              
              // Only update if status actually changed
              if (nodeStatus !== data.status || (hasResult && !data.hasCompletedExecution)) {
                console.log(`🎯 Updating Trigger ${id} status: ${data.status} -> ${nodeStatus}`);
                data.onNodeUpdate(id, {
                  status: nodeStatus,
                  hasResult: !!hasResult,
                  executionResult: hasResult ? nodeResults[id] : data.executionResult,
                  hasCompletedExecution: isExecuted && status === 'completed'
                });
              }
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`🎯 Trigger ${id} execution subscription status:`, status, err);
      });

    return () => {
      console.log(`🎯 Cleaning up Trigger ${id} execution subscription`);
      supabase.removeChannel(executionChannel);
    };
  }, [id, data.label, data.onNodeUpdate, data.status, data.hasCompletedExecution, toast, latestRequest]);

  // Fetch webhook requests for this trigger
  useEffect(() => {
    // Check for webhook ID in either webhookId or webhook.id structure
    const webhookId = data.config?.webhookId || data.config?.webhook?.id || data.config?.selectedHook;
    
    console.log('🔍 TriggerNode webhook ID:', webhookId, 'triggerType:', data.config?.triggerType);
    console.log('🔍 TriggerNode full config:', data.config);
    
    const fetchWebhookRequests = async () => {
      if (!webhookId && data.config?.triggerType === 'webhook') {
        console.log('⚠️ No webhook ID found for webhook trigger');
        return;
      }

      if (webhookId) {
        try {
          console.log('📡 Fetching webhook requests for ID:', webhookId);
          const { data: requests, error } = await supabase
            .from('webhook_requests')
            .select('*')
            .eq('webhook_id', webhookId)
            .order('created_at', { ascending: false })
            .limit(10);

          if (error) {
            console.error('Error fetching webhook requests:', error);
            return;
          }

          console.log('📦 Webhook requests fetched:', requests);
          setWebhookRequests(requests || []);
          if (requests && requests.length > 0) {
            console.log('🎯 Latest request:', requests[0]);
            setLatestRequest(requests[0]);
          }
        } catch (error) {
          console.error('Error fetching webhook requests:', error);
        }
      }
    };

    fetchWebhookRequests();

    // Set up real-time subscription for webhook requests with a unique channel name
    if (webhookId) {
      const channelName = `webhook-requests-${webhookId}-${id}`;
      console.log('🔌 Setting up real-time subscription:', channelName);
      
      // Clean up any existing subscriptions for this webhook first
      const existingChannels = supabase.getChannels();
      existingChannels.forEach(channel => {
        if (channel.topic?.includes(`webhook-requests-${webhookId}`) && channel.topic !== channelName) {
          console.log('🧹 Cleaning up duplicate subscription:', channel.topic);
          supabase.removeChannel(channel);
        }
      });
      
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'webhook_requests',
            filter: `webhook_id=eq.${webhookId}`
          },
          (payload) => {
            const newRequest = payload.new;
            console.log(`🔔 TriggerNode [${channelName}] received new webhook request:`, newRequest, 'for node:', id);
            
            // Set status to running immediately when webhook is triggered
            if (data.onNodeUpdate) {
              console.log(`🔄 TriggerNode [${channelName}]: Updating node status to running for:`, id);
              data.onNodeUpdate(id, { 
                status: 'running',
                hasResult: false 
              });
            }
            
            // Show visual feedback for running state
            toast({
              title: "Workflow Started",
              description: `${data.label} is now processing...`,
            });
            
            setWebhookRequests(prev => [newRequest, ...prev.slice(0, 9)]);
            setLatestRequest(newRequest);
            
            // Show toast notification for new webhook request
            toast({
              title: "Webhook Triggered",
              description: `Processing request for ${data.label}`,
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'webhook_requests',
            filter: `webhook_id=eq.${webhookId}`
          },
          (payload) => {
            const updatedRequest = payload.new;
            console.log(`🔄 TriggerNode [${channelName}] received webhook request update:`, updatedRequest, 'for node:', id);
            
            setWebhookRequests(prev => 
              prev.map(req => req.id === updatedRequest.id ? updatedRequest : req)
            );
            
            if (latestRequest?.id === updatedRequest.id) {
              setLatestRequest(updatedRequest);
            }
            
            // Update node status based on response
            if (data.onNodeUpdate && updatedRequest.response_status) {
              const status = updatedRequest.response_status >= 200 && updatedRequest.response_status < 300 
                ? 'completed' 
                : 'error';
              
              console.log(`🔄 [${channelName}] Updating node status to`, status, 'for:', id);
              data.onNodeUpdate(id, { 
                status,
                hasResult: true,
                executionResult: {
                  success: status === 'completed',
                  result: updatedRequest.response_body,
                  timestamp: updatedRequest.created_at,
                  processingTime: updatedRequest.processing_time_ms,
                  requestData: updatedRequest.request_body
                },
                hasCompletedExecution: true
              });
              
              // Show completion toast
              toast({
                title: status === 'completed' ? "Webhook Completed" : "Webhook Error",
                description: `${data.label} finished processing`,
              });
            }
          }
        )
        .subscribe((status, err) => {
          console.log(`🔌 [${channelName}] Subscription status:`, status, err);
          
          // If subscription fails, set up polling fallback
          if (status === 'CHANNEL_ERROR') {
            console.warn(`❌ [${channelName}] Subscription failed, setting up polling fallback`);
            const pollInterval = setInterval(async () => {
              try {
                const { data: requests } = await supabase
                  .from('webhook_requests')
                  .select('*')
                  .eq('webhook_id', webhookId)
                  .order('created_at', { ascending: false })
                  .limit(1);
                
                if (requests && requests.length > 0) {
                  const latest = requests[0];
                  if (!latestRequest || latest.created_at !== latestRequest.created_at) {
                    console.log(`📊 [${channelName}] Polling found new request:`, latest);
                    setLatestRequest(latest);
                    setWebhookRequests(prev => [latest, ...prev.slice(0, 9)]);
                    
                    // Trigger status updates
                    if (data.onNodeUpdate) {
                      if (latest.response_status) {
                        const status = latest.response_status >= 200 && latest.response_status < 300 
                          ? 'completed' 
                          : 'error';
                        
                        data.onNodeUpdate(id, { 
                          status,
                          hasResult: true,
                          executionResult: {
                            success: status === 'completed',
                            result: latest.response_body,
                            timestamp: latest.created_at,
                            processingTime: latest.processing_time_ms,
                            requestData: latest.request_body
                          },
                          hasCompletedExecution: true
                        });
                      } else {
                        data.onNodeUpdate(id, { 
                          status: 'running',
                          hasResult: false 
                        });
                      }
                    }
                  }
                }
              } catch (error) {
                console.error(`[${channelName}] Polling error:`, error);
              }
            }, 3000);
            
            // Store the interval for cleanup
            (channel as any).pollInterval = pollInterval;
          }
        });

      return () => {
        console.log(`🔌 [${channelName}] Cleaning up subscription`);
        // Clear polling interval if it exists
        if ((channel as any).pollInterval) {
          clearInterval((channel as any).pollInterval);
        }
        supabase.removeChannel(channel);
      };
    }
  }, [data.config?.webhookId, data.config?.webhook?.id, data.config?.selectedHook, data.config?.triggerType, data.label, data.onNodeUpdate, id, toast]);
  const getTriggerIcon = () => {
    switch (data.config?.triggerType) {
      case 'webhook':
        return <Webhook className="h-5 w-5" />;
      case 'batch':
        return <Layers className="h-5 w-5" />;
      case 'schedule':
        return <Calendar className="h-5 w-5" />;
      case 'database':
        return <Database className="h-5 w-5" />;
      default:
        return <Zap className="h-5 w-5" />;
    }
  };
  const getStatusColor = () => {
    // Keep consistent styling - no color changes based on status
    return 'border-primary';
  };
  return <Card className={`min-w-[220px] bg-gradient-to-br from-primary to-primary-glow shadow-card relative ${getStatusColor()}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-primary-foreground">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-foreground text-primary text-xs font-bold">
              {data.nodeNumber || '1'}
            </div>
            {getTriggerIcon()}
            <span className="font-semibold">{data.label}</span>
          </div>
           {data.status && data.status !== 'idle' && <Badge variant={data.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
             {data.status}
           </Badge>}
        </div>
        
        <div className="text-xs text-primary-foreground/80">
          {data.config?.triggerType ? `${data.config.triggerType} trigger` : 'Workflow entry point'}
        </div>
      </CardContent>
      
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-primary-foreground border-2 border-primary" />
      
      {/* Execution Start Indicator */}
      {data.isExecutionStart && (
        <div className="absolute -top-2 -left-2 w-6 h-6 bg-gradient-to-br from-primary to-primary-glow rounded-full flex items-center justify-center shadow-md border-2 border-background">
          <ExecutionStart className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
      
      {/* Execution notification - show when node has results or completed execution */}
      {(() => {
        const hasResult = !!(data.executionResult || (latestRequest && (latestRequest.response_status || latestRequest.response_body)));
        const hasStatus = data.status && data.status !== 'idle';
        console.log(`🔔 TriggerNode ExecutionNotification debug for ${data.label}:`, {
          hasResult,
          hasStatus,
          latestRequest: !!latestRequest,
          latestResponseStatus: latestRequest?.response_status,
          executionResult: !!data.executionResult,
          status: data.status,
          shouldShow: hasResult || hasStatus
        });
        return (
          <ExecutionNotification 
            status={data.status}
            hasResult={hasResult}
            onClick={() => setShowResultDialog(true)}
          />
        );
      })()}
      
      <ExecutionResultDialog
        open={showResultDialog}
        onOpenChange={setShowResultDialog}
        result={latestRequest ? {
          status: latestRequest.response_status >= 200 && latestRequest.response_status < 300 ? 'completed' : 'error',
          request_body: latestRequest.request_body,
          response_body: latestRequest.response_body,
          statusCode: latestRequest.response_status,
          headers: latestRequest.request_headers,
          executionTime: latestRequest.processing_time_ms ? latestRequest.processing_time_ms / 1000 : undefined,
          timestamp: latestRequest.created_at,
          // Include all webhook request data for full visibility
          id: latestRequest.id,
          webhook_id: latestRequest.webhook_id,
          processing_time_ms: latestRequest.processing_time_ms,
          data: {
            // Show the received webhook data first
            receivedData: latestRequest.request_body,
            // Show all individual fields from the webhook request
            ...latestRequest.request_body,
            request: {
              body: latestRequest.request_body,
              headers: latestRequest.request_headers,
              webhook_id: latestRequest.webhook_id,
              timestamp: latestRequest.created_at
            },
            response: {
              body: latestRequest.response_body,
              status: latestRequest.response_status,
              processing_time_ms: latestRequest.processing_time_ms
            },
            execution: {
              id: latestRequest.id,
              created_at: latestRequest.created_at,
              webhook_id: latestRequest.webhook_id
            }
          }
        } : null}
        nodeName={data.label || 'Webhook Trigger'}
        nodeConfig={data.config}
        isWebhookTrigger={data.config?.triggerType === 'webhook'}
      />
    </Card>;
});
TriggerNode.displayName = 'TriggerNode';
export default TriggerNode;