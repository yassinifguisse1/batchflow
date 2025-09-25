
import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Route, Settings, Split, ArrowRight, Clock, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import ExecutionResultDialog from '@/components/workflow/ExecutionResultDialog';
import { DataPreview } from '@/components/workflow/DataPreview';

const RouterNode = memo(({ data }: { data: any }) => {
  const [config, setConfig] = useState(data.config || {
    executionMode: 'parallel', // 'parallel' or 'sequential'
    waitForAll: true,
    outputHandles: 3
  });
  const [showExecutionResult, setShowExecutionResult] = useState(false);

  const updateConfig = (key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    data.config = newConfig;
  };

  const getStatusColor = () => {
    switch (data.status) {
      case 'running': return 'border-warning bg-warning/10';
      case 'completed': return 'border-success bg-success/10';
      case 'error': return 'border-destructive bg-destructive/10';
      default: return 'border-secondary/30';
    }
  };

  const getExecutionIcon = () => {
    return config.executionMode === 'parallel' ? (
      <Split className="h-4 w-4 text-primary" />
    ) : (
      <ArrowRight className="h-4 w-4 text-secondary" />
    );
  };


  return (
    <>
      <div className="relative">
        {/* Main circular router node */}
        <div className={`w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-lg flex items-center justify-center ${getStatusColor()}`}>
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
            {getExecutionIcon()}
          </div>
          {/* Node number overlay */}
          <div className="absolute -top-2 -left-2 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
            {data.nodeNumber || '1'}
          </div>
        </div>
        
        {/* Router label */}
        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-sm font-medium text-foreground whitespace-nowrap">
          {data.label}
        </div>
        
        {/* Execution result preview - positioned below the label */}
        {data.executionResult && (
          <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 w-48">
            <DataPreview data={data.executionResult} type="output" maxHeight="60px" />
          </div>
        )}
        
        {/* Action buttons - positioned near the node */}
        <div className="absolute -top-8 right-0 flex gap-1">
          {data.executionResult && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowExecutionResult(true)}
              className="opacity-60 hover:opacity-100 transition-opacity h-6 w-6 p-0"
            >
              <Eye className="h-3 w-3" />
            </Button>
          )}
          <Dialog>
            <DialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="opacity-60 hover:opacity-100 transition-opacity h-6 w-6 p-0"
              >
                <Settings className="h-3 w-3" />
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Configure Router</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Execution Mode</Label>
                <Select 
                  value={config.executionMode} 
                  onValueChange={(value) => updateConfig('executionMode', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parallel">
                      <div className="flex items-center gap-2">
                        <Split className="h-4 w-4" />
                        Parallel - All at once
                      </div>
                    </SelectItem>
                    <SelectItem value="sequential">
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4" />
                        Sequential - One by one
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {config.executionMode === 'parallel' 
                    ? 'Execute all output branches simultaneously' 
                    : 'Execute output branches one after another in order'
                  }
                </p>
              </div>

              <Separator />

              {config.executionMode === 'parallel' && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Parallel Settings</Label>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Wait for all branches to complete</Label>
                    <Switch
                      checked={config.waitForAll}
                      onCheckedChange={(checked) => updateConfig('waitForAll', checked)}
                    />
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-medium">Number of Output Branches</Label>
                <div className="flex gap-2">
                  <Select 
                    value={config.outputHandles <= 20 ? config.outputHandles.toString() : 'custom'} 
                    onValueChange={(value) => {
                      if (value !== 'custom') {
                        updateConfig('outputHandles', parseInt(value));
                      }
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      <SelectItem value="2">2 branches</SelectItem>
                      <SelectItem value="3">3 branches</SelectItem>
                      <SelectItem value="4">4 branches</SelectItem>
                      <SelectItem value="5">5 branches</SelectItem>
                      <SelectItem value="6">6 branches</SelectItem>
                      <SelectItem value="7">7 branches</SelectItem>
                      <SelectItem value="8">8 branches</SelectItem>
                      <SelectItem value="9">9 branches</SelectItem>
                      <SelectItem value="10">10 branches</SelectItem>
                      <SelectItem value="11">11 branches</SelectItem>
                      <SelectItem value="12">12 branches</SelectItem>
                      <SelectItem value="13">13 branches</SelectItem>
                      <SelectItem value="14">14 branches</SelectItem>
                      <SelectItem value="15">15 branches</SelectItem>
                      <SelectItem value="16">16 branches</SelectItem>
                      <SelectItem value="17">17 branches</SelectItem>
                      <SelectItem value="18">18 branches</SelectItem>
                      <SelectItem value="19">19 branches</SelectItem>
                      <SelectItem value="20">20 branches</SelectItem>
                      <SelectItem value="custom">Custom...</SelectItem>
                    </SelectContent>
                  </Select>
                  {(config.outputHandles > 20) && (
                    <div className="flex-1">
                      <Input
                        type="number"
                        min="2"
                        max="100"
                        value={config.outputHandles}
                        onChange={(e) => {
                          const value = Math.max(2, Math.min(100, parseInt(e.target.value) || 2));
                          updateConfig('outputHandles', value);
                        }}
                        className="h-10"
                        placeholder="Enter number of branches"
                      />
                    </div>
                  )}
                </div>
                {config.outputHandles > 20 && (
                  <p className="text-xs text-muted-foreground">
                    Custom number of branches (2-100)
                  </p>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold mt-0.5">
                    i
                  </div>
                  <div className="text-sm text-blue-700">
                    The router will distribute incoming data to all connected output branches based on your execution mode.
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
          </Dialog>
        </div>
        
        {/* Execution mode badge */}
        <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2">
          <Badge variant="secondary" className="text-xs bg-background border">
            {config.executionMode === 'parallel' ? 'Parallel' : 'Sequential'}
          </Badge>
        </div>
      </div>
      
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-primary border-2 border-background -translate-x-1"
      />
      
      {/* Single output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-green-500 border-2 border-background rounded-full -translate-x-1"
      />
      
      <ExecutionResultDialog
        open={showExecutionResult}
        onOpenChange={setShowExecutionResult}
        result={data.executionResult}
        nodeName={data.label || 'Router'}
        nodeConfig={config}
      />
    </>
  );
});

RouterNode.displayName = 'RouterNode';

export default RouterNode;
