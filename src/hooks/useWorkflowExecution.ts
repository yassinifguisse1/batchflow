import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ExecutionState {
  isRunning: boolean;
  currentExecutionId: string | null;
  executedNodes: string[];
  currentNodeId: string | null;
  status: 'idle' | 'running' | 'completed' | 'failed';
  startTime: Date | null;
  endTime: Date | null;
  nodeResults: Record<string, any>;
  error: string | null;
}

interface NodeUpdate {
  nodeId: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  hasResult?: boolean;
  executionResult?: any;
  hasCompletedExecution?: boolean;
}

export const useWorkflowExecution = (allNodes: any[] = [], allEdges: any[] = []) => {
  const [executionState, setExecutionState] = useState<ExecutionState>({
    isRunning: false,
    currentExecutionId: null,
    executedNodes: [],
    currentNodeId: null,
    status: 'idle',
    startTime: null,
    endTime: null,
    nodeResults: {},
    error: null
  });

  const [nodeUpdates, setNodeUpdates] = useState<NodeUpdate[]>([]);
  const channelsRef = useRef<Set<any>>(new Set());
  const { toast } = useToast();

  // Cleanup all channels
  const cleanupChannels = useCallback(() => {
    console.log('🧹 Cleaning up execution channels...');
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel);
    });
    channelsRef.current.clear();
  }, []);

  // Function to find connected nodes from webhook trigger
  const getConnectedNodes = useCallback((nodes: any[], edges: any[]) => {
    // Find webhook trigger node
    const triggerNode = nodes.find(node => node.type === 'trigger');
    if (!triggerNode) return [];
    
    // Build adjacency map
    const adjacencyMap = new Map<string, string[]>();
    edges.forEach(edge => {
      if (!adjacencyMap.has(edge.source)) {
        adjacencyMap.set(edge.source, []);
      }
      adjacencyMap.get(edge.source)!.push(edge.target);
    });
    
    // BFS to find all connected nodes
    const connected = new Set<string>();
    const queue = [triggerNode.id];
    connected.add(triggerNode.id);
    
    while (queue.length > 0) {
      const currentNodeId = queue.shift()!;
      const neighbors = adjacencyMap.get(currentNodeId) || [];
      
      neighbors.forEach(neighborId => {
        if (!connected.has(neighborId)) {
          connected.add(neighborId);
          queue.push(neighborId);
        }
      });
    }
    
    return Array.from(connected);
  }, []);

  // Function to mark only connected nodes as running when workflow starts
  const markConnectedNodesAsRunning = useCallback((nodes: any[], edges: any[]) => {
    const connectedNodeIds = getConnectedNodes(nodes, edges);
    const connectedGptNodes = connectedNodeIds.filter(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      return node && node.type === 'gptTask';
    });
    
    console.log('🚀 Marking connected GPT nodes as running:', connectedGptNodes);
    
    if (connectedGptNodes.length === 0) {
      console.warn('⚠️ No connected GPT nodes found in workflow');
      return;
    }
    
    const runningUpdates: NodeUpdate[] = connectedGptNodes.map(nodeId => ({
      nodeId,
      status: 'running',
      hasResult: false,
      hasCompletedExecution: false
    }));
    
    setNodeUpdates(runningUpdates);
    
    toast({
      title: "🚀 Connected GPT Tasks Started",
      description: `${connectedGptNodes.length} connected GPT tasks are now processing in parallel`,
      duration: 3000
    });
  }, [getConnectedNodes, toast]);

  // Setup execution tracking
  const setupExecutionTracking = useCallback(() => {
    console.log('🔧 Setting up centralized execution tracking...');
    
    // Clean up existing channels first
    cleanupChannels();

    // Listen for workflow executions
    const executionChannel = supabase
      .channel('workflow-execution-tracker')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_executions'
        },
        (payload) => {
          console.log('📊 Execution update received:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const execution = payload.new;
            const executedNodeIds = execution.executed_nodes || [];
            const currentNodeId = execution.current_node_id;
            const status = execution.status;
            const nodeResults = execution.result_data?.nodeResults || {};
            
            console.log('🔄 Updating execution state:', {
              executionId: execution.id,
              status,
              executedNodes: executedNodeIds,
              currentNodeId,
              nodeResultsCount: Object.keys(nodeResults).length,
              totalNodesInWorkflow: allNodes.length,
              nodeTypes: allNodes.map(n => ({ id: n.id, type: n.type }))
            });

            setExecutionState(prev => ({
              ...prev,
              currentExecutionId: execution.id,
              executedNodes: executedNodeIds,
              currentNodeId: status === 'completed' ? null : currentNodeId, // Clear current node when completed
              status,
              nodeResults,
              isRunning: status === 'running',
              startTime: prev.startTime || new Date(),
              endTime: status === 'completed' || status === 'failed' ? new Date() : null,
              error: status === 'failed' ? execution.error_message : null
            }));

            console.log('🔄 Updated execution state:', {
              status,
              isRunning: status === 'running',
              executedNodes: executedNodeIds.length,
              currentNodeId: status === 'completed' ? null : currentNodeId
            });

            // Generate node updates for all nodes
            const updates: NodeUpdate[] = [];
            
            // Update all nodes based on execution state
            if (status === 'completed') {
              // FORCE ALL EXECUTED NODES TO COMPLETED - no exceptions
              console.log('🎯 WORKFLOW COMPLETED - Forcing ALL executed nodes to completed status');
              
              executedNodeIds.forEach(nodeId => {
                const nodeResult = nodeResults[nodeId];
                // More flexible result validation - check if node has any meaningful result
                const hasValidResult = nodeResult && (
                  nodeResult.result !== undefined || 
                  nodeResult.response !== undefined ||
                  nodeResult.webhook_response !== undefined ||
                  Object.keys(nodeResult).length > 0
                );
                
                console.log(`🔍 Node ${nodeId} result validation:`, { 
                  nodeResult, 
                  hasValidResult,
                  resultKeys: nodeResult ? Object.keys(nodeResult) : []
                });
                
                updates.push({
                  nodeId,
                  status: 'completed', // If workflow completed successfully, all executed nodes are completed
                  hasResult: hasValidResult,
                  executionResult: nodeResult,
                  hasCompletedExecution: true
                });
              });

              // ALSO force the current node (usually webhook response) to completed
              if (currentNodeId && !executedNodeIds.includes(currentNodeId)) {
                console.log(`🎯 FORCING current node ${currentNodeId} to completed (usually webhook response)`);
                const nodeResult = nodeResults[currentNodeId];
                const hasValidResult = nodeResult && Object.keys(nodeResult).length > 0;
                
                updates.push({
                  nodeId: currentNodeId,
                  status: 'completed',
                  hasResult: hasValidResult,
                  executionResult: nodeResult,
                  hasCompletedExecution: true
                });
              }
            } else if (status === 'running') {
              // Current node is running, executed nodes are completed
              executedNodeIds.forEach(nodeId => {
                const nodeResult = nodeResults[nodeId];
                const hasValidResult = nodeResult && (
                  nodeResult.result !== undefined || 
                  nodeResult.response !== undefined ||
                  nodeResult.webhook_response !== undefined ||
                  Object.keys(nodeResult).length > 0
                );
                
                updates.push({
                  nodeId,
                  status: nodeId === currentNodeId ? 'running' : 'completed',
                  hasResult: hasValidResult,
                  executionResult: nodeResult,
                  hasCompletedExecution: nodeId !== currentNodeId
                });
              });
            } else if (status === 'failed' || status === 'incomplete') {
              // Mark current and executed nodes as error
              [...executedNodeIds, currentNodeId].filter(Boolean).forEach(nodeId => {
                updates.push({
                  nodeId,
                  status: 'error',
                  hasResult: false,
                  hasCompletedExecution: false
                });
              });
            }

            setNodeUpdates(updates);

            // AGGRESSIVE: Also trigger individual node updates for completion
            if (status === 'completed') {
              console.log('🚀 AGGRESSIVE COMPLETION: Triggering individual node updates');
              setTimeout(() => {
                // Force update all nodes that should be completed
                const allNodesToComplete = [...executedNodeIds];
                if (currentNodeId && !executedNodeIds.includes(currentNodeId)) {
                  allNodesToComplete.push(currentNodeId);
                }
                
                allNodesToComplete.forEach(nodeId => {
                  const nodeResult = nodeResults[nodeId];
                  setNodeUpdates(prev => {
                    const existingUpdate = prev.find(u => u.nodeId === nodeId);
                    if (existingUpdate && existingUpdate.status !== 'completed') {
                      console.log(`🔄 FORCING node ${nodeId} status to completed (was ${existingUpdate.status})`);
                      return prev.map(u => u.nodeId === nodeId ? {
                        ...u,
                        status: 'completed',
                        hasCompletedExecution: true
                      } : u);
                    }
                    return prev;
                  });
                });
              }, 100); // Small delay to ensure all updates are processed
            }

            // Enhanced toast messages
            if (status === 'completed') {
              const completedNodes = updates.filter(u => u.status === 'completed').length;
              const failedNodes = updates.filter(u => u.status === 'error').length;
              
              if (failedNodes === 0) {
                toast({
                  title: "🎉 All Tasks Completed Successfully!",
                  description: `${completedNodes} GPT tasks completed with valid results`,
                  duration: 5000
                });
              } else {
                toast({
                  title: "⚠️ Workflow Completed with Issues",
                  description: `${completedNodes} completed, ${failedNodes} failed (missing/invalid results)`,
                  variant: "destructive",
                  duration: 8000
                });
              }
            } else if (status === 'running') {
              const runningNodes = updates.filter(u => u.status === 'running').length;
              const completedNodes = updates.filter(u => u.status === 'completed').length;
              
              toast({
                title: "🚀 Workflow Processing...",
                description: `${runningNodes} tasks running, ${completedNodes} completed`,
                duration: 3000
              });
            } else if (status === 'failed' || status === 'incomplete') {
              toast({
                title: "❌ Workflow Failed",
                description: execution.error_message || "Some tasks failed or returned incomplete results",
                variant: "destructive",
                duration: 10000
              });
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log('🔌 Execution tracker subscription status:', status, err);
      });

    channelsRef.current.add(executionChannel);

    // Listen for webhook requests for immediate feedback
    const webhookChannel = supabase
      .channel('webhook-request-tracker')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webhook_requests'
        },
        (payload) => {
          console.log('🔔 New webhook request received:', payload);
          
          const requestBody = payload.new.request_body;
          const requestKeys = Object.keys(requestBody || {});
          
          // Trigger initial "running" state for only connected GPT nodes
          // This will be overridden by actual execution updates, but gives immediate feedback
          markConnectedNodesAsRunning(allNodes, allEdges);
          
          toast({
            title: "🚀 Webhook Request Received",
            description: `Starting workflow execution with fields: ${requestKeys.join(', ')}. All GPT tasks starting in parallel.`,
            duration: 4000
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
          console.log('🔄 Webhook request updated:', payload);
          
          const updatedRequest = payload.new;
          if (updatedRequest.response_body && updatedRequest.processing_time_ms) {
            const responseBody = updatedRequest.response_body;
            const isSuccess = updatedRequest.response_status >= 200 && updatedRequest.response_status < 300;
            const hasError = responseBody?.error || !isSuccess;
            
            if (hasError) {
              toast({
                title: "❌ Webhook Processing Failed",
                description: `Some GPT tasks failed or returned incomplete results. Error: ${responseBody?.message || 'Unknown error'}. Duration: ${updatedRequest.processing_time_ms}ms`,
                variant: "destructive",
                duration: 8000
              });
            } else {
              // Count successful fields in response
              const responseFields = Object.keys(responseBody || {}).filter(key => 
                responseBody[key] && responseBody[key] !== '' && !key.includes('error')
              );
              
              toast({
                title: "✅ All GPT Tasks Completed Successfully!",
                description: `Webhook processed successfully. ${responseFields.length} fields generated in ${updatedRequest.processing_time_ms}ms`,
                duration: 5000
              });
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log('🔌 Webhook tracker subscription status:', status, err);
      });

    channelsRef.current.add(webhookChannel);

    return () => {
      cleanupChannels();
    };
  }, [cleanupChannels, toast, allNodes, allEdges, markConnectedNodesAsRunning]);

  // Get node status for a specific node
  const getNodeStatus = useCallback((nodeId: string) => {
    const update = nodeUpdates.find(u => u.nodeId === nodeId);
    if (update) {
      return {
        status: update.status,
        hasResult: update.hasResult || false,
        executionResult: update.executionResult,
        hasCompletedExecution: update.hasCompletedExecution || false
      };
    }

    // Fallback to execution state
    const isExecuted = executionState.executedNodes.includes(nodeId);
    const isCurrent = executionState.currentNodeId === nodeId;
    
    if (executionState.status === 'completed' && isExecuted) {
      return {
        status: 'completed' as const,
        hasResult: true,
        executionResult: executionState.nodeResults[nodeId],
        hasCompletedExecution: true
      };
    } else if (executionState.status === 'running' && isCurrent) {
      return {
        status: 'running' as const,
        hasResult: false,
        executionResult: null,
        hasCompletedExecution: false
      };
    } else if (executionState.status === 'running' && isExecuted) {
      return {
        status: 'completed' as const,
        hasResult: true,
        executionResult: executionState.nodeResults[nodeId],
        hasCompletedExecution: true
      };
    } else if (executionState.status === 'failed' && (isExecuted || isCurrent)) {
      return {
        status: 'error' as const,
        hasResult: false,
        executionResult: null,
        hasCompletedExecution: false
      };
    }

    return {
      status: 'idle' as const,
      hasResult: false,
      executionResult: null,
      hasCompletedExecution: false
    };
  }, [nodeUpdates, executionState]);

  // Reset execution state
  const resetExecution = useCallback(() => {
    setExecutionState({
      isRunning: false,
      currentExecutionId: null,
      executedNodes: [],
      currentNodeId: null,
      status: 'idle',
      startTime: null,
      endTime: null,
      nodeResults: {},
      error: null
    });
    setNodeUpdates([]);
  }, []);

  // Setup tracking on mount
  useEffect(() => {
    const cleanup = setupExecutionTracking();
    return cleanup;
  }, [setupExecutionTracking, allNodes, allEdges, markConnectedNodesAsRunning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupChannels();
    };
  }, [cleanupChannels]);

  return {
    executionState,
    nodeUpdates,
    getNodeStatus,
    resetExecution,
    setupExecutionTracking,
    cleanupChannels,
    markConnectedNodesAsRunning
  };
};
