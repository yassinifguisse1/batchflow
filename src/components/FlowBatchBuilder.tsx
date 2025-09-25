import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { ReactFlow, ReactFlowProvider, MiniMap, Controls, Background, useNodesState, useEdgesState, addEdge, Connection, Edge, Node, Position, NodeChange, EdgeChange, BackgroundVariant, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Play, Save, Download, Zap, Settings, Eye, MoreHorizontal, Trash2, Copy, ArrowLeft, FolderPlus, Edit, Menu, History, X, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import GPTTaskNode from './flow-nodes/GPTTaskNode';
import HTTPTaskNode from './flow-nodes/HTTPTaskNode';
import MultipartHTTPNode from './flow-nodes/MultipartHTTPNode';
import ImageTaskNode from './flow-nodes/ImageTaskNode';
import TriggerNode from './flow-nodes/TriggerNode';
import DelayNode from './flow-nodes/DelayNode';
import ConditionalNode from './flow-nodes/ConditionalNode';
import IteratorNode from './flow-nodes/IteratorNode';
import DataTransformNode from './flow-nodes/DataTransformNode';
import RouterNode from './flow-nodes/RouterNode';
import WebhookResponseNode from './flow-nodes/WebhookResponseNode';
import ArrayAggregatorNode from './flow-nodes/ArrayAggregatorNode';
import WorkflowToolbar from './workflow/WorkflowToolbar';
import WorkflowSidebar from './workflow/WorkflowSidebar';
import WorkflowStats from './workflow/WorkflowStats';
import WorkflowContextMenu from './workflow/WorkflowContextMenu';
import NodeContextMenu from './workflow/NodeContextMenu';
import NodeSettingsDialog from './workflow/NodeSettingsDialog';
import WebhookConfig from './webhook/WebhookConfig';
import CustomEdge from './workflow/CustomEdge';
import WorkflowHistorySidebar from './workflow/WorkflowHistorySidebar';

const nodeTypes = {
  gptTask: GPTTaskNode,
  httpTask: HTTPTaskNode,
  multipartHttp: MultipartHTTPNode,
  imageTask: ImageTaskNode,
  trigger: TriggerNode,
  delay: DelayNode,
  conditional: ConditionalNode,
  iterator: IteratorNode,
  dataTransform: DataTransformNode,
  router: RouterNode,
  webhookResponse: WebhookResponseNode,
  arrayAggregator: ArrayAggregatorNode
};

const edgeTypes = {
  default: CustomEdge,
  smoothstep: CustomEdge,
};
interface ExecutionStep {
  nodeId: string;
  nodeName: string;
  status: 'running' | 'completed' | 'failed' | 'error';
  duration: number;
  timestamp: Date;
  result?: any;
  error?: string;
}
interface WorkflowExecution {
  id: number;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed';
  steps: ExecutionStep[];
}
interface NodeData extends Record<string, unknown> {
  label?: string;
  config?: any;
  status?: 'idle' | 'running' | 'completed' | 'error';
  batchEnabled?: boolean;
}
interface Scenario {
  id: string;
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
  settings: {
    parallelMode: boolean;
    batchSize: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
type ViewMode = 'scenarios' | 'create-scenario' | 'workflow';
const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];
const FlowBatchBuilder = () => {
  const [nodes, setNodes, originalOnNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveForm, setSaveForm] = useState({ name: '', description: '' });
  
  // Override onNodesChange to intercept and log any node changes
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    console.log('onNodesChange called with changes:', changes);
    
    // Check if any of the changes are removing nodes
    const removeChanges = changes.filter(change => change.type === 'remove');
    if (removeChanges.length > 0) {
      console.log('Node removal detected through onNodesChange:', removeChanges);
      // This might be React Flow's built-in delete - let's block any toast here
    }
    
    originalOnNodesChange(changes);
  }, [originalOnNodesChange]);

  const [nextNodeNumber, setNextNodeNumber] = useState(1); // Track next available number (starts at 1 since no initial nodes)
  
  // Don't recalculate numbers - use stored permanent numbers
  const nodesWithNumbers = useMemo(() => {
    return nodes.map(node => {
      // If node already has a permanent number, keep it
      if (node.data.nodeNumber !== undefined) {
        return node;
      }
      
      // For nodes without numbers (shouldn't happen with new system), assign based on type
      return {
        ...node,
        data: {
          ...node.data,
          nodeNumber: node.type === 'trigger' ? nextNodeNumber : 1
        }
      };
    });
  }, [nodes]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Start collapsed in workflow mode
  const [executionHistory, setExecutionHistory] = useState<WorkflowExecution[]>([]);
  const [parallelMode, setParallelMode] = useState(false);
  
  // Debug parallelMode changes
  React.useEffect(() => {
    console.log('🔄 parallelMode changed to:', parallelMode);
  }, [parallelMode]);
  const [batchSize, setBatchSize] = useState(5);
  const [currentView, setCurrentView] = useState<ViewMode>('scenarios');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [scenarioForm, setScenarioForm] = useState({
    name: '',
    description: ''
  });
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsNode, setSettingsNode] = useState<Node | null>(null);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<any>(null);
  const [flashbackMode, setFlashbackMode] = useState(false);
  const [originalNodes, setOriginalNodes] = useState<Node[]>([]);
  const [originalEdges, setOriginalEdges] = useState<Edge[]>([]);
  const [executionStartNode, setExecutionStartNode] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Auto-attach execution starter to first node
  useEffect(() => {
    if (nodes.length > 0 && !executionStartNode) {
      const firstNode = nodes[0];
      setExecutionStartNode(firstNode.id);
      
      // Update the first node to have execution start indicator
      setNodes((currentNodes) => 
        currentNodes.map(node => 
          node.id === firstNode.id 
            ? {
                ...node,
                data: {
                  ...node.data,
                  isExecutionStart: true
                }
              }
            : {
                ...node,
                data: {
                  ...node.data,
                  isExecutionStart: false
                }
              }
        )
      );
    }
  }, [nodes.length, executionStartNode, setNodes]);

  // Load workflows from database on component mount
  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) return;

        const { data: workflows, error } = await supabase
          .from('workflows')
          .select('*')
          .eq('user_id', user.user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const loadedScenarios: Scenario[] = workflows?.map(workflow => {
          // Type the workflow_data as any to handle the JSON structure
          const workflowData = workflow.workflow_data as any;
          
          return {
            id: workflow.id,
            name: workflow.name,
            description: workflow.description || '',
            nodes: workflowData?.nodes || [],
            edges: workflowData?.edges || [],
            settings: workflowData?.settings || {
              parallelMode: false,
              batchSize: 5
            },
            createdAt: new Date(workflow.created_at),
            updatedAt: new Date(workflow.updated_at)
          };
        }) || [];

        setScenarios(loadedScenarios);
      } catch (error) {
        console.error('Error loading workflows:', error);
        toast({
          title: "Error loading workflows",
          description: "Failed to load your saved workflows.",
          variant: "destructive"
        });
      }
    };

    loadWorkflows();
  }, [toast]);

  // Add immediate debug log with unique identifier
  const componentId = useMemo(() => Math.random().toString(36).substr(2, 9), []);
  console.log(`🚀 FlowBatchBuilder component loaded [${componentId}], preparing webhook listener...`);
  
  useEffect(() => {
    console.log(`🔧 Setting up webhook listener for component [${componentId}]...`);
    let webhookChannel: any = null;
    let executionChannel: any = null;
    
    // Clean up any existing channels first
    const cleanupExistingChannels = () => {
      const existingChannels = supabase.getChannels();
      existingChannels.forEach(channel => {
        if (channel.topic?.includes('webhook-results') || channel.topic?.includes('workflow-executions')) {
          console.log(`🧹 Cleaning up existing channel: ${channel.topic}`);
          supabase.removeChannel(channel);
        }
      });
    };
    
    cleanupExistingChannels();
    
    const setupRealtimeListeners = () => {
      console.log(`🔌 Creating Supabase channels for component [${componentId}]...`);
      
      // Listen to workflow executions for real-time status updates
      executionChannel = supabase
        .channel(`workflow-executions-realtime-${componentId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'workflow_executions'
          },
          (payload) => {
            console.log(`🔥 [${componentId}] Workflow execution update received:`, payload);
            console.log(`🔥 [${componentId}] Current nodes in state:`, nodes.map(n => ({ id: n.id, type: n.type, status: n.data.status })));
            
            // Update node statuses based on execution progress
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const execution = payload.new;
              const executedNodeIds = execution.executed_nodes || [];
              const currentNodeId = execution.current_node_id;
              const status = execution.status;
              
              console.log(`🔥 [${componentId}] Execution details:`, {
                executedNodeIds,
                currentNodeId,
                status,
                executionData: execution
              });
              
              setNodes((currentNodes) => {
                console.log(`🔥 [${componentId}] Updating nodes - current count:`, currentNodes.length);
                
                const updatedNodes = currentNodes.map(node => {
                  const isExecuted = executedNodeIds.includes(node.id);
                  const isCurrent = node.id === currentNodeId;
                  
                  console.log(`🔥 [${componentId}] Node ${node.id}: isExecuted=${isExecuted}, isCurrent=${isCurrent}, currentStatus=${node.data.status}`);
                  
                  let nodeStatus = node.data.status || 'idle';
                  
                  // Update status based on execution state
                  if (status === 'completed') {
                    // If workflow is completed, mark all executed nodes as completed
                    if (isExecuted) {
                      nodeStatus = 'completed';
                    }
                  } else if (status === 'running') {
                    if (isCurrent) {
                      nodeStatus = 'running';
                    } else if (isExecuted) {
                      // Previously executed nodes should be completed even during running state
                      nodeStatus = 'completed';
                    }
                  } else if (status === 'failed') {
                    if (isExecuted || isCurrent) {
                      nodeStatus = 'error';
                    }
                  }
                  
                  console.log(`🔥 [${componentId}] Node ${node.id} status: ${node.data.status} -> ${nodeStatus}`);
                  
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      status: nodeStatus,
                      executionResult: (isExecuted && execution.result_data?.nodeResults?.[node.id]) 
                        ? execution.result_data.nodeResults[node.id] 
                        : node.data.executionResult,
                      hasResult: isExecuted && !!(execution.result_data?.nodeResults?.[node.id]),
                      hasCompletedExecution: isExecuted && status === 'completed'
                    }
                  };
                });
                
                console.log(`🔥 [${componentId}] Final updated nodes:`, updatedNodes.map(n => ({ id: n.id, type: n.type, status: n.data.status, hasResult: !!n.data.hasResult })));
                return updatedNodes;
              });
              
              // Show completion toast when workflow finishes
              if (status === 'completed') {
                toast({
                  title: "✅ Workflow Completed",
                  description: `Successfully executed ${executedNodeIds.length} nodes`,
                  duration: 5000
                });
              } else if (status === 'failed') {
                toast({
                  title: "❌ Workflow Failed", 
                  description: execution.error_message || "Workflow execution failed",
                  duration: 5000
                });
              }
            }
          }
        )
        .subscribe((status, err) => {
          console.log(`🔌 [${componentId}] Workflow executions subscription status:`, status, err);
        });
      
      // Enhanced webhook listener for immediate notifications
      webhookChannel = supabase
        .channel(`webhook-results-global-${componentId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'webhook_requests'
          },
          (payload) => {
            console.log(`🔔 [${componentId}] New webhook request received:`, payload);
            console.log(`🔔 [${componentId}] Current nodes:`, nodes.map(n => ({ id: n.id, type: n.type, data: n.data })));
            
            // Show notification immediately when webhook is received
            const requestBody = payload.new.request_body;
            const responseBody = payload.new.response_body;
            
            toast({
              title: "🚀 Webhook Data Received",
              description: (
                <div className="space-y-2 max-w-sm">
                  <p className="font-medium">Processing webhook request...</p>
                  <div className="text-xs space-y-1 bg-muted p-2 rounded">
                    <div>
                      <strong>📥 Request:</strong> 
                      <pre className="text-xs mt-1 whitespace-pre-wrap break-all">
                        {JSON.stringify(requestBody, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ),
              duration: 8000,
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'webhook_requests'
          },
          (payload) => {
            console.log(`🔄 [${componentId}] Webhook request updated:`, payload);
            
            const updatedRequest = payload.new;
            if (updatedRequest.response_body && updatedRequest.processing_time_ms) {
              console.log(`🔍 Full webhook result for debugging:`, updatedRequest.response_body);
              
              // Check if webhook response indicates completed workflow
              const responseBody = updatedRequest.response_body;
              const isWorkflowCompleted = responseBody?.status === 'completed' && responseBody?.executedNodes;
              
              if (isWorkflowCompleted) {
                const executedNodeIds = responseBody.executedNodes;
                console.log(`🎉 [${componentId}] Workflow completed! Updating ${executedNodeIds.length} nodes to completed status:`, executedNodeIds);
                
                // Force update all executed nodes to completed status
                setNodes((currentNodes) => {
                  const updatedNodes = currentNodes.map(node => {
                    const isExecutedNode = executedNodeIds.includes(node.id);
                    if (isExecutedNode) {
                      console.log(`✅ [${componentId}] Setting node ${node.id} to completed status`);
                      return {
                        ...node,
                        data: {
                          ...node.data,
                          status: 'completed',
                          hasResult: true,
                          hasCompletedExecution: true,
                          executionResult: responseBody
                        }
                      };
                    }
                    return node;
                  });
                  
                  console.log(`🏁 [${componentId}] All nodes updated to completed:`, updatedNodes.filter(n => executedNodeIds.includes(n.id)).map(n => ({
                    id: n.id,
                    status: n.data.status,
                    hasResult: n.data.hasResult
                  })));
                  
                  return updatedNodes;
                });
              } else {
                // Check if this webhook completion should mark nodes as completed (fallback)
                setNodes((currentNodes) => {
                  console.log(`🔄 [${componentId}] Webhook completed - checking node statuses`);
                  const updatedNodes = currentNodes.map(node => {
                    // If node is still running but webhook is actually complete, update it
                    if (node.data.status === 'running' && updatedRequest.response_status >= 200 && updatedRequest.response_status < 300) {
                      console.log(`🔄 [${componentId}] Updating node ${node.id} from running to completed due to webhook completion`);
                      return {
                        ...node,
                        data: {
                          ...node.data,
                          status: 'completed',
                          hasResult: true
                        }
                      };
                    }
                    return node;
                  });
                  return updatedNodes;
                });
              }
              
              toast({
                title: isWorkflowCompleted ? "🎉 Workflow Completed Successfully!" : "✅ Webhook Processing Complete",
                description: isWorkflowCompleted 
                  ? `All ${responseBody.executedNodes.length} nodes completed successfully` 
                  : `Processed in ${updatedRequest.processing_time_ms}ms`,
                duration: 5000
              });
            }
          }
        )
        .subscribe((status, err) => {
          console.log(`🔌 [${componentId}] Webhook requests subscription status:`, status, err);
        });
    };

    setupRealtimeListeners();

    return () => {
      console.log(`🧹 [${componentId}] Cleaning up realtime listeners...`);
      if (webhookChannel) {
        supabase.removeChannel(webhookChannel);
      }
      if (executionChannel) {
        supabase.removeChannel(executionChannel);
      }
    };
  }, [setNodes, toast, componentId]);

  // Add test function to manually trigger webhook update for debugging
  useEffect(() => {
    // @ts-ignore - Add to window for testing
    window.testWebhookUpdate = (webhookId: string) => {
      console.log('Testing webhook update for:', webhookId);
      setNodes((currentNodes) => {
        const updatedNodes = currentNodes.map(node => {
          const nodeData = node.data as NodeData;
          if (node.type === 'trigger' && 
              nodeData?.config?.triggerType === 'webhook' && 
              nodeData?.config?.webhook?.id === webhookId) {
            
            console.log('Test updating trigger node:', node.id);
            
            return {
              ...node,
              data: {
                ...node.data,
                status: 'completed',
                executionResult: {
                  success: true,
                  result: { message: 'Test webhook data', timestamp: new Date().toISOString() },
                  timestamp: new Date().toISOString(),
                  processingTime: 150
                }
              }
            };
          }
          return node;
        });
        
        return updatedNodes;
      });
    };
  }, [setNodes]);

  // Define removeNode function early
  const removeNode = useCallback((nodeId: string) => {
    console.log('removeNode called for:', nodeId);
    setNodes(nodes => nodes.filter(node => node.id !== nodeId));
    setEdges(edges => edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
    console.log('Node removal completed, no toast should appear');
  }, [setNodes, setEdges, selectedNode]);

  // Handle keyboard events for deleting selected nodes
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle delete/backspace if user is typing in an input field
      const target = event.target as HTMLElement;
      if (target && (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.contentEditable === 'true' ||
        target.isContentEditable
      )) {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedNode && selectedNode.type !== 'trigger') {
          event.preventDefault();
          removeNode(selectedNode.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, removeNode]);

  // Node context menu handlers - define before useMemo
  const handleNodeSettings = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setSettingsNode(node);
      setSettingsDialogOpen(true);
    }
  }, [nodes]);
  const handleRunSingle = useCallback((nodeId: string) => {
    toast({
      title: "Running single module",
      description: `Executing module ${nodeId}...`
    });
    // Implement single module execution logic here
  }, [toast]);
  const handleAddErrorHandler = useCallback((nodeId: string) => {
    toast({
      title: "Error handler added",
      description: `Error handler added to module ${nodeId}`
    });
    // Implement error handler logic here
  }, [toast]);
  const handleRenameNode = useCallback((nodeId: string) => {
    const newName = prompt('Enter new name:');
    if (newName) {
      setNodes(prevNodes => prevNodes.map(n => n.id === nodeId ? {
        ...n,
        data: {
          ...n.data,
          label: newName
        }
      } : n));
    }
  }, [setNodes]);
  const handleAddNote = useCallback((nodeId: string) => {
    const note = prompt('Add a note:');
    if (note) {
      setNodes(prevNodes => prevNodes.map(n => n.id === nodeId ? {
        ...n,
        data: {
          ...n.data,
          note
        }
      } : n));
      toast({
        title: "Note added",
        description: "Note has been added to the module"
      });
    }
  }, [setNodes, toast]);
  const handleCopyModule = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      navigator.clipboard.writeText(JSON.stringify(node));
      toast({
        title: "Module copied",
        description: "Module configuration copied to clipboard"
      });
    }
  }, [nodes, toast]);
  const duplicateNode = useCallback((nodeId: string) => {
    const nodeToDuplicate = nodes.find(n => n.id === nodeId);
    if (!nodeToDuplicate || nodeToDuplicate.type === 'trigger') {
      return;
    }
    
    // Assign new permanent number to duplicated node
    const newNodeNumber = nextNodeNumber;
    
    const newNode: Node = {
      ...nodeToDuplicate,
      id: `${nodeToDuplicate.type}-${Date.now()}`,
      position: {
        x: nodeToDuplicate.position.x + 50,
        y: nodeToDuplicate.position.y + 50
      },
      data: {
        ...nodeToDuplicate.data,
        label: `${(nodeToDuplicate.data as NodeData).label} (Copy)`,
        nodeNumber: newNodeNumber // Assign new permanent number
      }
    };
    setNodes(nodes => [...nodes, newNode]);
    setNextNodeNumber(prev => prev + 1); // Increment counter
    toast({
      title: "Task duplicated",
      description: "A copy of the task has been created."
    });
  }, [nodes, setNodes, toast, nextNodeNumber]);

  // Handle node updates for real-time status changes
  const handleNodeUpdate = useCallback((nodeId: string, updates: any) => {
    console.log('🔄 FlowBatchBuilder: Updating node', nodeId, 'with updates:', updates);
    setNodes(prevNodes => prevNodes.map(n => n.id === nodeId ? {
      ...n,
      data: {
        ...n.data,
        ...updates
      }
    } : n));
  }, []);

  // Memoize nodeTypes to prevent React Flow warnings and context menu issues
  const memoizedNodeTypes = useMemo(() => {

    return {
      ...nodeTypes,
      trigger: (props: any) => <NodeContextMenu nodeId={props.id} nodeType={props.type || 'trigger'} onRunSingle={handleRunSingle} onAddErrorHandler={handleAddErrorHandler} onRename={handleRenameNode} onClone={duplicateNode} onCopyModule={handleCopyModule} onAddNote={handleAddNote} onDelete={removeNode} onSettings={handleNodeSettings}>
          <TriggerNode {...props} data={{...props.data, onNodeUpdate: handleNodeUpdate}} />
        </NodeContextMenu>,
      gptTask: (props: any) => <NodeContextMenu nodeId={props.id} nodeType={props.type || 'gptTask'} onRunSingle={handleRunSingle} onAddErrorHandler={handleAddErrorHandler} onRename={handleRenameNode} onClone={duplicateNode} onCopyModule={handleCopyModule} onAddNote={handleAddNote} onDelete={removeNode} onSettings={handleNodeSettings}>
          <GPTTaskNode {...props} data={{...props.data, onNodeUpdate: handleNodeUpdate}} />
        </NodeContextMenu>,
      httpTask: (props: any) => <NodeContextMenu nodeId={props.id} nodeType={props.type || 'httpTask'} onRunSingle={handleRunSingle} onAddErrorHandler={handleAddErrorHandler} onRename={handleRenameNode} onClone={duplicateNode} onCopyModule={handleCopyModule} onAddNote={handleAddNote} onDelete={removeNode} onSettings={handleNodeSettings}>
          <HTTPTaskNode {...props} data={{...props.data, onNodeUpdate: handleNodeUpdate}} />
        </NodeContextMenu>,
      multipartHttp: (props: any) => <NodeContextMenu nodeId={props.id} nodeType={props.type || 'multipartHttp'} onRunSingle={handleRunSingle} onAddErrorHandler={handleAddErrorHandler} onRename={handleRenameNode} onClone={duplicateNode} onCopyModule={handleCopyModule} onAddNote={handleAddNote} onDelete={removeNode} onSettings={handleNodeSettings}>
          <MultipartHTTPNode {...props} data={{...props.data, onNodeUpdate: handleNodeUpdate}} />
        </NodeContextMenu>,
      imageTask: (props: any) => <NodeContextMenu nodeId={props.id} nodeType={props.type || 'imageTask'} onRunSingle={handleRunSingle} onAddErrorHandler={handleAddErrorHandler} onRename={handleRenameNode} onClone={duplicateNode} onCopyModule={handleCopyModule} onAddNote={handleAddNote} onDelete={removeNode} onSettings={handleNodeSettings}>
          <ImageTaskNode {...props} data={{...props.data, onNodeUpdate: handleNodeUpdate}} />
        </NodeContextMenu>,
      delay: (props: any) => <NodeContextMenu nodeId={props.id} nodeType={props.type || 'delay'} onRunSingle={handleRunSingle} onAddErrorHandler={handleAddErrorHandler} onRename={handleRenameNode} onClone={duplicateNode} onCopyModule={handleCopyModule} onAddNote={handleAddNote} onDelete={removeNode} onSettings={handleNodeSettings}>
          <DelayNode {...props} data={{...props.data, onNodeUpdate: handleNodeUpdate}} />
        </NodeContextMenu>,
      conditional: (props: any) => <NodeContextMenu nodeId={props.id} nodeType={props.type || 'conditional'} onRunSingle={handleRunSingle} onAddErrorHandler={handleAddErrorHandler} onRename={handleRenameNode} onClone={duplicateNode} onCopyModule={handleCopyModule} onAddNote={handleAddNote} onDelete={removeNode} onSettings={handleNodeSettings}>
          <ConditionalNode {...props} data={{...props.data, onNodeUpdate: handleNodeUpdate}} />
        </NodeContextMenu>,
      iterator: (props: any) => <NodeContextMenu nodeId={props.id} nodeType={props.type || 'iterator'} onRunSingle={handleRunSingle} onAddErrorHandler={handleAddErrorHandler} onRename={handleRenameNode} onClone={duplicateNode} onCopyModule={handleCopyModule} onAddNote={handleAddNote} onDelete={removeNode} onSettings={handleNodeSettings}>
          <IteratorNode {...props} data={{...props.data, onNodeUpdate: handleNodeUpdate}} />
        </NodeContextMenu>,
      dataTransform: (props: any) => <NodeContextMenu nodeId={props.id} nodeType={props.type || 'dataTransform'} onRunSingle={handleRunSingle} onAddErrorHandler={handleAddErrorHandler} onRename={handleRenameNode} onClone={duplicateNode} onCopyModule={handleCopyModule} onAddNote={handleAddNote} onDelete={removeNode} onSettings={handleNodeSettings}>
          <DataTransformNode {...props} data={{...props.data, onNodeUpdate: handleNodeUpdate}} />
        </NodeContextMenu>,
      router: (props: any) => <NodeContextMenu nodeId={props.id} nodeType={props.type || 'router'} onRunSingle={handleRunSingle} onAddErrorHandler={handleAddErrorHandler} onRename={handleRenameNode} onClone={duplicateNode} onCopyModule={handleCopyModule} onAddNote={handleAddNote} onDelete={removeNode} onSettings={handleNodeSettings}>
          <RouterNode {...props} data={{...props.data, onNodeUpdate: handleNodeUpdate}} />
        </NodeContextMenu>,
      webhookResponse: (props: any) => <NodeContextMenu nodeId={props.id} nodeType={props.type || 'webhookResponse'} onRunSingle={handleRunSingle} onAddErrorHandler={handleAddErrorHandler} onRename={handleRenameNode} onClone={duplicateNode} onCopyModule={handleCopyModule} onAddNote={handleAddNote} onDelete={removeNode} onSettings={handleNodeSettings}>
          <WebhookResponseNode {...props} data={{...props.data, onNodeUpdate: handleNodeUpdate}} />
        </NodeContextMenu>,
      arrayAggregator: (props: any) => <NodeContextMenu nodeId={props.id} nodeType={props.type || 'arrayAggregator'} onRunSingle={handleRunSingle} onAddErrorHandler={handleAddErrorHandler} onRename={handleRenameNode} onClone={duplicateNode} onCopyModule={handleCopyModule} onAddNote={handleAddNote} onDelete={removeNode} onSettings={handleNodeSettings}>
          <ArrayAggregatorNode {...props} data={{...props.data, onNodeUpdate: handleNodeUpdate}} />
        </NodeContextMenu>
    };
  }, [handleRunSingle, handleAddErrorHandler, handleRenameNode, duplicateNode, handleCopyModule, handleAddNote, removeNode, handleNodeSettings, setNodes]);
  const onConnect = useCallback((params: Connection) => {
    const newEdge: Edge = {
      ...params,
      id: `edge-${Date.now()}`,
      type: 'smoothstep',
      animated: true,
      style: {
        stroke: 'hsl(var(--primary))',
        strokeWidth: 2
      }
    };
    setEdges(eds => addEdge(newEdge, eds));
  }, [setEdges]);
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    console.log('🎯 onNodeClick triggered', { 
      button: event.button, 
      target: event.target, 
      nodeId: node.id, 
      nodeType: node.type 
    });
    
    // Don't open settings dialog on right-click (context menu)
    if (event.button === 2) {
      setSelectedNode(node);
      return;
    }
    
    // Don't open settings dialog if clicking on execution notification or interactive elements
    const target = event.target as HTMLElement;
    if (target.closest('[data-execution-notification]') || 
        target.closest('[role="dialog"]') ||
        target.closest('.execution-notification') ||
        target.closest('[data-testid="execution-notification"]') ||
        target.closest('[data-testid="execution-result"]') ||
        target.closest('button') ||
        target.tagName === 'BUTTON' ||
        target.closest('.cursor-pointer')) {
      console.log('🚫 onNodeClick prevented - clicking on interactive element');
      setSelectedNode(node);
      return;
    }
    
    // Prevent settings dialog if any modifier keys are pressed
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      setSelectedNode(node);
      return;
    }
    
    // Check if we're in the middle of closing a dialog
    if (event.timeStamp && Date.now() - event.timeStamp < 50) {
      console.log('🚫 onNodeClick prevented - too close to dialog close event');
      setSelectedNode(node);
      return;
    }
    
    console.log('✅ onNodeClick proceeding to open settings dialog');
    // Always set selected node for keyboard delete functionality
    setSelectedNode(node);
    setSettingsNode(node);
    setSettingsDialogOpen(true);
  }, []);

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    console.log('🎯 onPaneClick triggered', { 
      target: event.target, 
      timeStamp: event.timeStamp 
    });
    
    // Always close dialogs when clicking on empty pane space
    setSettingsDialogOpen(false);
    setSettingsNode(null);
    setSelectedNode(null);
  }, []);
  const getNodeLabel = (type: string, config?: any, nodeNumber?: number): string => {
    if (type === 'trigger' && config?.triggerType) {
      const triggerLabels = {
        webhook: 'Webhook Trigger',
        batch: 'Batch Trigger',
        schedule: 'Schedule Trigger',
        database: 'Database Trigger'
      };
      return triggerLabels[config.triggerType as keyof typeof triggerLabels] || 'Trigger';
    }
    
    const labels = {
      trigger: 'Trigger',
      gptTask: nodeNumber ? `GPT ${nodeNumber}` : 'GPT Task',
      httpTask: 'HTTP Request',
      multipartHttp: 'HTTP Multipart',
      imageTask: 'Image Processing',
      delay: 'Delay',
      conditional: 'Conditional',
      iterator: 'Iterator',
      dataTransform: 'Data Transform',
      router: 'Router'
    };
    return labels[type as keyof typeof labels] || 'Task';
  };
  const getDefaultConfig = (type: string) => {
    const configs = {
      trigger: {
        triggerType: 'webhook',
        webhookUrl: ''
      },
      gptTask: {
        prompt: '',
        model: 'gpt-4o-mini',
        max_tokens: 1000,
        temperature: 0.7
      },
      httpTask: {
        url: '',
        method: 'GET',
        headers: {},
        body: ''
      },
      imageTask: {
        url: '',
        width: 300,
        height: 300,
        format: 'png'
      },
      delay: {
        duration: 1000,
        unit: 'ms'
      },
      conditional: {
        condition: '',
        trueAction: '',
        falseAction: ''
      },
      iterator: {
        items: [],
        action: ''
      },
      dataTransform: {
        input: '',
        transformation: '',
        output: ''
      },
      router: {
        executionMode: 'parallel',
        waitForAll: true,
        outputHandles: 3
      }
    };
    return configs[type as keyof typeof configs] || {};
  };
  // Function to calculate node position for left-to-right flow
  const calculateNodePosition = (nodes: Node[]): { x: number; y: number } => {
    if (nodes.length === 0) {
      return { x: 100, y: 100 };
    }
    
    // Find rightmost node position
    const rightmostX = Math.max(...nodes.map(n => n.position.x));
    return {
      x: rightmostX + 300, // Space nodes 300px apart horizontally
      y: 100 // Keep same vertical level for linear flow
    };
  };

  // Function to get node number based on position in workflow
  const getNodeNumber = (nodeId: string, allNodes: Node[]): number => {
    // Sort nodes by x position (left to right)
    const sortedNodes = allNodes
      .filter(n => n.type !== 'trigger') // Exclude trigger from numbering
      .sort((a, b) => a.position.x - b.position.x);
    
    const index = sortedNodes.findIndex(n => n.id === nodeId);
    return index + 1; // Start numbering from 1
  };

  const addNode = (type: string, position?: {
    x: number;
    y: number;
  }, config?: any) => {
    const defaultConfig = getDefaultConfig(type);
    const finalConfig = config ? {
      ...defaultConfig,
      ...config
    } : defaultConfig;
    
    // Calculate position for left-to-right flow
    const nodePosition = position || calculateNodePosition(nodes);
    
    // Assign permanent node number
    const nodeNumber = nextNodeNumber;
    
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: nodePosition,
      data: {
        label: getNodeLabel(type, finalConfig, nodeNumber),
        config: finalConfig,
        status: 'idle',
        batchEnabled: true,
        nodeNumber // Store permanent number in node data
      }
    };
    
    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    setSelectedNode(newNode);
    
    // Increment counter for all new nodes
    setNextNodeNumber(nextNodeNumber + 1);
  };

  // Helper function to find all connected nodes starting from a specific node
  const findConnectedNodesFromStart = (startNodeId: string, allNodes: Node[], allEdges: Edge[]): Node[] => {
    const connectedNodeIds = new Set<string>();
    const queue = [startNodeId];
    
    // Add the start node itself
    connectedNodeIds.add(startNodeId);
    
    // BFS to find all connected downstream nodes
    while (queue.length > 0) {
      const currentNodeId = queue.shift()!;
      
      // Find all edges where current node is the source
      const outgoingEdges = allEdges.filter(edge => edge.source === currentNodeId);
      
      for (const edge of outgoingEdges) {
        if (!connectedNodeIds.has(edge.target)) {
          connectedNodeIds.add(edge.target);
          queue.push(edge.target);
        }
      }
    }
    
    // Return nodes in execution order (topological sort would be ideal, but simple order works)
    return allNodes.filter(node => connectedNodeIds.has(node.id));
  };

  // Helper function to execute specific nodes
  const executeSpecificNodes = async (nodesToExecute: Node[]) => {
    setIsExecuting(true);
    const executionId = Date.now();
    const execution: WorkflowExecution = {
      id: executionId,
      startTime: new Date(),
      status: 'running',
      steps: []
    };
    
    console.log('🚀 EXECUTION STARTING with parallelMode:', parallelMode, 'batchSize:', batchSize);
    console.log('🚀 Executing nodes:', nodesToExecute.map(n => n.data.label || n.type));
    
    try {
      if (parallelMode) {
        console.log('🔄 TAKING PARALLEL PATH');
        // Execute tasks in parallel batches
        const batches: Node[][] = [];
        for (let i = 0; i < nodesToExecute.length; i += batchSize) {
          batches.push(nodesToExecute.slice(i, i + batchSize));
        }
        for (const batch of batches) {
          // Execute batch in parallel
          const batchPromises = batch.map(async node => {
            return executeNode(node, execution);
          });
          
          await Promise.all(batchPromises);
        }
      } else {
        console.log('🔄 TAKING SEQUENTIAL PATH');
        // Execute tasks sequentially
        for (const node of nodesToExecute) {
          await executeNode(node, execution);
        }
      }
      
      execution.endTime = new Date();
      execution.status = 'completed';
      setExecutionHistory(prev => [execution, ...prev]);
      
      toast({
        title: "✅ Batch workflow completed",
        description: `Executed ${nodesToExecute.length} task${nodesToExecute.length !== 1 ? 's' : ''} successfully.`,
        duration: 5000
      });
      
    } catch (error) {
      console.error('Execution failed:', error);
      execution.endTime = new Date();
      execution.status = 'failed';
      setExecutionHistory(prev => [execution, ...prev]);
      
      toast({
        title: "❌ Execution failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setIsExecuting(false);
      
      // Reset all node statuses after execution
      setNodes(prevNodes => prevNodes.map(n => ({
        ...n,
        data: {
          ...n.data,
          status: 'idle'
        }
      })));
    }
  };

  const executeNode = async (node: Node, execution: WorkflowExecution) => {
    const nodeData = node.data as NodeData;
    const startTime = Date.now();

    // Update node status to running
    setNodes(prevNodes => prevNodes.map(n => n.id === node.id ? {
      ...n,
      data: {
        ...n.data,
        status: 'running'
      }
    } : n));

    try {
      let executionResult = null;

      // Execute based on node type
      if (node.type === 'gptTask') {
        const config = nodeData.config || {};
        
        // Call the GPT edge function
        const { data, error } = await supabase.functions.invoke('gpt-task', {
          body: {
            config,
            inputs: {} // Add input data from previous nodes here
          }
        });

        if (error) throw error;
        executionResult = data;
      } else if (node.type === 'httpTask') {
        // HTTP task execution logic - call the webhook handler
        const config = nodeData.config || {};
        console.log(`🌐 Executing HTTP task with config:`, config);
        
          try {
            const { data, error } = await supabase.functions.invoke('http-task', {
              body: { config }
            });

            if (error) {
              console.error('🚨 HTTP task execution error:', error);
              executionResult = { 
                message: 'HTTP task failed', 
                error: error.message || 'Unknown error',
                http_error: error.message || 'Unknown error',
                http_status: error.statusCode || 500,
                config,
                success: false
              };
            } else {
              console.log(`🌐 HTTP task response:`, data);
              // Format the result properly for the dialog
              if (data && data.success === false) {
                // Handle failed HTTP requests (4xx, 5xx responses)
                executionResult = { 
                  message: `HTTP ${data.status || 'error'}`, 
                  error: data.error || `HTTP ${data.status} - ${data.statusText}`,
                  http_error: data.error || `HTTP ${data.status} - ${data.statusText}`,
                  http_status: data.status,
                  http_response: data,
                  config,
                  success: false,
                  status: data.status,
                  statusText: data.statusText,
                  headers: data.headers,
                  body: data.body
                };
              } else if (data) {
                // Handle successful HTTP requests
                executionResult = { 
                  message: `HTTP ${data.status || 200} - Success`, 
                  http_response: data,
                  http_status: data.status,
                  config,
                  success: data.success !== false,
                  status: data.status,
                  statusText: data.statusText,
                  headers: data.headers,
                  body: data.body
                };
              } else {
                executionResult = { message: 'HTTP task completed', config, success: true };
              }
            }
          } catch (err) {
            console.error('🚨 HTTP task execution exception:', err);
            executionResult = { 
              message: 'HTTP task failed', 
              error: (err as Error).message || 'Unknown error',
              http_error: (err as Error).message || 'Unknown error',
              config 
            };
          }
      } else if (node.type === 'imageTask') {
        // Image task execution logic
        const config = nodeData.config || {};
        executionResult = { message: 'Image task executed', config };
      } else if (node.type === 'delay') {
        // Delay execution logic
        const delay = nodeData.config?.delay || 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        executionResult = { message: `Delayed for ${delay}ms` };
      } else if (node.type === 'trigger') {
        // Trigger execution logic
        executionResult = { message: 'Trigger executed', trigger: nodeData.config?.triggerType };
      } else {
        // Default execution for other node types
        executionResult = { message: `${node.type} executed`, config: nodeData.config };
      }

      const duration = Date.now() - startTime;
      
      const step: ExecutionStep = {
        nodeId: node.id,
        nodeName: nodeData.label || node.type,
        status: 'completed',
        duration,
        timestamp: new Date(),
        result: executionResult
      };

      execution.steps.push(step);

      // Update node status to completed with result
      setNodes(prevNodes => prevNodes.map(n => n.id === node.id ? {
        ...n,
        data: {
          ...n.data,
          status: executionResult?.success === false ? 'error' : 'completed',
          executionResult,
          hasResult: true,
          hasCompletedExecution: true
        }
      } : n));

    } catch (error) {
      const duration = Date.now() - startTime;
      
      const step: ExecutionStep = {
        nodeId: node.id,
        nodeName: nodeData.label || node.type,
        status: 'error',
        duration,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      execution.steps.push(step);

      // Update node status to error
      setNodes(prevNodes => prevNodes.map(n => n.id === node.id ? {
        ...n,
        data: {
          ...n.data,
          status: 'error'
        }
      } : n));

      throw error;
    }
  };
  const handleWebhookSave = (webhookData: any) => {
    console.log('💾 Saving webhook data to node:', editingNodeId, webhookData);
    if (editingNodeId) {
      setNodes(prevNodes => prevNodes.map(n => n.id === editingNodeId ? {
        ...n,
        data: {
          ...n.data,
          config: {
            ...(n.data as NodeData).config,
            webhook: webhookData,
            webhookId: webhookData.id, // Also store the ID separately for easier access
            selectedHook: webhookData.id, // For backward compatibility
            triggerType: 'webhook'
          }
        }
      } : n));
      
      console.log('✅ Webhook saved to trigger node, ID:', webhookData.id);
    }
    setShowWebhookConfig(false);
    setEditingNodeId(null);
  };
  const executeBatchWorkflow = async () => {
    console.log('🚀 executeBatchWorkflow called with executionStartNode:', executionStartNode);
    console.log('🚀 Available nodes:', nodes.map(n => ({ id: n.id, type: n.type, label: n.data.label })));
    
    // If an execution start node is set, start from that specific node and follow the connected path
    if (executionStartNode) {
      const startNode = nodes.find(n => n.id === executionStartNode);
      console.log('🚀 Found start node:', startNode);
      
      if (!startNode) {
        toast({
          title: "❌ Invalid start node",
          description: "The selected execution start node was not found.",
          variant: "destructive"
        });
        return;
      }

      // Find all connected nodes starting from the execution start node
      const connectedNodes = findConnectedNodesFromStart(executionStartNode, nodes, edges);
      console.log('🚀 Connected nodes found:', connectedNodes.map(n => ({ id: n.id, type: n.type, label: n.data.label })));
      
      if (connectedNodes.length === 1) { // Just the start node itself
        toast({
          title: "🔍 Executing single node",
          description: `Starting execution from: ${startNode.data.label || startNode.type}`,
          duration: 3000
        });
        // Execute just the start node if no connections
        await executeSpecificNodes([startNode]);
        return;
      }

      toast({
        title: "🚀 Starting from selected node",
        description: `Executing ${connectedNodes.length} connected node(s) from: ${startNode.data.label || startNode.type}`,
        duration: 3000
      });

      await executeSpecificNodes(connectedNodes);
      return;
    }

    // Fallback: execute all task nodes (original behavior)
    let taskNodes = nodes.filter(n => n.type !== 'trigger');
    
    if (taskNodes.length === 0) {
      toast({
        title: "No tasks to execute",
        description: "Please add at least one task to the workflow.",
        variant: "destructive"
      });
      return;
    }

    await executeSpecificNodes(taskNodes);
    
    if (taskNodes.length === 0) {
      toast({
        title: "No tasks to execute",
        description: "Please add at least one task to the workflow.",
        variant: "destructive"
      });
      return;
    }
    setIsExecuting(true);
    const executionId = Date.now();
    const execution: WorkflowExecution = {
      id: executionId,
      startTime: new Date(),
      status: 'running',
      steps: []
    };
    console.log('🚀 EXECUTION STARTING with parallelMode:', parallelMode, 'batchSize:', batchSize);
    try {
      if (parallelMode) {
        console.log('🔄 TAKING PARALLEL PATH');
        // Execute tasks in parallel batches
        const batches: Node[][] = [];
        for (let i = 0; i < taskNodes.length; i += batchSize) {
          batches.push(taskNodes.slice(i, i + batchSize));
        }
        for (const batch of batches) {
          // Execute batch in parallel
          const batchPromises = batch.map(async node => {
            const nodeData = node.data as NodeData;
            const startTime = Date.now();

            // Update node status to running
            setNodes(prevNodes => prevNodes.map(n => n.id === node.id ? {
              ...n,
              data: {
                ...n.data,
                status: 'running'
              }
            } : n));

            try {
              let executionResult = null;

              // Execute based on node type
              if (node.type === 'gptTask') {
                const config = nodeData.config || {};
                
                // Call the GPT edge function
                const { data, error } = await supabase.functions.invoke('gpt-task', {
                  body: {
                    config,
                    inputs: {} // Add input data from previous nodes here
                  }
                });

                if (error) {
                  throw new Error(error.message || 'GPT task failed');
                }

                executionResult = {
                  result: data.result,
                  model: data.model,
                  usage: data.usage,
                  executionTime: (Date.now() - startTime) / 1000
                };
              } else {
                // Simulate other task types
                await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
                executionResult = {
                  result: `Task ${nodeData.label} completed successfully`,
                  executionTime: (Date.now() - startTime) / 1000
                };
              }

              // Update node status to completed with result
              setNodes(prevNodes => prevNodes.map(n => n.id === node.id ? {
                ...n,
                data: {
                  ...n.data,
                  status: 'completed',
                  executionResult,
                  hasCompletedExecution: true
                }
              } : n));

              return {
                nodeId: node.id,
                nodeName: nodeData.label as string || 'Unnamed Node',
                status: 'completed' as const,
                duration: Date.now() - startTime,
                timestamp: new Date(),
                result: executionResult
              };
            } catch (error) {
              // Update node status to error
              setNodes(prevNodes => prevNodes.map(n => n.id === node.id ? {
                ...n,
                data: {
                  ...n.data,
                  status: 'error',
                  executionResult: {
                    error: error.message,
                    executionTime: (Date.now() - startTime) / 1000
                  },
                  hasCompletedExecution: true
                }
              } : n));

              return {
                nodeId: node.id,
                nodeName: nodeData.label as string || 'Unnamed Node',
                status: 'error' as const,
                duration: Date.now() - startTime,
                timestamp: new Date(),
                error: error.message
              };
            }
          });
          const batchResults = await Promise.all(batchPromises);
          execution.steps.push(...batchResults);
        }
      } else {
        console.log('➡️ TAKING SEQUENTIAL PATH');
        // Execute tasks sequentially
        const executedResults = new Map(); // Store results by node ID
        
        for (const node of taskNodes) {
          const nodeData = node.data as NodeData;
          const startTime = Date.now();

          setNodes(prevNodes => prevNodes.map(n => n.id === node.id ? {
            ...n,
            data: {
              ...n.data,
              status: 'running'
            }
          } : n));

          try {
            let executionResult = null;

            // Execute based on node type
            if (node.type === 'gptTask') {
              const config = nodeData.config || {};
              
              // Build inputs from previously executed nodes
              const inputs = {};
              for (const [nodeId, result] of executedResults) {
                const executedNode = nodes.find(n => n.id === nodeId);
                const nodeLabel = executedNode?.data?.label || `Node ${nodeId}`;
                
                // Support multiple formats for variable references
                inputs[`${nodeLabel}.result`] = result.result || result.output;
                inputs[`${nodeLabel}`] = result.result || result.output;
                
                // Also support numbered format like "GPT 1", "GPT 2", etc.
                const nodeIndex = taskNodes.findIndex(n => n.id === nodeId) + 1;
                inputs[`GPT ${nodeIndex}.result`] = result.result || result.output;
                inputs[`GPT ${nodeIndex}`] = result.result || result.output;
              }
              
              console.log('🔗 Passing inputs to GPT task:', inputs);
              
              // Call the GPT edge function
              const { data, error } = await supabase.functions.invoke('gpt-task', {
                body: {
                  config,
                  inputs
                }
              });

              if (error) {
                throw new Error(error.message || 'GPT task failed');
              }

              executionResult = {
                result: data.result,
                model: data.model,
                usage: data.usage,
                executionTime: (Date.now() - startTime) / 1000
              };
            } else {
              // Simulate other task types
              await new Promise(resolve => setTimeout(resolve, 1500));
              executionResult = {
                result: `Task ${nodeData.label} completed successfully`,
                executionTime: (Date.now() - startTime) / 1000
              };
            }

            setNodes(prevNodes => prevNodes.map(n => n.id === node.id ? {
              ...n,
              data: {
                ...n.data,
                status: 'completed',
                executionResult,
                hasCompletedExecution: true
              }
            } : n));

            // Store the result for use by subsequent nodes
            executedResults.set(node.id, executionResult);
            console.log('💾 Stored result for node:', node.id, executionResult);

            execution.steps.push({
              nodeId: node.id,
              nodeName: nodeData.label as string || 'Unnamed Node',
              status: 'completed',
              duration: Date.now() - startTime,
              timestamp: new Date(),
              result: executionResult
            });
          } catch (error) {
            setNodes(prevNodes => prevNodes.map(n => n.id === node.id ? {
              ...n,
              data: {
                ...n.data,
                status: 'error',
                executionResult: {
                  error: error.message,
                  executionTime: (Date.now() - startTime) / 1000
                },
                hasCompletedExecution: true
              }
            } : n));

            execution.steps.push({
              nodeId: node.id,
              nodeName: nodeData.label as string || 'Unnamed Node',
              status: 'error',
              duration: Date.now() - startTime,
              timestamp: new Date(),
              error: error.message
            });
          }
        }
      }
      execution.status = 'completed';
      execution.endTime = new Date();
      setExecutionHistory(prev => [execution, ...prev.slice(0, 9)]);
      toast({
        title: "Batch workflow completed",
        description: `Executed ${taskNodes.length} tasks ${parallelMode ? 'in parallel' : 'sequentially'} successfully.`
      });
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      toast({
        title: "Batch execution failed",
        description: "An error occurred while executing the batch workflow.",
        variant: "destructive"
      });
    } finally {
      setIsExecuting(false);
      // Reset node statuses after a delay
      setTimeout(() => {
        setNodes(prevNodes => prevNodes.map(n => ({
          ...n,
          data: {
            ...n.data,
            status: 'idle'
          }
        })));
      }, 3000);
    }
  };
  const workflowStats = useMemo(() => {
    const totalNodes = nodes.length - 1; // Exclude trigger
    const totalConnections = edges.length;
    const avgExecutionTime = executionHistory.length > 0 ? executionHistory.reduce((acc, exec) => {
      if (exec.endTime && exec.startTime) {
        return acc + (exec.endTime.getTime() - exec.startTime.getTime());
      }
      return acc;
    }, 0) / executionHistory.length / 1000 : 0;
    return {
      totalNodes,
      totalConnections,
      avgExecutionTime: Math.round(avgExecutionTime * 10) / 10,
      successRate: executionHistory.length > 0 ? (executionHistory.filter(e => e.status === 'completed').length / executionHistory.length * 100).toFixed(1) : 0
    };
  }, [nodes, edges, executionHistory]);

  // Scenario management functions
  const createScenario = async () => {
    if (!scenarioForm.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a scenario name.",
        variant: "destructive"
      });
      return;
    }

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        toast({
          title: "Authentication required",
          description: "Please log in to create workflows.",
          variant: "destructive"
        });
        return;
      }

      // Create the scenario in Supabase first
      const { data, error } = await supabase
        .from('workflows')
        .insert({
          name: scenarioForm.name.trim(),
          description: scenarioForm.description.trim(),
          workflow_data: {
            nodes: initialNodes,
            edges: initialEdges,
            settings: {
              parallelMode: false,
              batchSize: 5
            }
          } as any,
          user_id: user.data.user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Create local scenario object with the returned data
      const newScenario: Scenario = {
        id: data.id,
        name: data.name,
        description: data.description || '',
        nodes: initialNodes,
        edges: initialEdges,
        settings: {
          parallelMode: false,
          batchSize: 5
        },
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      setScenarios(prev => [...prev, newScenario]);
      setCurrentScenario(newScenario);
      setNodes(initialNodes);
      setEdges(initialEdges);
      setParallelMode(false);
      setBatchSize(5);
      setScenarioForm({
        name: '',
        description: ''
      });
      setCurrentView('workflow');
      toast({
        title: "Scenario created",
        description: `"${newScenario.name}" has been created successfully.`
      });
    } catch (error) {
      console.error('Error creating scenario:', error);
      toast({
        title: "Error creating scenario",
        description: "Failed to create the scenario. Please try again.",
        variant: "destructive"
      });
    }
  };
  const loadScenario = (scenario: Scenario) => {
    console.log('📂 Loading scenario:', scenario.name, 'with parallelMode:', scenario.settings.parallelMode);
    setCurrentScenario(scenario);
    setNodes(scenario.nodes);
    setEdges(scenario.edges);
    // Default to sequential execution for better user experience
    console.log('🔧 Setting parallelMode to false for sequential execution');
    setParallelMode(false);
    setBatchSize(scenario.settings.batchSize || 5);
    setCurrentView('workflow');
  };
  const saveCurrentScenario = () => {
    if (!currentScenario) return;
    const updatedScenario: Scenario = {
      ...currentScenario,
      nodes,
      edges,
      settings: {
        parallelMode,
        batchSize
      },
      updatedAt: new Date()
    };
    setScenarios(prev => prev.map(s => s.id === currentScenario.id ? updatedScenario : s));
    setCurrentScenario(updatedScenario);
    toast({
      title: "Scenario saved",
      description: `"${updatedScenario.name}" has been saved successfully.`
    });
  };
  const deleteScenario = async (scenarioId: string) => {
    try {
      // Delete from database
      const { error } = await supabase
        .from('workflows')
        .delete()
        .eq('id', scenarioId);

      if (error) throw error;

      // Update local state
      setScenarios(prev => prev.filter(s => s.id !== scenarioId));
      if (currentScenario?.id === scenarioId) {
        setCurrentScenario(null);
        setCurrentView('scenarios');
      }
      toast({
        title: "Scenario deleted",
        description: "The scenario has been removed."
      });
    } catch (error) {
      console.error('Error deleting scenario:', error);
      toast({
        title: "Delete failed",
        description: "Failed to delete scenario. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Save workflow to database
  const saveWorkflow = async () => {
    if (nodes.length === 0) {
      toast({
        title: "No workflow to save",
        description: "Please add some nodes to the workflow first.",
        variant: "destructive"
      });
      return;
    }

    // If we have a current scenario, save automatically without showing dialog
    if (currentScenario) {
      // Save directly with current scenario data
      await handleSaveWorkflow(currentScenario.name, currentScenario.description);
    } else {
      // For new workflows, show the dialog
      setSaveForm({ name: '', description: '' });
      setShowSaveDialog(true);
    }
  };

  const handleSaveWorkflow = async (overrideName?: string, overrideDescription?: string) => {
    const name = overrideName || saveForm.name;
    const description = overrideDescription || saveForm.description;
    
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a workflow name.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast({
          title: "Authentication required",
          description: "Please log in to save workflows.",
          variant: "destructive"
        });
        return;
      }

      // If we have a current scenario loaded, update it
      if (currentScenario) {
        const { data, error } = await supabase
          .from('workflows')
          .update({
            name: name.trim(),
            description: description.trim(),
            workflow_data: {
              nodes,
              edges,
              settings: {
                parallelMode,
                batchSize
              }
            } as any,
          })
          .eq('id', currentScenario.id)
          .eq('user_id', user.user.id)
          .select();

        if (error) throw error;

        // Update the current scenario
        const updatedScenario: Scenario = {
          ...currentScenario,
          name: name.trim(),
          description: description.trim(),
          nodes,
          edges,
          settings: {
            parallelMode,
            batchSize
          },
          updatedAt: new Date()
        };

        setCurrentScenario(updatedScenario);
        setScenarios(prev => prev.map(s => s.id === currentScenario.id ? updatedScenario : s));

        toast({
          title: "Scenario updated",
          description: `"${name}" has been updated successfully.`
        });
      } else {
        // Create new workflow
        const { data, error } = await supabase
          .from('workflows')
          .insert({
            name: name.trim(),
            description: description.trim(),
            workflow_data: {
              nodes,
              edges,
              settings: {
                parallelMode,
                batchSize
              }
            } as any,
            user_id: user.user.id
          })
          .select();

        if (error) throw error;

        toast({
          title: "Workflow saved",
          description: `"${name}" has been saved successfully.`
        });
      }
      
      setSaveForm({ name: '', description: '' });
      if (showSaveDialog) {
        setShowSaveDialog(false);
      }
      
      // Reload workflows to update scenarios list
      const { data: workflows } = await supabase
        .from('workflows')
        .select('*')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false });

      if (workflows) {
        const loadedScenarios: Scenario[] = workflows.map(workflow => {
          const workflowData = workflow.workflow_data as any;
          
          return {
            id: workflow.id,
            name: workflow.name,
            description: workflow.description || '',
            nodes: workflowData?.nodes || [],
            edges: workflowData?.edges || [],
            settings: workflowData?.settings || {
              parallelMode: false,
              batchSize: 5
            },
            createdAt: new Date(workflow.created_at),
            updatedAt: new Date(workflow.updated_at)
          };
        });

        setScenarios(loadedScenarios);
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
      toast({
        title: "Save failed",
        description: "Failed to save workflow. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Scenario List View
  const renderScenariosView = () => <div className="h-screen flex flex-col bg-background">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Automation Scenarios
            </h1>
            <p className="text-muted-foreground mt-2">
              Create and manage your batch automation workflows
            </p>
          </div>
          <Button onClick={() => setCurrentView('create-scenario')} className="gap-2 bg-gradient-primary hover:opacity-90">
            <FolderPlus className="h-4 w-4" />
            New Scenario
          </Button>
        </div>
      </div>

      <div className="flex-1 p-6">
        {scenarios.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-secondary flex items-center justify-center mb-6">
              <FolderPlus className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-3">No scenarios yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Get started by creating your first automation scenario. You can build complex workflows and save them for later use.
            </p>
            <Button onClick={() => setCurrentView('create-scenario')} className="gap-2 bg-gradient-primary hover:opacity-90">
              <FolderPlus className="h-4 w-4" />
              Create First Scenario
            </Button>
          </div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scenarios.map(scenario => <Card key={scenario.id} className="hover:shadow-lg transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <CardTitle className="text-lg">{scenario.name}</CardTitle>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {scenario.description || 'No description'}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteScenario(scenario.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 text-sm">
                      <Badge variant="secondary">
                        {scenario.nodes.length - 1} Tasks
                      </Badge>
                      <Badge variant="outline">
                        {scenario.settings.parallelMode ? 'Parallel' : 'Sequential'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created: {scenario.createdAt.toLocaleDateString()}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => loadScenario(scenario)} className="flex-1 gap-2">
                        <Edit className="h-4 w-4" />
                        Open Scenario
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="default"
                        onClick={() => deleteScenario(scenario.id)} 
                        className="gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>)}
          </div>}
      </div>
    </div>;

  // Create Scenario View
  const renderCreateScenarioView = () => <div className="h-screen flex flex-col bg-background">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setCurrentView('scenarios')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Scenarios
          </Button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Create New Scenario
            </h1>
            <p className="text-muted-foreground mt-2">
              Set up a new automation workflow scenario
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Scenario Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scenario-name">Scenario Name</Label>
              <Input id="scenario-name" placeholder="Enter scenario name" value={scenarioForm.name} onChange={e => setScenarioForm(prev => ({
              ...prev,
              name: e.target.value
            }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scenario-description">Description (Optional)</Label>
              <Textarea id="scenario-description" placeholder="Describe what this scenario does" value={scenarioForm.description} onChange={e => setScenarioForm(prev => ({
              ...prev,
              description: e.target.value
            }))} rows={3} />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setCurrentView('scenarios')} className="flex-1">
                Cancel
              </Button>
              <Button onClick={createScenario} className="flex-1 gap-2 bg-gradient-primary hover:opacity-90" disabled={!scenarioForm.name.trim()}>
                <FolderPlus className="h-4 w-4" />
                Create Scenario
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>;

  // Return appropriate view based on current state
  if (currentView === 'scenarios') {
    return renderScenariosView();
  }
  if (currentView === 'create-scenario') {
    return renderCreateScenarioView();
  }
  return <ReactFlowProvider>
      <div className="h-screen flex bg-background">
        {/* Workflow Sidebar */}
      <WorkflowSidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)} 
        onAddNode={addNode} 
        selectedNode={selectedNode} 
        onNodeUpdate={(nodeId: string, updates: any) => {
          setNodes(prevNodes => prevNodes.map(n => n.id === nodeId ? {
            ...n,
            data: {
              ...n.data,
              ...updates
            }
          } : n));
        }} 
        onRemoveNode={removeNode} 
        onDuplicateNode={duplicateNode}
        onExecuteFromNode={setExecutionStartNode}
        executionStartNode={executionStartNode}
        nodes={nodesWithNumbers}
        setNodes={setNodes}
      />

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Simple Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-secondary border-b border-border">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setCurrentView('scenarios')} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-foreground font-medium">
              {currentScenario?.name || 'name of scenario'}
            </span>
            
            {/* Flashback Mode Indicator */}
            {flashbackMode && (
              <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                <Film className="h-3 w-3" />
                <span>Flashback Mode</span>
                <Button
                  onClick={() => {
                    // Exit flashback mode - restore original nodes and edges
                    setNodes(originalNodes);
                    setEdges(originalEdges);
                    setFlashbackMode(false);
                    setSelectedExecution(null);
                    toast({
                      title: "🔄 Returned to Full View",
                      description: "Showing all workflow nodes",
                      duration: 2000
                    });
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 hover:bg-primary/20"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <Button 
              onClick={() => setShowHistorySidebar(true)}
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              title="Show execution history"
            >
              <History className="h-4 w-4" />
            </Button>
            
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Flow Canvas - Fixed height with proper toolbar space */}
        <div className="flex-1 relative flex flex-col min-h-0">
          {showWebhookConfig ? <div className="absolute inset-0 bg-background z-50 p-6 overflow-auto">
              <WebhookConfig onSave={handleWebhookSave} onCancel={() => {
              setShowWebhookConfig(false);
              setEditingNodeId(null);
            }} />
            </div> : <>
              <div className="flex-1 relative" style={{ height: 'calc(100vh - 120px)' }}>
                <WorkflowContextMenu onAddNode={addNode}>
                  <ReactFlow nodes={nodesWithNumbers} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={onNodeClick} onPaneClick={onPaneClick} nodeTypes={memoizedNodeTypes} edgeTypes={edgeTypes} fitView className="bg-background w-full h-full" connectionLineStyle={{
                  stroke: 'hsl(var(--primary))',
                  strokeWidth: 2
                }} defaultViewport={{
                  x: 0,
                  y: 0,
                  zoom: 0.8
                }}>
                    <Controls className="bg-card border border-border shadow-elegant" showZoom={true} showFitView={true} showInteractive={true} />
                    <Background color="hsl(var(--muted-foreground))" gap={20} variant={BackgroundVariant.Dots} />
                  </ReactFlow>
                </WorkflowContextMenu>
                
                {/* Flash Icon Indicator - Draggable on Canvas */}
                {nodes.length > 0 && (
                  <div 
                    className="absolute top-4 left-4 z-20 cursor-grab active:cursor-grabbing"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/execution-starter', 'true');
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={(e) => {
                      // Handle drop on canvas
                      const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
                      const nodeElement = dropTarget?.closest('.react-flow__node');
                      
                      if (nodeElement) {
                        const nodeId = nodeElement.getAttribute('data-id');
                        if (nodeId) {
                          // Remove execution start from all nodes
                          setNodes((currentNodes) => 
                            currentNodes.map(node => ({
                              ...node,
                              data: {
                                ...node.data,
                                isExecutionStart: node.id === nodeId
                              }
                            }))
                          );
                          
                          setExecutionStartNode(nodeId);
                          
                          toast({
                            title: "⚡ Execution Start Updated",
                            description: `Workflow will now start from "${nodes.find(n => n.id === nodeId)?.data.label || 'selected node'}"`,
                            duration: 3000
                          });
                        }
                      }
                    }}
                    title="Drag to set workflow execution starting point"
                  >
                    <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-primary to-primary-glow rounded-lg shadow-elegant border border-primary/20 hover:scale-105 transition-transform">
                      <div className="w-6 h-6 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                        <Zap className="h-3 w-3 text-primary-foreground animate-pulse" />
                      </div>
                      <span className="text-xs text-primary-foreground font-medium">
                        Execution Start
                      </span>
                    </div>
                  </div>
                )}

                {/* Workflow Toolbar */}
                <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-10">
                  <WorkflowToolbar
                      onSave={saveWorkflow} 
                      onExecute={executeBatchWorkflow} 
                      onShowHistory={() => setShowHistorySidebar(true)}
                      isExecuting={isExecuting} 
                      disabled={nodes.filter(n => n.type !== 'trigger').length === 0} 
                    />
                </div>
              </div>
            </>}

          {/* Floating Add Node Button */}
          {!sidebarOpen && !showWebhookConfig}
        </div>
      </div>

      {/* Node Settings Dialog */}
      <NodeSettingsDialog node={settingsNode} isOpen={settingsDialogOpen} onClose={() => {
        setSettingsDialogOpen(false);
        setSettingsNode(null);
      }} onUpdate={(nodeId: string, updates: any) => {
        setNodes(prevNodes => prevNodes.map(n => n.id === nodeId ? {
          ...n,
          data: {
            ...n.data,
            ...updates
          }
        } : n));
      }} />

      {/* Save Workflow Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workflow-name">Workflow Name</Label>
              <Input 
                id="workflow-name" 
                placeholder="Enter workflow name" 
                value={saveForm.name} 
                onChange={e => setSaveForm(prev => ({ ...prev, name: e.target.value }))} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workflow-description">Description (Optional)</Label>
              <Textarea 
                id="workflow-description" 
                placeholder="Describe what this workflow does" 
                value={saveForm.description} 
                onChange={e => setSaveForm(prev => ({ ...prev, description: e.target.value }))} 
                rows={3} 
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={() => handleSaveWorkflow()} className="flex-1 gap-2 bg-gradient-primary hover:opacity-90" disabled={!saveForm.name.trim()}>
                <Save className="h-4 w-4" />
                Save Workflow
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Sidebar */}
      <WorkflowHistorySidebar
        isOpen={showHistorySidebar}
        onClose={() => setShowHistorySidebar(false)}
        onSelectExecution={(execution) => {
          setSelectedExecution(execution);
          console.log('Selected execution:', execution);
          
          // Enter flashback mode - show only executed nodes
          const executedNodeIds = execution.executed_nodes || [];
          console.log('Executed node IDs:', executedNodeIds);
          
          // Store original state if not already in flashback mode
          if (!flashbackMode) {
            setOriginalNodes([...nodes]);
            setOriginalEdges([...edges]);
          }
          
          // Filter nodes to show only executed ones
          const flashbackNodes = nodes.filter(node => executedNodeIds.includes(node.id))
            .map(node => ({
              ...node,
              data: {
                ...node.data,
                status: 'completed',
                executionResult: execution.result_data,
                hasResult: !!execution.result_data,
                hasCompletedExecution: true
              }
            }));
          
          // Filter edges to show only connections between executed nodes
          const flashbackEdges = edges.filter(edge => 
            executedNodeIds.includes(edge.source) && executedNodeIds.includes(edge.target)
          );
          
          setNodes(flashbackNodes);
          setEdges(flashbackEdges);
          setFlashbackMode(true);
          
          toast({
            title: "📽️ Flashback Mode",
            description: `Showing ${executedNodeIds.length} executed nodes from this run`,
            duration: 3000
          });
        }}
      />
    </div>
    </ReactFlowProvider>;
};
export default FlowBatchBuilder;