import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Image, Settings, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExecutionNotification from '../workflow/ExecutionNotification';
import ExecutionResultDialog from '../workflow/ExecutionResultDialog';
const ImageTaskNode = memo(({
  data
}: {
  data: any;
}) => {
  const [config, setConfig] = useState(data.config || {});
  const [showResultDialog, setShowResultDialog] = useState(false);
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
        return 'border-warning/30';
    }
  };
  return <>
      <Card className={`min-w-[220px] bg-gradient-accent shadow-card relative ${getStatusColor()}`}>
        <CardHeader className="p-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-warning text-warning-foreground text-xs font-bold">
                {data.nodeNumber || '1'}
              </div>
              <div className="p-1.5 rounded-md bg-warning/10">
                <Image className="h-4 w-4 text-warning" />
              </div>
              <span className="font-medium text-sm">{data.label}</span>
            </div>
            <div className="flex items-center gap-1">
              {data.status && data.status !== 'idle' && <Badge variant={data.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                  {data.status}
                </Badge>}
              <Dialog>
                <DialogTrigger asChild>
                  
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Configure Image Processing</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Operation</Label>
                      <Select value={config.operation} onValueChange={value => updateConfig('operation', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="resize">Resize</SelectItem>
                          <SelectItem value="crop">Crop</SelectItem>
                          <SelectItem value="convert">Convert Format</SelectItem>
                          <SelectItem value="optimize">Optimize</SelectItem>
                          <SelectItem value="watermark">Add Watermark</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>Source Image URL</Label>
                      <Input value={config.url || ''} onChange={e => updateConfig('url', e.target.value)} placeholder="https://example.com/image.jpg" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Width</Label>
                        <Input type="number" value={config.width || 300} onChange={e => updateConfig('width', parseInt(e.target.value))} />
                      </div>
                      <div>
                        <Label>Height</Label>
                        <Input type="number" value={config.height || 300} onChange={e => updateConfig('height', parseInt(e.target.value))} />
                      </div>
                    </div>
                    
                    <div>
                      <Label>Output Format</Label>
                      <Select value={config.format} onValueChange={value => updateConfig('format', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="png">PNG</SelectItem>
                          <SelectItem value="jpg">JPG</SelectItem>
                          <SelectItem value="webp">WebP</SelectItem>
                          <SelectItem value="gif">GIF</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Quality (1-100)</Label>
                      <Input type="number" value={config.quality || 90} onChange={e => updateConfig('quality', parseInt(e.target.value))} min="1" max="100" />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-1">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              {config.operation || 'resize'}: {config.width || 300}×{config.height || 300}
            </div>
            <div className="text-xs text-muted-foreground">
              Format: {config.format?.toUpperCase() || 'PNG'}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {config.url || 'No image URL configured'}
            </div>
          </div>
        </CardContent>
        
        <Handle type="target" position={Position.Left} className="w-3 h-3 bg-warning border-2 border-background" />
        <Handle type="source" position={Position.Right} className="w-3 h-3 bg-warning border-2 border-background" />
        
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
          nodeName={data.label || 'Image Task'}
        />
      </Card>
    </>;
});
ImageTaskNode.displayName = 'ImageTaskNode';
export default ImageTaskNode;