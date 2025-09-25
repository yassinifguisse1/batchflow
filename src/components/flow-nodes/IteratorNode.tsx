
import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { RotateCcw, Settings, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ExecutionResultDialog from '@/components/workflow/ExecutionResultDialog';
import { DataPreview } from '@/components/workflow/DataPreview';

const IteratorNode = memo(({ data }: { data: any }) => {
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
              <RotateCcw className="h-4 w-4 text-secondary" />
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
                  <DialogTitle>Configure Iterator</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Array/List to Iterate</Label>
                    <Input
                      value={config.arrayPath || ''}
                      onChange={(e) => updateConfig('arrayPath', e.target.value)}
                      placeholder="{{data.items}}"
                    />
                  </div>
                  <div>
                    <Label>Item Variable Name</Label>
                    <Input
                      value={config.itemVariable || 'item'}
                      onChange={(e) => updateConfig('itemVariable', e.target.value)}
                      placeholder="item"
                    />
                  </div>
                  <div>
                    <Label>Batch Size (Optional)</Label>
                    <Input
                      type="number"
                      value={config.batchSize || ''}
                      onChange={(e) => updateConfig('batchSize', parseInt(e.target.value))}
                      placeholder="Process all items at once"
                    />
                  </div>
                </div>
              </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-1">
          <div className="text-xs text-muted-foreground">
            For each {config.itemVariable || 'item'} in {config.arrayPath || 'array'}
          </div>
          {config.batchSize && (
            <div className="text-xs text-muted-foreground mt-1">
              Batch size: {config.batchSize}
            </div>
          )}
          {data.executionResult && (
            <DataPreview data={data.executionResult} type="output" maxHeight="80px" />
          )}
        </CardContent>
        
        {/* Input handle - more visible */}
        <Handle
          type="target"
          position={Position.Left}
          className="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg hover:bg-blue-600 transition-all duration-200 hover:scale-110 -translate-x-1"
        />
        
        {/* Output handle - more visible */}
        <Handle
          type="source"
          position={Position.Right}
          className="w-4 h-4 bg-green-500 border-2 border-white rounded-full shadow-lg hover:bg-green-600 transition-all duration-200 hover:scale-110 -translate-x-1"
        />
      </Card>
      
      <ExecutionResultDialog
        open={showExecutionResult}
        onOpenChange={setShowExecutionResult}
        result={data.executionResult}
        nodeName={data.label || 'Iterator'}
        nodeConfig={config}
      />
    </>
  );
});

IteratorNode.displayName = 'IteratorNode';

export default IteratorNode;
