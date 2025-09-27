import { memo, useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { MessageSquare, Settings, Sparkles, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import GPTTaskConfig from '../GPTTaskConfig';
import ExecutionNotification from '../workflow/ExecutionNotification';
import ExecutionResultDialog from '../workflow/ExecutionResultDialog';
import NodeStatusIndicator from '../workflow/NodeStatusIndicator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
const GPTTaskNode = memo(({
  data,
  id
}: {
  data: any;
  id: string;
}) => {
  const [config, setConfig] = useState(data.config || {});
  const [showResultDialog, setShowResultDialog] = useState(false);
  const { toast } = useToast();

  // Debug logging
  console.log('GPTTaskNode data:', { 
    status: data.status, 
    hasResult: !!(data.executionResult && data.hasCompletedExecution),
    executionResult: data.executionResult,
    hasCompletedExecution: data.hasCompletedExecution
  });

  // Listen for workflow execution updates to update status in real-time
  useEffect(() => {
    const executionChannel = supabase
      .channel(`gpt-task-${id}-execution`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_executions'
        },
        (payload) => {
          console.log(`🤖 GPT Task ${id} received execution update:`, payload);
          
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
            
            console.log(`🤖 GPT Task ${id}: isExecuted=${isExecuted}, isCurrent=${isCurrent}, hasResult=${!!hasResult}, status=${status}`);
            
              if (data.onNodeUpdate) {
                let nodeStatus = data.status || 'idle';
                
                console.log(`🔧 FORCE COMPLETE DEBUG ${id}: workflow status=${status}, current node status=${data.status}, isExecuted=${isExecuted}, isCurrent=${isCurrent}`);
                
                if (status === 'running' && isCurrent) {
                  nodeStatus = 'running';
                  toast({
                    title: "GPT Task Started",
                    description: `${data.label} is now processing...`,
                  });
                } else if (status === 'completed' || status === 'success') {
                  // FORCE ALL NODES TO COMPLETED when workflow finishes - no matter what
                  nodeStatus = 'completed';
                  console.log(`🔧 FORCING NODE ${id} TO COMPLETED - workflow finished with status: ${status}`);
                  
                  if (isExecuted) {
                    toast({
                      title: "GPT Task Completed", 
                      description: `${data.label} finished processing`,
                    });
                  }
                } else if (status === 'failed') {
                  // Check if this specific node failed
                  const errorDetails = execution.error_details;
                  if (errorDetails && errorDetails.failed_node_id === id) {
                    nodeStatus = 'error';
                    toast({
                      title: "GPT Task Failed",
                      description: `${data.label}: ${errorDetails.error_message}`,
                      variant: "destructive"
                    });
                  } else if (isExecuted || isCurrent) {
                    // Node was part of failed workflow
                    nodeStatus = 'error';
                    toast({
                      title: "GPT Task Failed",
                      description: `${data.label} encountered an error`,
                      variant: "destructive"
                    });
                  }
                }
                
                // ALWAYS UPDATE when workflow completes - force completion regardless
                const shouldUpdate = nodeStatus !== data.status || 
                                     (hasResult && !data.hasResult) || 
                                     (hasResult && !data.executionResult) ||
                                     (status === 'completed' || status === 'success'); // Force update on completion
                
                if (shouldUpdate) {
                  console.log(`🤖 FORCING UPDATE GPT Task ${id} status: ${data.status} -> ${nodeStatus}`, {
                    hasResult: !!hasResult,
                    nodeResults: hasResult ? nodeResults[id] : null,
                    isExecuted,
                    workflowStatus: status,
                    forceComplete: status === 'completed' || status === 'success'
                  });
                  data.onNodeUpdate(id, {
                    status: nodeStatus,
                    hasResult: !!hasResult,
                    executionResult: hasResult ? nodeResults[id] : data.executionResult,
                    hasCompletedExecution: (status === 'completed' || status === 'success')
                  });
                }
              }
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`🤖 GPT Task ${id} execution subscription status:`, status, err);
      });

    return () => {
      console.log(`🤖 Cleaning up GPT Task ${id} execution subscription`);
      supabase.removeChannel(executionChannel);
    };
  }, [id, data.label, data.onNodeUpdate, data.status, data.hasResult, toast]);
  const updateConfig = (key: string, value: any) => {
    const newConfig = {
      ...config,
      [key]: value
    };
    setConfig(newConfig);
    data.config = newConfig;
  };
  const getStatusColor = () => {
    switch (data.status) {
      case 'running':
        return 'border-warning bg-warning/10';
      case 'completed':
        return 'border-success bg-success/10';
      case 'error':
        return 'border-destructive bg-destructive/10';
      default:
        return 'border-primary/30';
    }
  };
  return <>
      <Card className={`min-w-[220px] bg-gradient-accent shadow-card relative ${getStatusColor()}`}>
        <CardHeader className="p-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {data.nodeNumber || '1'}
              </div>
              <div className="p-1.5 rounded-md bg-primary/10">
                <MessageSquare className="h-4 w-4 text-primary" />
              </div>
              <span className="font-medium text-sm">{data.label}</span>
            </div>
            <div className="flex items-center gap-1">
              {data.status && data.status !== 'idle' && (
                <Badge 
                  variant={
                    data.status === 'completed' ? 'default' : 
                    data.status === 'error' ? 'destructive' : 
                    'secondary'
                  } 
                  className="text-xs"
                >
                  {data.status === 'error' ? '❌ ERROR' : data.status}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-1">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              Model: {config.model || 'gpt-4o-mini'}
            </div>
            {config.max_tokens && <div className="text-xs text-muted-foreground">
              Max tokens: {config.max_tokens}
            </div>}
            <div className="text-xs text-muted-foreground truncate">
              {config.prompt ? config.prompt.substring(0, 40) + '...' : 'No prompt configured'}
            </div>
          </div>
        </CardContent>
        
        <Handle type="target" position={Position.Left} className="w-3 h-3 bg-primary border-2 border-background" />
        <Handle type="source" position={Position.Right} className="w-3 h-3 bg-primary border-2 border-background" />
        
        {/* Execution Start Indicator */}
        {data.isExecutionStart && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-primary rounded-full flex items-center justify-center shadow-md border-2 border-background">
            <Zap className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
        
        {/* Enhanced Status Indicator */}
        <div className="absolute top-2 right-2 z-10">
          <NodeStatusIndicator
            status={data.status || 'idle'}
            hasResult={!!data.executionResult}
            hasCompletedExecution={data.hasCompletedExecution}
            size="sm"
            showLabel={false}
          />
        </div>

        {/* Execution notification - show when node has results or completed execution */}
        {(() => {
          const hasResult = !!data.executionResult; // consider any executionResult as content
          const hasStatus = data.status && data.status !== 'idle';
          console.log(`🔔 ExecutionNotification debug for ${data.label}:`, {
            hasResult,
            hasStatus,
            executionResult: data.executionResult,
            hasCompletedExecution: data.hasCompletedExecution,
            hasResultProp: data.hasResult,
            status: data.status,
            shouldShow: hasStatus || hasResult
          });
          return (
            <ExecutionNotification 
              status={data.status}
              hasResult={hasResult}
              onClick={() => setShowResultDialog(true)}
            />
          );
        })()}
        
        {/* Execution result dialog */}
        <ExecutionResultDialog
          open={showResultDialog}
          onOpenChange={setShowResultDialog}
          result={data.executionResult}
          nodeName={data.label || 'GPT Task'}
          nodeConfig={config}
        />
      </Card>
    </>;
});
GPTTaskNode.displayName = 'GPTTaskNode';
export default GPTTaskNode;