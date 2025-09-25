import { memo, useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Webhook, Settings, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import ExecutionNotification from '../workflow/ExecutionNotification';
import ExecutionResultDialog from '../workflow/ExecutionResultDialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import ParameterSuggestions from '../workflow/ParameterSuggestions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
const WebhookResponseNode = memo(({
  data,
  id
}: {
  data: any;
  id: string;
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [config, setConfig] = useState(data.config || {
    statusCode: 200,
    responseBody: '{\n    "image1": "{{HTTP 1.response}}"\n}',
    headers: {},
    showAdvancedSettings: false
  });
  const { toast } = useToast();
  const [bodyError, setBodyError] = useState<string | null>(null);
  const { getNodes, getEdges } = useReactFlow();
  const [previewJSON, setPreviewJSON] = useState<string>('');
  const [placeholderReport, setPlaceholderReport] = useState<{ token: string; resolved: boolean; target?: string }[]>([]);

  // Helper: list all previous nodes (upstream)
  const getAllPreviousNodes = (currentNodeId: string, visited = new Set<string>()): string[] => {
    if (visited.has(currentNodeId)) return [];
    visited.add(currentNodeId);
    const edges = getEdges();
    const incoming = edges.filter(e => e.target === currentNodeId);
    const sources = incoming.map(e => e.source);
    let all: string[] = [];
    sources.forEach(src => {
      all.push(src);
      all.push(...getAllPreviousNodes(src, visited));
    });
    return all;
  };

  // Helper: label for GPT nodes
  const getGptLabel = (node: any) => `GPT ${node?.data?.nodeNumber ?? 1}`;

  // Extract and preview placeholders
  useEffect(() => {
    try {
      if (!config.responseBody) {
        setPreviewJSON('');
        setPlaceholderReport([]);
        return;
      }
      const nodes = getNodes();
      const prevIds = Array.from(new Set(getAllPreviousNodes(id)));
      const prevGptNodes = prevIds
        .map(nid => nodes.find(n => n.id === nid))
        .filter((n: any) => n && n.type === 'gptTask') as any[];

      // Sort roughly by visual flow: y then x
      prevGptNodes.sort((a, b) => {
        if (Math.abs(a.position.y - b.position.y) > 50) return a.position.y - b.position.y;
        return a.position.x - b.position.x;
      });

      const labelSet = new Set(prevGptNodes.map(getGptLabel));

      const content = JSON.parse(config.responseBody);

      const tokens: string[] = [];
      const replaceInValue = (val: any): any => {
        if (typeof val === 'string') {
          return val.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, p1) => {
            const token = String(p1).trim();
            tokens.push(token);
            const base = token.split('.')[0];
            return labelSet.has(base) ? `<${token}>` : `<UNRESOLVED:${token}>`;
          });
        } else if (Array.isArray(val)) {
          return val.map(replaceInValue);
        } else if (val && typeof val === 'object') {
          const out: any = {};
          Object.keys(val).forEach(k => {
            out[k] = replaceInValue(val[k]);
          });
          return out;
        }
        return val;
      };

      const previewObj = replaceInValue(content);
      const uniqueTokens = Array.from(new Set(tokens));
      const report = uniqueTokens.map(t => {
        const base = t.split('.')[0];
        return { token: t, resolved: labelSet.has(base), target: labelSet.has(base) ? base : undefined };
      });
      setPlaceholderReport(report);
      setPreviewJSON(JSON.stringify(previewObj, null, 2));
    } catch {
      setPreviewJSON('');
    }
  }, [config.responseBody, getNodes, getEdges, id]);

  const autoMapGptOutputs = () => {
    try {
      const nodes = getNodes();
      const prevIds = Array.from(new Set(getAllPreviousNodes(id)));
      const prevGptNodes = prevIds
        .map(nid => nodes.find(n => n.id === nid))
        .filter((n: any) => n && n.type === 'gptTask') as any[];

      // Sort by the actual node numbers stored in nodeNumber
      prevGptNodes.sort((a, b) => {
        const getNodeNumber = (node: any) => node?.data?.nodeNumber ?? 1;
        return getNodeNumber(a) - getNodeNumber(b);
      });

      const obj = JSON.parse(config.responseBody || '{}');
      const keys = Object.keys(obj).sort((a, b) => Number(a) - Number(b)); // Sort keys numerically
      const mapped: any = {};

      // Map keys to actual GPT node numbers (not execution order)
      keys.forEach((k, i) => {
        const node = prevGptNodes[i];
        if (node) {
          // Use the node's actual number - this is what the backend stores results under
          const nodeNum = node?.data?.nodeNumber ?? (i + 1);
          mapped[k] = `{{GPT ${nodeNum}.result}}`;
        } else {
          // Keep original value if no corresponding node
          mapped[k] = obj[k];
        }
      });

      updateConfig('responseBody', JSON.stringify(mapped, null, 2));
      toast({ title: 'Auto-mapped', description: `Mapped ${keys.length} keys to GPT node numbers.` });
    } catch (e) {
      toast({ title: 'Invalid JSON', description: 'Fix the Body JSON before auto-mapping.', variant: 'destructive' });
    }
  };

  // Listen for workflow execution updates to update status in real-time
  useEffect(() => {
    const executionChannel = supabase
      .channel(`webhook-response-${id}-execution`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_executions'
        },
        (payload) => {
          console.log(`📤 Webhook Response ${id} received execution update:`, payload);
          
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
            
            console.log(`📤 Webhook Response ${id}: isExecuted=${isExecuted}, isCurrent=${isCurrent}, hasResult=${!!hasResult}, status=${status}`);
            
            if (data.onNodeUpdate) {
              let nodeStatus = data.status || 'idle';
              
              // FORCE COMPLETION: If workflow is completed/success, force ALL nodes to completed
              if (status === 'completed' || status === 'success') {
                console.log(`🔄 FORCING Webhook Response ${id} to completed due to workflow completion`);
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
                  title: "Webhook Response Started",
                  description: `${data.label} is sending response...`,
                });
              } else if (isExecuted && status === 'completed') {
                nodeStatus = 'completed';
                toast({
                  title: "Webhook Response Sent", 
                  description: `${data.label} completed successfully`,
                });
              } else if (status === 'failed') {
                // Check if this specific node failed
                const errorDetails = execution.error_details;
                if (errorDetails && errorDetails.failed_node_id === id) {
                  nodeStatus = 'error';
                  toast({
                    title: "Webhook Response Failed",
                    description: `${data.label}: ${errorDetails.error_message}`,
                    variant: "destructive"
                  });
                } else if (isExecuted || isCurrent) {
                  // Node was part of failed workflow
                  nodeStatus = 'error';
                  toast({
                    title: "Webhook Response Failed",
                    description: `${data.label} encountered an error`,
                    variant: "destructive"
                  });
                }
              }
              
              // Only update if status actually changed
              if (nodeStatus !== data.status || (hasResult && !data.hasCompletedExecution)) {
                console.log(`📤 Updating Webhook Response ${id} status: ${data.status} -> ${nodeStatus}`);
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
        console.log(`📤 Webhook Response ${id} execution subscription status:`, status, err);
      });

    return () => {
      console.log(`📤 Cleaning up Webhook Response ${id} execution subscription`);
      supabase.removeChannel(executionChannel);
    };
  }, [id, data.label, data.onNodeUpdate, data.status, data.hasCompletedExecution, toast]);
  const updateConfig = (key: string, value: any) => {
    const newConfig: any = { ...config };

    if (key === 'responseBody') {
      let text = String(value ?? '').trim();
      let error: string | null = null;

      try {
        // If user pasted JSON as a quoted string, attempt to unquote
        if (text.startsWith('"') && text.endsWith('"')) {
          const unquoted = text.slice(1, -1);
          try {
            JSON.parse(unquoted);
            text = unquoted;
          } catch {
            // keep as is; will fail below
          }
        }
        JSON.parse(text);
      } catch {
        error = 'Body must be valid JSON (object or array).';
      }

      setBodyError(error);
      newConfig.responseBody = text;
    } else {
      newConfig[key] = value;
    }

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
        return 'border-secondary/30';
    }
  };
  return <>
      <div className={`bg-gradient-to-br from-pink-500 to-rose-600 p-4 rounded-lg shadow-lg min-w-[200px] border-2 relative ${getStatusColor()}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white text-pink-600 text-xs font-bold">
              {data.nodeNumber || '1'}
            </div>
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <Webhook className="h-4 w-4 text-pink-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="text-white font-semibold text-sm">
                  {data.label || 'Webhook Response'}
                </div>
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
              <div className="text-pink-100 text-xs">
                Status: {config.statusCode || 200}
              </div>
            </div>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-white/20 w-8 h-8 p-0"
                onClick={() => setIsDialogOpen(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-pink-600" />
                  Webhooks
                </DialogTitle>
                <DialogDescription>
                  Configure status, body placeholders like {"{{GPT 1.result}}"}, headers, and preview the resolved response.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1">
                    Status <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    type="number" 
                    min="100" 
                    max="599" 
                    value={config.statusCode} 
                    onChange={e => updateConfig('statusCode', parseInt(e.target.value) || 200)} 
                    placeholder="200" 
                    className="h-10" 
                  />
                  <p className="text-xs text-muted-foreground">
                    Must be higher than or equal to 100.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1">
                    Body <span className="text-red-500">*</span>
                  </Label>
                  <ParameterSuggestions 
                    nodeId={id}
                    value={config.responseBody || ''} 
                    onChange={value => updateConfig('responseBody', value)} 
                    placeholder='{"1": "{{GPT 1.result}}", "2": "{{GPT 2.result}}", "3": "{{GPT 3.result}}"}'
                    className="min-h-[80px]" 
                  />
                  {bodyError && (
                    <p className="text-xs text-destructive">{bodyError}</p>
                  )}
                  {(!config.responseBody || config.responseBody.trim() === '') && (
                    <p className="text-xs text-destructive">Response body is required</p>
                  )}
                </div>

                {/* Live Preview */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Live Preview</Label>
                  <div className="rounded border bg-muted/30 p-2">
                    {previewJSON ? (
                      <pre className="text-xs font-mono whitespace-pre-wrap max-h-48 overflow-auto">{previewJSON}</pre>
                    ) : (
                      <p className="text-xs text-muted-foreground">Enter valid JSON to preview resolved placeholders.</p>
                    )}
                  </div>
                  {placeholderReport.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {placeholderReport.map((r) => (
                        <Badge
                          key={r.token}
                          variant={r.resolved ? 'secondary' : 'destructive'}
                          className="text-[10px]"
                        >
                          {r.resolved ? `OK ${r.token}` : `Missing ${r.token}`}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button variant="secondary" size="sm" onClick={autoMapGptOutputs}>
                      Auto-map GPT outputs
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-sm">Show advanced settings</Label>
                  <Switch 
                    checked={config.showAdvancedSettings} 
                    onCheckedChange={checked => updateConfig('showAdvancedSettings', checked)} 
                  />
                </div>

                {config.showAdvancedSettings && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Custom Headers</Label>
                      <Textarea 
                        value={JSON.stringify(config.headers, null, 2)} 
                        onChange={e => {
                          try {
                            const headers = JSON.parse(e.target.value);
                            updateConfig('headers', headers);
                          } catch {
                            // Invalid JSON, don't update
                          }
                        }} 
                        placeholder='{"Content-Type": "application/json"}' 
                        className="min-h-[60px] resize-none font-mono text-xs" 
                      />
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    className="bg-pink-600 hover:bg-pink-700"
                    onClick={() => {
                      if (bodyError) {
                        toast({ title: 'Invalid JSON', description: bodyError, variant: 'destructive' });
                        return;
                      }
                      if (config.responseBody) {
                        try { JSON.parse(config.responseBody); }
                        catch {
                          toast({ title: 'Invalid JSON', description: 'Fix the Body JSON before saving.', variant: 'destructive' });
                          return;
                        }
                      }
                      setIsDialogOpen(false);
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="text-pink-100 text-xs mb-2">
          Returns custom webhook response
        </div>
        
        {data.status === 'completed' && <div className="flex items-center gap-1 text-green-200 text-xs">
            <CheckCircle className="h-3 w-3" />
            Response sent
          </div>}
        
        {/* Execution notification */}
        <ExecutionNotification 
          status={data.status}
          hasResult={!!data.executionResult}
          onClick={() => setShowResultDialog(true)}
        />
      </div>
      
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-primary border-2 border-background -translate-x-1" />
      
      {/* Execution result dialog */}
      <ExecutionResultDialog
        open={showResultDialog}
        onOpenChange={setShowResultDialog}
        result={data.executionResult}
        nodeName={data.label || 'Webhook Response'}
        nodeConfig={data.config}
      />
    </>;
});
WebhookResponseNode.displayName = 'WebhookResponseNode';
export default WebhookResponseNode;