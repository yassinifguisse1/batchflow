import { memo, useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileText, Settings, Zap } from 'lucide-react';
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

const MultipartHTTPNode = memo(({
  data,
  id
}: {
  data: any;
  id: string;
}) => {
  const [config, setConfig] = useState(data.config || {
    method: 'POST',
    url: '',
    headers: JSON.stringify({
      "Authorization": "Bearer your-token-here"
    }, null, 2),
    formData: 'file=@/path/to/file\nname=value\ndescription=Sample file upload'
  });
  
  const [showResultDialog, setShowResultDialog] = useState(false);
  const { toast } = useToast();

  // Listen for workflow execution updates to update status in real-time
  useEffect(() => {
    const executionChannel = supabase
      .channel(`multipart-http-task-${id}-execution`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_executions'
        },
        (payload) => {
          console.log(`📎 Multipart HTTP Task ${id} received execution update:`, payload);
          
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
            
            console.log(`📎 Multipart HTTP Task ${id}: isExecuted=${isExecuted}, isCurrent=${isCurrent}, hasResult=${!!hasResult}, status=${status}, currentStatus=${data.status}`);
            
            if (data.onNodeUpdate) {
              let nodeStatus = data.status || 'idle';
              
              // FORCE COMPLETION: If workflow is completed/success, force ALL nodes to completed
              if (status === 'completed' || status === 'success') {
                console.log(`🔄 FORCING Multipart HTTP Task ${id} to completed due to workflow completion`);
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
                  title: "Multipart Upload Started",
                  description: `${data.label} is uploading...`,
                });
              } else if (isExecuted && status === 'completed') {
                nodeStatus = 'completed';
                toast({
                  title: "Multipart Upload Completed", 
                  description: `${data.label} completed successfully`,
                });
              } else if (status === 'failed') {
                // Check if this specific node failed
                const errorDetails = execution.error_details;
                if (errorDetails && errorDetails.failed_node_id === id) {
                  nodeStatus = 'error';
                  toast({
                    title: "Multipart Upload Failed",
                    description: `${data.label}: ${errorDetails.error_message}`,
                    variant: "destructive"
                  });
                } else if (isExecuted || isCurrent) {
                  // Node was part of failed workflow
                  nodeStatus = 'error';
                  toast({
                    title: "Multipart Upload Failed",
                    description: `${data.label} encountered an error`,
                    variant: "destructive"
                  });
                }
              }
              
              // Only update if status actually changed
              if (nodeStatus !== data.status || (hasResult && !data.hasCompletedExecution)) {
                console.log(`📎 Updating Multipart HTTP Task ${id} status: ${data.status} -> ${nodeStatus}`);
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
        console.log(`📎 Multipart HTTP Task ${id} execution subscription status:`, status, err);
      });

    return () => {
      console.log(`📎 Cleaning up Multipart HTTP Task ${id} execution subscription`);
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

  const executeMultipartHTTP = async () => {
    try {
      data.status = 'running';
      
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: result, error } = await supabase.functions.invoke('http-task', {
        body: { 
          config: {
            ...config,
            contentType: 'multipart/form-data'
          }
        }
      });

      if (error) {
        console.error('Multipart HTTP Task execution error:', error);
        data.status = 'error';
        data.executionResult = {
          error: error.message,
          success: false
        };
      } else {
        console.log('Multipart HTTP Task result:', result);
        data.status = result?.success === false ? 'error' : 'completed';
        data.executionResult = result;
        data.hasResult = true;
        data.hasCompletedExecution = true;
      }
    } catch (error) {
      console.error('Multipart HTTP Task execution failed:', error);
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
        return 'border-primary/30';
    }
  };

  return (
    <Card className={`min-w-[240px] bg-gradient-secondary shadow-card relative ${getStatusColor()}`}>
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {data.nodeNumber || '1'}
            </div>
            <div className="p-1.5 rounded-md bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
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
                  <DialogTitle>Configure Multipart Form Data Request</DialogTitle>
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
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                            <SelectItem value="PATCH">PATCH</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Content Type</Label>
                        <Input value="multipart/form-data" disabled className="bg-muted" />
                      </div>
                    </div>
                    <div>
                      <Label>URL</Label>
                      <ParameterSuggestions 
                        nodeId={id} 
                        value={config.url || ''} 
                        onChange={value => updateConfig('url', value)} 
                        placeholder="https://api.example.com/upload" 
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Headers (JSON)</Label>
                    <ParameterSuggestions 
                      nodeId={id} 
                      value={config.headers || '{}'} 
                      onChange={value => updateConfig('headers', value)} 
                      placeholder='{"Authorization": "Bearer token"}' 
                      className="min-h-[72px]" 
                    />
                  </div>
                  
                  <div>
                    <Label>Form Data (Key=Value pairs, use @file for file uploads)</Label>
                    <ParameterSuggestions 
                      nodeId={id} 
                      value={config.formData || ''} 
                      onChange={value => updateConfig('formData', value)} 
                      placeholder="file=@/path/to/file\nname=John Doe\nemail=john@example.com\ndescription=Sample upload" 
                      className="min-h-[120px]" 
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      • Use @/path/to/file for file uploads<br/>
                      • Each line should be in format: key=value<br/>
                      • Files will be automatically detected with @ prefix
                    </p>
                  </div>
                  
                  <div className="mt-4">
                    <Button onClick={executeMultipartHTTP} className="w-full">
                      Test Multipart Upload
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
          <Badge className={`text-xs ${getMethodColor(config.method || 'POST')}`}>
            {config.method || 'POST'}
          </Badge>
          <Badge variant="outline" className="text-xs">
            multipart/form-data
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {config.url || 'No URL configured'}
        </div>
        {(() => {
          try {
            const formDataLines = config.formData ? config.formData.split('\n').filter(line => line.trim()) : [];
            const fileCount = formDataLines.filter(line => line.includes('@')).length;
            const fieldCount = formDataLines.length - fileCount;
            
            return formDataLines.length > 0 ? (
              <div className="text-xs text-muted-foreground mt-1">
                {fileCount > 0 && `${fileCount} file${fileCount > 1 ? 's' : ''}`}
                {fileCount > 0 && fieldCount > 0 && ', '}
                {fieldCount > 0 && `${fieldCount} field${fieldCount > 1 ? 's' : ''}`}
              </div>
            ) : null;
          } catch (e) {
            return null;
          }
        })()}
      </CardContent>
      
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-primary border-2 border-background" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-primary border-2 border-background" />
      
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
        nodeName={data.label || 'Multipart HTTP'}
        nodeConfig={config}
      />
    </Card>
  );
});

MultipartHTTPNode.displayName = 'MultipartHTTPNode';
export default MultipartHTTPNode;
