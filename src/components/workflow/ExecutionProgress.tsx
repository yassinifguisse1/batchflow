import React from 'react';
import { Play, CheckCircle, XCircle, Clock, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ExecutionProgressProps {
  isRunning: boolean;
  status: 'idle' | 'running' | 'completed' | 'failed';
  executedNodes: string[];
  currentNodeId: string | null;
  totalNodes: number;
  startTime: Date | null;
  endTime: Date | null;
  error?: string | null;
  className?: string;
}

const ExecutionProgress: React.FC<ExecutionProgressProps> = ({
  isRunning,
  status,
  executedNodes,
  currentNodeId,
  totalNodes,
  startTime,
  endTime,
  error,
  className
}) => {
  const progress = totalNodes > 0 ? (executedNodes.length / totalNodes) * 100 : 0;
  const duration = startTime && endTime ? endTime.getTime() - startTime.getTime() : null;
  const currentDuration = startTime ? Date.now() - startTime.getTime() : 0;

  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle,
          label: 'Completed',
          className: 'text-green-600 bg-green-50 border-green-200',
          progressClassName: 'bg-green-500'
        };
      case 'running':
        return {
          icon: Play,
          label: 'Running',
          className: 'text-blue-600 bg-blue-50 border-blue-200',
          progressClassName: 'bg-blue-500'
        };
      case 'failed':
        return {
          icon: XCircle,
          label: 'Failed',
          className: 'text-red-600 bg-red-50 border-red-200',
          progressClassName: 'bg-red-500'
        };
      case 'idle':
      default:
        return {
          icon: Clock,
          label: 'Idle',
          className: 'text-gray-600 bg-gray-50 border-gray-200',
          progressClassName: 'bg-gray-500'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="h-5 w-5" />
          Workflow Execution
          <Badge 
            variant="outline" 
            className={cn('ml-auto', config.className)}
          >
            {config.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{executedNodes.length}/{totalNodes} nodes</span>
          </div>
          <Progress 
            value={progress} 
            className="h-2"
          />
          <div className="text-xs text-muted-foreground">
            {Math.round(progress)}% complete
          </div>
        </div>

        {/* Execution Stats */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Status</span>
            </div>
            <div className="text-muted-foreground">
              {isRunning ? 'Executing nodes...' : 'Ready to execute'}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-500" />
              <span className="font-medium">Duration</span>
            </div>
            <div className="text-muted-foreground">
              {duration ? formatDuration(duration) : 
               currentDuration > 0 ? formatDuration(currentDuration) : 'Not started'}
            </div>
          </div>
        </div>

        {/* Current Node */}
        {currentNodeId && (
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm font-medium text-blue-600">
              Currently Executing
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Node: {currentNodeId}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-sm font-medium text-red-600">
              Execution Error
            </div>
            <div className="text-xs text-red-500 mt-1">
              {error}
            </div>
          </div>
        )}

        {/* Executed Nodes List */}
        {executedNodes.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Executed Nodes</div>
            <div className="flex flex-wrap gap-1">
              {executedNodes.map((nodeId, index) => (
                <Badge 
                  key={nodeId} 
                  variant="secondary" 
                  className="text-xs"
                >
                  {nodeId}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExecutionProgress;
