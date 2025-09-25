
import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Database, Settings, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExecutionResultDialog from '@/components/workflow/ExecutionResultDialog';
import { DataPreview } from '@/components/workflow/DataPreview';

const DataTransformNode = memo(({ data }: { data: any }) => {
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
      default: return 'border-accent/30';
    }
  };

  return (
    <>
      <Card className={`min-w-[200px] bg-gradient-accent shadow-card ${getStatusColor()}`}>
        <CardHeader className="p-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs font-bold">
                {data.nodeNumber || '1'}
              </div>
              <Database className="h-4 w-4 text-accent-foreground" />
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
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Configure Data Transform</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Transformation Type</Label>
                    <Select value={config.transformType} onValueChange={(value) => updateConfig('transformType', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="map">Map Fields</SelectItem>
                        <SelectItem value="filter">Filter Data</SelectItem>
                        <SelectItem value="aggregate">Aggregate</SelectItem>
                        <SelectItem value="format">Format</SelectItem>
                        <SelectItem value="custom">Custom Script</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Input Data Path</Label>
                    <Textarea
                      value={config.inputPath || ''}
                      onChange={(e) => updateConfig('inputPath', e.target.value)}
                      placeholder="{{data}}"
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>Transformation Logic</Label>
                    <Textarea
                      value={config.transformation || ''}
                      onChange={(e) => updateConfig('transformation', e.target.value)}
                      placeholder={
                        config.transformType === 'custom' 
                          ? 'return data.map(item => ({ ...item, newField: item.oldField }));'
                          : 'Configure transformation logic...'
                      }
                      rows={4}
                    />
                  </div>

                  <div>
                    <Label>Output Field Name</Label>
                    <Textarea
                      value={config.outputField || ''}
                      onChange={(e) => updateConfig('outputField', e.target.value)}
                      placeholder="transformedData"
                      rows={1}
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
            {config.transformType || 'Transform'}: {config.inputPath || 'data'} → {config.outputField || 'output'}
          </div>
          {data.executionResult && (
            <DataPreview data={data.executionResult} type="output" maxHeight="80px" />
          )}
        </CardContent>
        
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 bg-accent-foreground border-2 border-background"
        />
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-accent-foreground border-2 border-background"
        />
      </Card>
      
      <ExecutionResultDialog
        open={showExecutionResult}
        onOpenChange={setShowExecutionResult}
        result={data.executionResult}
        nodeName={data.label || 'Data Transform'}
        nodeConfig={config}
      />
    </>
  );
});

DataTransformNode.displayName = 'DataTransformNode';

export default DataTransformNode;
