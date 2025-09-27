import React from 'react';
import { CheckCircle, Clock, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface NodeStatusIndicatorProps {
  status: 'idle' | 'running' | 'completed' | 'error';
  hasResult?: boolean;
  hasCompletedExecution?: boolean;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const NodeStatusIndicator: React.FC<NodeStatusIndicatorProps> = ({
  status,
  hasResult = false,
  hasCompletedExecution = false,
  className,
  showLabel = true,
  size = 'md'
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle,
          label: 'Completed',
          className: 'text-green-600 bg-green-50 border-green-200',
          iconClassName: 'text-green-600'
        };
      case 'running':
        return {
          icon: Loader2,
          label: 'Processing',
          className: 'text-blue-600 bg-blue-50 border-blue-200 animate-pulse',
          iconClassName: 'text-blue-600 animate-spin'
        };
      case 'error':
        return {
          icon: XCircle,
          label: 'Error',
          className: 'text-red-600 bg-red-50 border-red-200',
          iconClassName: 'text-red-600'
        };
      case 'idle':
      default:
        return {
          icon: Clock,
          label: 'Idle',
          className: 'text-gray-600 bg-gray-50 border-gray-200',
          iconClassName: 'text-gray-600'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const badgeSizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Icon className={cn(sizeClasses[size], config.iconClassName)} />
      {showLabel && (
        <Badge 
          variant="outline" 
          className={cn(
            'border font-medium',
            config.className,
            badgeSizeClasses[size]
          )}
        >
          {config.label}
          {hasResult && status === 'completed' && (
            <span className="ml-1 text-xs opacity-75">✓</span>
          )}
        </Badge>
      )}
    </div>
  );
};

export default NodeStatusIndicator;
