
import React from 'react';
import { Play, Save, Eye, Settings, Download, Upload, Lock, Undo2, Redo2, Grid3X3, Plus, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WorkflowToolbarProps {
  onSave: () => void;
  onExecute: () => void;
  onShowHistory: () => void;
  isExecuting: boolean;
  disabled: boolean;
}

const WorkflowToolbar: React.FC<WorkflowToolbarProps> = ({
  onSave,
  onExecute,
  onShowHistory,
  isExecuting,
  disabled
}) => {
  const [immediatelyAsDataArrives, setImmediatelyAsDataArrives] = React.useState(false);
  const [batchSize, setBatchSize] = React.useState(5);
  const [executionMode, setExecutionMode] = React.useState("Parallel");

  return (
    <div className="flex items-center justify-between w-full px-3 py-1.5 bg-card border-t border-border shadow-elegant overflow-hidden">
      {/* Left side - Run controls and stats */}
      <div className="flex items-center gap-2 min-w-0 flex-shrink">
        <Button 
          onClick={onExecute} 
          disabled={isExecuting || disabled}
          className="gap-1 bg-gradient-primary hover:opacity-90 rounded px-2 py-1 font-medium transition-smooth text-xs flex-shrink-0"
        >
          <Play className="h-3 w-3" />
          {isExecuting ? 'Running...' : 'Run'}
        </Button>
        
        <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
          <Switch 
            checked={immediatelyAsDataArrives}
            onCheckedChange={setImmediatelyAsDataArrives}
            className="scale-75"
          />
          <span className="hidden sm:inline">Auto run</span>
        </div>

        {/* Stats Section */}
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-0.5">
            <span className="font-medium text-foreground">0</span>
            <span>nodes</span>
          </div>
          <div className="flex items-center gap-0.5">
            <span className="font-medium text-foreground">0s</span>
            <span>avg</span>
          </div>
          <div className="flex items-center gap-0.5">
            <span className="font-medium text-foreground">0%</span>
            <span>ok</span>
          </div>
        </div>
      </div>

      {/* Right side - Tool icons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded bg-muted/50 hover:bg-muted transition-smooth"
        >
          <Lock className="h-3 w-3" />
        </Button>
        
        <Button
          onClick={onSave}
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded bg-muted/50 hover:bg-muted transition-smooth"
        >
          <Save className="h-3 w-3" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded bg-muted/50 hover:bg-muted transition-smooth"
        >
          <Upload className="h-3 w-3" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded bg-muted/50 hover:bg-muted transition-smooth"
        >
          <Undo2 className="h-3 w-3" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded bg-muted/50 hover:bg-muted transition-smooth"
        >
          <Redo2 className="h-3 w-3" />
        </Button>
        
        <Separator orientation="vertical" className="h-4 mx-0.5" />
        
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded bg-success/10 hover:bg-success/20 text-success transition-smooth"
        >
          <Eye className="h-3 w-3" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded bg-warning/10 hover:bg-warning/20 text-warning transition-smooth"
        >
          <Settings className="h-3 w-3" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded bg-destructive/10 hover:bg-destructive/20 text-destructive transition-smooth"
        >
          <Grid3X3 className="h-3 w-3" />
        </Button>
        
        <Button
          onClick={onShowHistory}
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-smooth"
          title="Show execution history"
        >
          <History className="h-3 w-3" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded bg-muted/50 hover:bg-muted transition-smooth"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

export default WorkflowToolbar;
