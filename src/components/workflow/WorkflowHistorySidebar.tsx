import React, { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { X, Clock, CheckCircle, AlertTriangle, Play, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface ExecutionHistoryItem {
  id: string;
  status: string;
  started_at: string;
  completed_at?: string;
  executed_nodes: any;
  result_data?: any;
  error_message?: string;
  workflow_id?: string;
}

interface WorkflowHistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectExecution: (execution: ExecutionHistoryItem) => void;
}

const WorkflowHistorySidebar: React.FC<WorkflowHistorySidebarProps> = ({
  isOpen,
  onClose,
  onSelectExecution
}) => {
  const [currentlyRunning, setCurrentlyRunning] = useState<ExecutionHistoryItem[]>([]);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Load execution history
  const loadExecutionHistory = async () => {
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: executions, error } = await supabase
        .from('workflow_executions')
        .select('*')
        .eq('user_id', user.user.id)
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Clean up stuck executions (running for more than 10 minutes)
      const now = new Date();
      const stuckExecutions = executions?.filter(exec => {
        if (exec.status !== 'running') return false;
        const startedAt = new Date(exec.started_at);
        const minutesAgo = (now.getTime() - startedAt.getTime()) / (1000 * 60);
        return minutesAgo > 10; // Stuck for more than 10 minutes
      }) || [];

      if (stuckExecutions.length > 0) {
        console.log('Found stuck executions, cleaning up:', stuckExecutions.length);
        await Promise.all(stuckExecutions.map(exec => 
          supabase
            .from('workflow_executions')
            .update({ 
              status: 'failed', 
              error_message: 'Execution timed out or failed to complete',
              completed_at: new Date().toISOString()
            })
            .eq('id', exec.id)
        ));
        
        // Reload after cleanup
        const { data: cleanedExecutions } = await supabase
          .from('workflow_executions')
          .select('*')
          .eq('user_id', user.user.id)
          .order('started_at', { ascending: false })
          .limit(50);
        
        executions.splice(0, executions.length, ...(cleanedExecutions || []));
      }

      const running = executions?.filter(exec => exec.status === 'running') || [];
      const completed = executions?.filter(exec => exec.status !== 'running') || [];

      setCurrentlyRunning(running as ExecutionHistoryItem[]);
      setExecutionHistory(completed as ExecutionHistoryItem[]);
    } catch (error) {
      console.error('Error loading execution history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadExecutionHistory();
    }
  }, [isOpen]);

  // Real-time updates for executions
  useEffect(() => {
    if (!isOpen) return;

    const channel = supabase
      .channel('execution-history-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_executions'
        },
        (payload) => {
          console.log('Execution update received:', payload);
          loadExecutionHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Running</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Success</Badge>;
      case 'failed':
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatExecutionTime = (startedAt: string, completedAt?: string) => {
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const duration = Math.max(0, end.getTime() - start.getTime());
    
    if (duration < 1000) {
      return 'Less than 1 sec';
    } else if (duration < 60000) {
      return `${Math.round(duration / 1000)} seconds`;
    } else {
      return `${Math.round(duration / 60000)} minutes`;
    }
  };

  // Clear all stuck executions manually
  const clearStuckExecutions = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { error } = await supabase
        .from('workflow_executions')
        .update({ 
          status: 'failed', 
          error_message: 'Manually cleared stuck execution',
          completed_at: new Date().toISOString()
        })
        .eq('user_id', user.user.id)
        .eq('status', 'running');

      if (error) throw error;
      
      await loadExecutionHistory();
    } catch (error) {
      console.error('Error clearing stuck executions:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-background border-l border-border z-30 flex flex-col shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-lg">Execution History</h3>
        <Button onClick={onClose} variant="ghost" size="sm">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Currently Running Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
                Currently Running
              </h4>
              {currentlyRunning.length > 0 && (
                <Button
                  onClick={clearStuckExecutions}
                  variant="ghost"
                  size="sm"
                  className="text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear Stuck
                </Button>
              )}
            </div>
            {currentlyRunning.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No execution is currently running
              </p>
            ) : (
              <div className="space-y-2">
                {currentlyRunning.map((execution) => (
                  <Card 
                    key={execution.id} 
                    className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => onSelectExecution(execution)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(execution.status)}
                        <span className="text-sm font-medium">
                          Scenario execution
                        </span>
                      </div>
                      {getStatusBadge(execution.status)}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>Started {formatDistanceToNow(new Date(execution.started_at))} ago</div>
                      <div>Executed {execution.executed_nodes?.length || 0} nodes</div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* History Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
                History
              </h4>
              <Button 
                onClick={loadExecutionHistory} 
                variant="ghost" 
                size="sm"
                disabled={loading}
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            
            {executionHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No execution history found
              </p>
            ) : (
              <div className="space-y-2">
                {executionHistory.map((execution) => (
                  <Card 
                    key={execution.id} 
                    className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => onSelectExecution(execution)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(execution.status)}
                        <span className="text-sm font-medium">
                          {new Date(execution.started_at).toLocaleTimeString('en-US', {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })} ,{new Date(execution.started_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                          })}
                        </span>
                      </div>
                      {getStatusBadge(execution.status)}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>⚡ {execution.executed_nodes?.length || 0} 
                        {execution.status === 'completed' ? ' KB' : ' nodes'}
                      </div>
                      <div>⏱️ {formatExecutionTime(execution.started_at, execution.completed_at)}</div>
                      {execution.error_message && (
                        <div className="text-red-500 truncate">
                          Error: {execution.error_message}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default WorkflowHistorySidebar;