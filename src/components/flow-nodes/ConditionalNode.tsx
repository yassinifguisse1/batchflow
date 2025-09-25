import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitBranch, Settings, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExecutionResultDialog from '@/components/workflow/ExecutionResultDialog';
import { DataPreview } from '@/components/workflow/DataPreview';
const ConditionalNode = memo(({
  data
}: {
  data: any;
}) => {
  const [config, setConfig] = useState(data.config || {});
  const [showExecutionResult, setShowExecutionResult] = useState(false);
  const updateConfig = (key: string, value: any) => {
    setConfig({
      ...config,
      [key]: value
    });
    data.config = {
      ...config,
      [key]: value
    };
  };
  const getStatusColor = () => {
    switch (data.status) {
      case 'running':
        return 'border-warning bg-warning/10';
      case 'completed':
        return 'border-success bg-success/10';
      case 'error':
        return 'border-destructive bg-destructive/10';
      default:
        return 'border-secondary/30';
    }
  };
  return <>
      <Card className={`min-w-[200px] bg-gradient-secondary shadow-card ${getStatusColor()}`}>
        <CardHeader className="p-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-secondary text-secondary-foreground text-xs font-bold">
                {data.nodeNumber || '1'}
              </div>
              <GitBranch className="h-4 w-4 text-secondary" />
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
                  <DialogTitle>Configure Conditional</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Condition Type</Label>
                    <Select value={config.conditionType} onValueChange={value => updateConfig('conditionType', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">Equals</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="greater">Greater Than</SelectItem>
                        <SelectItem value="less">Less Than</SelectItem>
                        <SelectItem value="exists">Exists</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Value to Check</Label>
                    <Input value={config.checkValue || ''} onChange={e => updateConfig('checkValue', e.target.value)} placeholder="{{data.field}}" />
                  </div>
                  <div>
                    <Label>Compare Against</Label>
                    <Input value={config.compareValue || ''} onChange={e => updateConfig('compareValue', e.target.value)} placeholder="Expected value" />
                  </div>
                </div>
              </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-1">
          <div className="text-xs text-muted-foreground">
            If {config.checkValue || 'condition'} {config.conditionType || 'equals'} {config.compareValue || 'value'}
          </div>
          <div className="flex justify-between mt-2">
            <div className="text-xs text-success">✓ True</div>
            <div className="text-xs text-destructive">✗ False</div>
          </div>
          {data.executionResult && (
            <DataPreview data={data.executionResult} type="output" maxHeight="80px" />
          )}
        </CardContent>
        
        <Handle type="target" position={Position.Left} className="w-3 h-3 bg-secondary border-2 border-background" />
        <Handle id="true" type="source" position={Position.Right} style={{
        top: '30%'
      }} className="w-3 h-3 bg-success border-2 border-background" />
        <Handle id="false" type="source" position={Position.Right} style={{
        top: '70%'
      }} className="w-3 h-3 bg-destructive border-2 border-background" />
      </Card>
      
      <ExecutionResultDialog
        open={showExecutionResult}
        onOpenChange={setShowExecutionResult}
        result={data.executionResult}
        nodeName={data.label || 'Conditional'}
        nodeConfig={config}
      />
    </>;
});
ConditionalNode.displayName = 'ConditionalNode';
export default ConditionalNode;