
import React from 'react';
import { Clock, Zap, TrendingUp, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface WorkflowStatsProps {
  stats: {
    totalNodes: number;
    totalConnections: number;
    avgExecutionTime: number;
    successRate: string | number;
  };
}

const WorkflowStats: React.FC<WorkflowStatsProps> = ({ stats }) => {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 text-sm">
        <Zap className="h-4 w-4 text-primary" />
        <span className="font-medium">{stats.totalNodes}</span>
        <span className="text-muted-foreground">nodes</span>
      </div>
      
      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 text-success" />
        <span className="font-medium">{stats.avgExecutionTime}s</span>
        <span className="text-muted-foreground">avg</span>
      </div>
      
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle className="h-4 w-4 text-warning" />
        <span className="font-medium">{stats.successRate}%</span>
        <span className="text-muted-foreground">success</span>
      </div>
    </div>
  );
};

export default WorkflowStats;
