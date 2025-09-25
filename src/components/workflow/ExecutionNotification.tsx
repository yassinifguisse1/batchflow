import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Play } from 'lucide-react';

interface ExecutionNotificationProps {
  status: 'completed' | 'error' | 'running' | 'idle' | null;
  hasResult?: boolean;
  onClick?: () => void;
}

const ExecutionNotification: React.FC<ExecutionNotificationProps> = ({
  status,
  hasResult,
  onClick
}) => {
  // Diagnostics - use console.log to ensure visibility
  console.log('🔔 [ExecutionNotification] RENDER START', { status, hasResult });
  
  // Show notification when there's a result or actionable status
  const actionable = status === 'running' || status === 'completed' || status === 'error';
  const shouldShow = hasResult === true || actionable;
  
  console.log('🔔 [ExecutionNotification] SHOULD SHOW CHECK', { shouldShow, hasResult, actionable, status });
  
  if (!shouldShow) {
    console.log('🔔 [ExecutionNotification] SKIP RENDER - NOT SHOWING', { status, hasResult });
    return null;
  }

  const getNotificationConfig = () => {
    // If there's a result, always show as completed regardless of status
    if (hasResult) {
      return {
        icon: <CheckCircle className="h-3 w-3" />,
        className: "bg-success text-success-foreground hover:bg-success/80 shadow-lg border-2 border-background",
        label: "View Results"
      };
    }
    
    switch (status) {
      case 'completed':
        return {
          icon: <CheckCircle className="h-3 w-3" />,
          className: "bg-success text-success-foreground hover:bg-success/80 shadow-lg border-2 border-background",
          label: "View Results"
        };
      case 'error':
        return {
          icon: <XCircle className="h-3 w-3" />,
          className: "bg-destructive text-destructive-foreground hover:bg-destructive/80 shadow-lg border-2 border-background",
          label: "View Error"
        };
      case 'running':
        return {
          icon: <Clock className="h-3 w-3 animate-spin" />,
          className: "bg-warning text-warning-foreground animate-pulse shadow-lg border-2 border-background",
          label: "Processing..."
        };
      default:
        return null;
    }
  };

  const config = getNotificationConfig();
  if (!config) {
    console.warn('🔔 [ExecutionNotification] NO CONFIG FOR STATUS', { status, hasResult });
    return null;
  }

  console.log('🔔 [ExecutionNotification] WILL RENDER BADGE', { label: config.label, status, hasResult, className: config.className });

  return (
    <div 
      className="execution-notification pointer-events-auto"
      data-execution-notification="true"
      data-testid="execution-notification"
      aria-label={config.label}
      onClick={(e) => {
        console.log('🔔 [ExecutionNotification] CLICKED!', { status, hasResult });
        e.stopPropagation();
        onClick?.();
      }}
      style={{ 
        position: 'absolute',
        top: '-8px',
        right: '-8px',
        zIndex: 99999,
        pointerEvents: 'auto'
      }}
    >
      <Badge 
        className={`cursor-pointer transition-colors duration-200 min-w-[24px] min-h-[24px] flex items-center justify-center ring-1 ring-background/40 drop-shadow ${config.className}`}
        title={config.label}
      >
        {config.icon}
      </Badge>
    </div>
  );
};

export default ExecutionNotification;