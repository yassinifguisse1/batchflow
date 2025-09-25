import { memo, useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Globe, Settings, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ParameterSuggestions from '../workflow/ParameterSuggestions';
import ExecutionNotification from '../workflow/ExecutionNotification';
import ExecutionResultDialog from '../workflow/ExecutionResultDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const HTTPTaskNode = memo(({
  data,
  id
}: {
  data: any;
  id: string;
}) => {
  const [config, setConfig] = useState(data.config || {
    method: 'POST',
    url: '',
    contentType: 'application/json',
    headers: '{}',
    body: '{}'
  });
  
  const [showResultDialog, setShowResultDialog] = useState(false);
  const { toast } = useToast();

  // Listen for workflow execution updates to update status in real-time
  useEffect(() => {
    const executionChannel = supabase
      .channel(`http-task-${id}-execution`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_executions'
        },
        (payload) => {
          console.log(`🌐 HTTP Task ${id} received execution update:`, payload);
          
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
            
            console.log(`🌐 HTTP Task ${id}: isExecuted=${isExecuted}, isCurrent=${isCurrent}, hasResult=${!!hasResult}, status=${status}, currentStatus=${data.status}`);
            
            if (data.onNodeUpdate) {
              let nodeStatus = data.status || 'idle';
              
              // FORCE COMPLETION: If workflow is completed/success, force ALL nodes to completed
              if (status === 'completed' || status === 'success') {
                console.log(`🔄 FORCING HTTP Task ${id} to completed due to workflow completion`);
                nodeStatus = 'completed';
                data.onNodeUpdate(id, {
                  status: 'completed',
                  hasResult: !!hasResult || !!data.executionResult,
                  executionResult: hasResult ? nodeResults[id] : data.executionResult,
                  hasCompletedExecution: true
                });
                return;
              }
              
              if (status === 'running' && isCurrent) {
                nodeStatus = 'running';
                toast({
                  title: "HTTP Request Started",
                  description: `${data.label} is making request...`,
                });
              } else if (isExecuted && status === 'completed') {
                nodeStatus = 'completed';
                toast({
                  title: "HTTP Request Completed", 
                  description: `${data.label} completed successfully`,
                });
              } else if (status === 'failed') {
                // Check if this specific node failed
                const errorDetails = execution.error_details;
                if (errorDetails && errorDetails.failed_node_id === id) {
                  nodeStatus = 'error';
                  toast({
                    title: "HTTP Request Failed",
                    description: `${data.label}: ${errorDetails.error_message}`,
                    variant: "destructive"
                  });
                } else if (isExecuted || isCurrent) {
                  // Node was part of failed workflow
                  nodeStatus = 'error';
                  toast({
                    title: "HTTP Request Failed",
                    description: `${data.label} encountered an error`,
                    variant: "destructive"
                  });
                }
              }
              
              // Only update if status actually changed
              if (nodeStatus !== data.status || (hasResult && !data.hasCompletedExecution)) {
                console.log(`🌐 Updating HTTP Task ${id} status: ${data.status} -> ${nodeStatus}`);
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
        console.log(`🌐 HTTP Task ${id} execution subscription status:`, status, err);
      });

    return () => {
      console.log(`🌐 Cleaning up HTTP Task ${id} execution subscription`);
      supabase.removeChannel(executionChannel);
    };
  }, [id, data.label, data.onNodeUpdate, data.status, data.hasCompletedExecution, toast]);
  
  const updateConfig = (key: string, value: any) => {
    const newConfig = {
      ...config,
      [key]: value
    };
    setConfig(newConfig);
    data.config = newConfig;
  };

  const executeHTTPTask = async () => {
    try {
      data.status = 'running';
      
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: result, error } = await supabase.functions.invoke('http-task', {
        body: { config }
      });

      if (error) {
        console.error('HTTP Task execution error:', error);
        data.status = 'error';
        data.executionResult = {
          error: error.message,
          success: false
        };
      } else {
        console.log('HTTP Task result:', result);
        data.status = result?.success === false ? 'error' : 'completed';
        data.executionResult = result;
        data.hasResult = true;
        data.hasCompletedExecution = true;
      }
    } catch (error) {
      console.error('HTTP Task execution failed:', error);
      data.status = 'error';
      data.executionResult = {
        error: (error as Error).message,
        success: false
      };
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-success text-success-foreground';
      case 'POST':
        return 'bg-primary text-primary-foreground';
      case 'PUT':
        return 'bg-warning text-warning-foreground';
      case 'DELETE':
        return 'bg-destructive text-destructive-foreground';
      case 'PATCH':
        return 'bg-secondary text-secondary-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
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
        return 'border-success/30';
    }
  };

  return (
    <Card className={`min-w-[220px] bg-gradient-secondary shadow-card relative ${getStatusColor()}`}>
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-success text-success-foreground text-xs font-bold">
              {data.nodeNumber || '1'}
            </div>
            <div className="p-1.5 rounded-md bg-success/10">
              <Globe className="h-4 w-4 text-success" />
            </div>
            <span className="font-medium text-sm">{data.label}</span>
          </div>
          <div className="flex items-center gap-1">
            {data.status && data.status !== 'idle' && (
              <Badge variant={data.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                {data.status}
              </Badge>
            )}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <Settings className="h-3 w-3" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Configure HTTP Request</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Method</Label>
                        <Select value={config.method} onValueChange={value => updateConfig('method', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                            <SelectItem value="DELETE">DELETE</SelectItem>
                            <SelectItem value="PATCH">PATCH</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Content Type</Label>
                        <Select value={config.contentType || 'application/json'} onValueChange={value => updateConfig('contentType', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="application/json">JSON</SelectItem>
                            <SelectItem value="multipart/form-data">Form Data</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>URL</Label>
                      <ParameterSuggestions 
                        nodeId={id} 
                        value={config.url || ''} 
                        onChange={value => updateConfig('url', value)} 
                        placeholder="https://api.example.com/endpoint" 
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Headers (JSON)</Label>
                    <ParameterSuggestions 
                      nodeId={id} 
                      value={config.headers || '{}'} 
                      onChange={value => updateConfig('headers', value)} 
                      placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}' 
                      className="min-h-[72px]" 
                    />
                  </div>
                  
                  <div>
                    <Label>
                      Request Body {config.contentType === 'multipart/form-data' ? '(Form Data - Key:Value pairs)' : '(JSON)'}
                    </Label>
                    <ParameterSuggestions 
                      nodeId={id} 
                      value={config.body || ''} 
                      onChange={value => updateConfig('body', value)} 
                      placeholder={config.contentType === 'multipart/form-data' 
                        ? 'key1=value1\nkey2=value2\nfile=@/path/to/file' 
                        : '{"key": "value"}'
                      } 
                      className="min-h-[96px]" 
                    />
                  </div>
                  
                  <div className="mt-4">
                    <Button onClick={executeHTTPTask} className="w-full">
                      Test HTTP Request
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-3 pt-1">
        <div className="flex items-center gap-2 mb-2">
          <Badge className={`text-xs ${getMethodColor(config.method || 'GET')}`}>
            {config.method || 'GET'}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {config.url || 'No URL configured'}
        </div>
        {(() => {
          try {
            const headersObj = config.headers && config.headers.trim() ? JSON.parse(config.headers) : {};
            const headerCount = Object.keys(headersObj).length;
            return headerCount > 0 ? (
              <div className="text-xs text-muted-foreground mt-1">
                {headerCount} headers
              </div>
            ) : null;
          } catch (e) {
            return null;
          }
        })()}
      </CardContent>
      
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-success border-2 border-background" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-success border-2 border-background" />
      
      {/* Execution Start Indicator */}
      {data.isExecutionStart && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-primary rounded-full flex items-center justify-center shadow-md border-2 border-background">
          <Zap className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
      
      {/* Execution notification */}
      <ExecutionNotification 
        status={data.status}
        hasResult={!!data.executionResult}
        onClick={() => setShowResultDialog(true)}
      />
      
      {/* Execution result dialog */}
      <ExecutionResultDialog
        open={showResultDialog}
        onOpenChange={setShowResultDialog}
        result={data.executionResult}
        nodeName={data.label || 'HTTP Task'}
        nodeConfig={config}
      />
    </Card>
  );
});

HTTPTaskNode.displayName = 'HTTPTaskNode';
export default HTTPTaskNode;
