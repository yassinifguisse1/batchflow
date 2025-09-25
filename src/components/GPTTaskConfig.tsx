import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Settings, Sparkles, Brain, Zap, Target, Thermometer, Hash, MessageSquare, Eye, EyeOff } from 'lucide-react';
import ParameterSuggestions from './workflow/ParameterSuggestions';

interface GPTTaskConfigProps {
  nodeId: string;
  payload: any;
  onPayloadChange: (key: string, value: any) => void;
}

const GPTTaskConfig: React.FC<GPTTaskConfigProps> = ({ nodeId, payload, onPayloadChange }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-6">
      {/* Basic Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Model Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1">
              Model <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={payload.model || 'gpt-4o-mini'} 
              onValueChange={(value) => onPayloadChange('model', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4.1-2025-04-14">GPT-4.1 (Latest)</SelectItem>
                <SelectItem value="o4-mini-2025-04-16">o4 Mini</SelectItem>
                <SelectItem value="o3-2025-04-16">o3 (Reasoning)</SelectItem>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                <SelectItem value="gpt-4.1-mini-2025-04-14">GPT-4.1 Mini</SelectItem>
                <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                <SelectItem value="gpt-4">GPT-4</SelectItem>
                <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1">
              System Message
            </Label>
            <ParameterSuggestions
              nodeId={nodeId}
              value={payload.systemMessage || ''}
              onChange={(value) => onPayloadChange('systemMessage', value)}
              placeholder="You are a helpful assistant..."
              className="min-h-[72px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1">
              Prompt <span className="text-red-500">*</span>
            </Label>
            <ParameterSuggestions
              nodeId={nodeId}
              value={payload.prompt || ''}
              onChange={(value) => onPayloadChange('prompt', value)}
              placeholder="Enter your prompt..."
              className="min-h-[96px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              Advanced Settings
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2"
            >
              {showAdvanced ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showAdvanced ? 'Hide' : 'Show'}
            </Button>
          </CardTitle>
        </CardHeader>
        
        {showAdvanced && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <Hash className="h-4 w-4" />
                  Max Tokens
                </Label>
                <Input
                  type="number"
                  value={payload.max_tokens || 150}
                  onChange={(e) => onPayloadChange('max_tokens', parseInt(e.target.value) || 150)}
                  min="1"
                  max="4096"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  Top P
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  value={payload.top_p || 1}
                  onChange={(e) => onPayloadChange('top_p', parseFloat(e.target.value) || 1)}
                  min="0"
                  max="1"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Thermometer className="h-4 w-4" />
                Temperature: {payload.temperature || 0.7}
              </Label>
              <Slider
                value={[payload.temperature || 0.7]}
                onValueChange={(value) => onPayloadChange('temperature', value[0])}
                max={2}
                min={0}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>More focused</span>
                <span>More creative</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Stream Response</Label>
                  <p className="text-xs text-muted-foreground">Receive response in real-time chunks</p>
                </div>
                <Switch 
                  checked={payload.stream || false}
                  onCheckedChange={(checked) => onPayloadChange('stream', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">JSON Mode</Label>
                  <p className="text-xs text-muted-foreground">Force response to be valid JSON</p>
                </div>
                <Switch 
                  checked={payload.response_format?.type === 'json_object'}
                  onCheckedChange={(checked) => 
                    onPayloadChange('response_format', checked ? { type: 'json_object' } : { type: 'text' })
                  }
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Usage Preview */}
      <Card className="border-muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Estimated Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Estimated tokens:</span>
            <Badge variant="outline">
              ~{Math.max(50, (payload.prompt?.length || 0) / 4)} tokens
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GPTTaskConfig;
