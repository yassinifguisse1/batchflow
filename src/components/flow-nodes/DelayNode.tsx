
import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Clock, Settings, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExecutionResultDialog from '@/components/workflow/ExecutionResultDialog';
import { DataPreview } from '@/components/workflow/DataPreview';

const DelayNode = memo(({ data }: { data: any }) => {
  const [config, setConfig] = useState(data.config || {});
  const [showExecutionResult, setShowExecutionResult] = useState(false);

  const updateConfig = (key: string, value: any) => {
    setConfig({ ...config, [key]: value });
    data.config = { ...config, [key]: value };
  };

  const getStatusColor = () => {
    switch (data.status) {
      case 'running': return 'border-warning bg-warning/10';
      case 'completed': return 'border-success bg-success/10';
      case 'error': return 'border-destructive bg-destructive/10';
      default: return 'border-muted-foreground/30';
    }
  };

  return (
    <>
      <Card className={`min-w-[200px] bg-gradient-accent shadow-card ${getStatusColor()}`}>
        <CardHeader className="p-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted-foreground text-background text-xs font-bold">
                {data.nodeNumber || '1'}
              </div>
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{data.label}</span>
            </div>
            <div className="flex gap-1">
              {data.executionResult && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowExecutionResult(true)}
                  className="opacity-60 hover:opacity-100 transition-opacity"
                >
                  <Eye className="h-3 w-3" />
                </Button>
              )}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="opacity-60 hover:opacity-100 transition-opacity">
                    <Settings className="h-3 w-3" />
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Configure Delay</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Duration</Label>
                    <Input
                      type="number"
                      value={config.duration || 1000}
                      onChange={(e) => updateConfig('duration', parseInt(e.target.value))}
                      min="100"
                    />
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <Select value={config.unit} onValueChange={(value) => updateConfig('unit', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ms">Milliseconds</SelectItem>
                        <SelectItem value="seconds">Seconds</SelectItem>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-1">
          <div className="text-xs text-muted-foreground">
            Wait for {config.duration || 1000} {config.unit || 'ms'}
          </div>
          {data.executionResult && (
            <DataPreview data={data.executionResult} type="output" maxHeight="80px" />
          )}
        </CardContent>
        
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 bg-muted-foreground border-2 border-background"
        />
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-muted-foreground border-2 border-background"
        />
      </Card>
      
      <ExecutionResultDialog
        open={showExecutionResult}
        onOpenChange={setShowExecutionResult}
        result={data.executionResult}
        nodeName={data.label || 'Delay'}
        nodeConfig={config}
      />
    </>
  );
});

DelayNode.displayName = 'DelayNode';

export default DelayNode;
