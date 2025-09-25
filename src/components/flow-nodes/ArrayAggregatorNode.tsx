import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Layers3, Settings, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import ExecutionNotification from '../workflow/ExecutionNotification';
import ExecutionResultDialog from '../workflow/ExecutionResultDialog';

const ArrayAggregatorNode = memo(({ data }: { data: any }) => {
  const [config, setConfig] = useState(data.config || {});
  const [showResultDialog, setShowResultDialog] = useState(false);

  const updateConfig = (key: string, value: any) => {
    setConfig({ ...config, [key]: value });
    data.config = { ...config, [key]: value };
  };

  const getStatusColor = () => {
    switch (data.status) {
      case 'running': return 'border-warning bg-warning/10';
      case 'completed': return 'border-success bg-success/10';
      case 'error': return 'border-destructive bg-destructive/10';
      default: return 'border-secondary/30';
    }
  };

  return (
    <>
      <Card className={`min-w-[200px] bg-gradient-secondary shadow-card ${getStatusColor()}`}>
        <CardHeader className="p-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-secondary text-secondary-foreground text-xs font-bold">
                {data.nodeNumber || '1'}
              </div>
              <Layers3 className="h-4 w-4 text-secondary" />
              <span className="font-medium text-sm">{data.label || 'Array Aggregator'}</span>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="opacity-0 pointer-events-none">
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Configure Array Aggregator</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Merge Mode</Label>
                    <Select 
                      value={config.mergeMode || 'concat'} 
                      onValueChange={(value) => updateConfig('mergeMode', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="concat">Concatenate Arrays</SelectItem>
                        <SelectItem value="merge">Merge Objects</SelectItem>
                        <SelectItem value="collect">Collect as Separate Items</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Flatten Nested Arrays</Label>
                    <Switch
                      checked={config.flatten || false}
                      onCheckedChange={(checked) => updateConfig('flatten', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Remove Null Values</Label>
                    <Switch
                      checked={config.removeNull || false}
                      onCheckedChange={(checked) => updateConfig('removeNull', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Remove Duplicates</Label>
                    <Switch
                      checked={config.removeDuplicates || false}
                      onCheckedChange={(checked) => updateConfig('removeDuplicates', checked)}
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-1">
          <div className="text-xs text-muted-foreground">
            Collects & merges connected results
          </div>
          <div className="text-xs text-muted-foreground mt-1 font-mono bg-muted/30 p-1 rounded">
            {`{"task1": "result", "task2": "result"}`}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Mode: {config.mergeMode || 'merge'}
          </div>
        </CardContent>
        
        {/* Input handle - more visible */}
        <Handle
          type="target"
          position={Position.Left}
          className="w-4 h-4 bg-primary border-2 border-background rounded-full shadow-elegant hover:bg-primary/80 hover:scale-110 -translate-x-1"
        />
        
        {/* Output handle - more visible */}
        <Handle
          type="source"
          position={Position.Right}
          className="w-4 h-4 bg-success border-2 border-background rounded-full shadow-elegant hover:bg-success/80 hover:scale-110 -translate-x-1"
        />
        
        {/* Execution Start Indicator */}
        {data.isExecutionStart && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-primary rounded-full flex items-center justify-center shadow-md border-2 border-background">
            <Zap className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
        
        {/* Execution notification */}
        <ExecutionNotification 
          status={data.status}
          hasResult={!!data.executionResult}
          onClick={() => setShowResultDialog(true)}
        />
        
        {/* Execution result dialog */}
        <ExecutionResultDialog
          open={showResultDialog}
          onOpenChange={setShowResultDialog}
          result={data.executionResult}
          nodeName={data.label || 'Array Aggregator'}
        />
      </Card>
    </>
  );
});

ArrayAggregatorNode.displayName = 'ArrayAggregatorNode';

export default ArrayAggregatorNode;
