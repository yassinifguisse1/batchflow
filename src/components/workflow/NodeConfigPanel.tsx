
import React, { useState, useEffect } from 'react';
import { Node } from '@xyflow/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, RefreshCw } from 'lucide-react';
import ParameterSuggestions from './ParameterSuggestions';
import CreateWebhookDialog from '../webhook/CreateWebhookDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface NodeConfigPanelProps {
  node: Node;
  onUpdate: (updates: any) => void;
}

interface NodeConfig {
  [key: string]: any;
  model?: string;
  systemMessage?: string;
  prompt?: string;
  max_tokens?: number;
  temperature?: number;
  method?: string;
  url?: string;
  headers?: string;
  body?: string;
  followRedirects?: boolean;
  conditionType?: string;
  checkValue?: string;
  compareValue?: string;
  duration?: number;
  unit?: string;
}

interface NodeData {
  label?: string;
  config?: NodeConfig;
  [key: string]: any;
}

interface Webhook {
  id: string;
  name: string;
  url_path: string;
}

const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({ node, onUpdate }) => {
  const nodeData = node.data as NodeData;
  const [config, setConfig] = useState<NodeConfig>(nodeData.config || {});
  const [showCreateWebhookDialog, setShowCreateWebhookDialog] = useState(false);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [determinedStructure, setDeterminedStructure] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    const nodeData = node.data as NodeData;
    setConfig(nodeData.config || {});
  }, [node]);

  useEffect(() => {
    if (node.type === 'trigger') {
      fetchWebhooks();
    }
  }, [node.type]);

  const fetchWebhooks = async () => {
    setLoadingWebhooks(true);
    try {
      const { data, error } = await supabase
        .from('webhooks')
        .select('id, name, url_path')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setWebhooks(data || []);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      setWebhooks([]);
    } finally {
      setLoadingWebhooks(false);
    }
  };

  const updateConfig = (key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onUpdate({ config: newConfig });
  };

  const renderConfigFields = () => {
    switch (node.type) {
      case 'trigger':
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Webhook *</Label>
              <div className="flex gap-2">
                <Select value={config.selectedHook || ''} onValueChange={(value) => updateConfig('selectedHook', value)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={loadingWebhooks ? "Loading..." : webhooks.length > 0 ? "Choose a hook" : "No webhooks available"} />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    {webhooks.map((webhook) => (
                      <SelectItem key={webhook.id} value={webhook.id}>
                        {webhook.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm">Edit</Button>
                <Button 
                  size="sm" 
                  className="bg-primary hover:bg-primary/90"
                  onClick={() => setShowCreateWebhookDialog(true)}
                >
                  Add
                </Button>
              </div>
              
              {webhookUrl && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input 
                      value={webhookUrl} 
                      readOnly 
                      className="text-xs bg-muted"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={copyToClipboard}
                      className="shrink-0"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full"
                    onClick={redetermineDataStructure}
                    disabled={isListening || !config.selectedHook}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isListening ? 'animate-spin' : ''}`} />
                    {isListening ? 'Listening for data...' : 'Redetermine data structure'}
                  </Button>
                  
                  {determinedStructure && !isListening && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                      <div className="text-sm">
                        <div className="font-medium text-green-800 mb-1">Data structure determined!</div>
                        <div className="text-green-700 text-xs">
                          The webhook data structure has been analyzed and is now available in parameter suggestions.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Show advanced settings</Label>
              <Switch
                checked={config.showAdvancedSettings || false}
                onCheckedChange={(checked) => updateConfig('showAdvancedSettings', checked)}
              />
            </div>

            {config.showAdvancedSettings && (
              <div className="space-y-4 border-t pt-4">
                <div>
                  <Label className="text-sm font-medium">Webhook URL</Label>
                  <ParameterSuggestions
                    nodeId={node.id}
                    value={config.webhookUrl || ''}
                    onChange={(value) => updateConfig('webhookUrl', value)}
                    placeholder="https://your-webhook-url.com"
                  />
                </div>
              </div>
            )}
          </div>
        );
        
      case 'gptTask':
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Model</Label>
              <Select value={config.model || 'gpt-4o-mini'} onValueChange={(value) => updateConfig('model', value)}>
                <SelectTrigger>
                  <SelectValue />
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
            
            <div>
              <Label className="text-sm font-medium">System Message</Label>
              <ParameterSuggestions
                nodeId={node.id}
                value={config.systemMessage || ''}
                onChange={(value) => updateConfig('systemMessage', value)}
                placeholder="You are a helpful assistant..."
                className="min-h-[72px]"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Prompt</Label>
              <ParameterSuggestions
                nodeId={node.id}
                value={config.prompt || ''}
                onChange={(value) => updateConfig('prompt', value)}
                placeholder="Enter your prompt..."
                className="min-h-[96px]"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Max Tokens</Label>
              <Input
                type="number"
                value={config.max_tokens || 1000}
                onChange={(e) => updateConfig('max_tokens', parseInt(e.target.value))}
                min="1"
                max="4000"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Temperature: {config.temperature || 0.7}</Label>
              <Slider
                value={[config.temperature || 0.7]}
                onValueChange={([value]) => updateConfig('temperature', value)}
                max={1}
                min={0}
                step={0.1}
                className="w-full mt-2"
              />
            </div>
          </div>
        );

      case 'httpTask':
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Method</Label>
              <Select value={config.method || 'GET'} onValueChange={(value) => updateConfig('method', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">URL</Label>
              <ParameterSuggestions
                nodeId={node.id}
                value={config.url || ''}
                onChange={(value) => updateConfig('url', value)}
                placeholder="https://api.example.com/endpoint"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Headers (JSON)</Label>
              <ParameterSuggestions
                nodeId={node.id}
                value={config.headers || '{}'}
                onChange={(value) => updateConfig('headers', value)}
                placeholder='{"Content-Type": "application/json"}'
                className="min-h-[72px]"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Body (JSON)</Label>
              <ParameterSuggestions
                nodeId={node.id}
                value={config.body || ''}
                onChange={(value) => updateConfig('body', value)}
                placeholder='{"key": "value"}'
                className="min-h-[96px]"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Follow Redirects</Label>
              <Switch
                checked={config.followRedirects || false}
                onCheckedChange={(checked) => updateConfig('followRedirects', checked)}
              />
            </div>
          </div>
        );

      case 'conditional':
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Condition Type</Label>
              <Select value={config.conditionType || 'equals'} onValueChange={(value) => updateConfig('conditionType', value)}>
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
              <Label className="text-sm font-medium">Value to Check</Label>
              <ParameterSuggestions
                nodeId={node.id}
                value={config.checkValue || ''}
                onChange={(value) => updateConfig('checkValue', value)}
                placeholder="{{data.field}}"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Compare Against</Label>
              <ParameterSuggestions
                nodeId={node.id}
                value={config.compareValue || ''}
                onChange={(value) => updateConfig('compareValue', value)}
                placeholder="Expected value"
              />
            </div>
          </div>
        );

      case 'delay':
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Duration</Label>
              <Input
                type="number"
                value={config.duration || 1000}
                onChange={(e) => updateConfig('duration', parseInt(e.target.value))}
                min="100"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Unit</Label>
              <Select value={config.unit || 'ms'} onValueChange={(value) => updateConfig('unit', value)}>
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
        );

      case 'router':
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Execution Mode</Label>
              <Select 
                value={config.executionMode || 'parallel'} 
                onValueChange={(value) => updateConfig('executionMode', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parallel">Parallel - All at once</SelectItem>
                  <SelectItem value="sequential">Sequential - One by one</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.executionMode === 'parallel' && (
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Wait for all branches</Label>
                <Switch
                  checked={config.waitForAll || false}
                  onCheckedChange={(checked) => updateConfig('waitForAll', checked)}
                />
              </div>
            )}
          </div>
        );

      case 'arrayAggregator':
        return (
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
        );

      case 'webhookResponse':
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium flex items-center gap-1">
                Status <span className="text-red-500">*</span>
              </Label>
              <Input 
                type="number" 
                min="100" 
                max="599" 
                value={config.statusCode || 200} 
                onChange={(e) => updateConfig('statusCode', parseInt(e.target.value) || 200)} 
                placeholder="200" 
                className="h-10" 
              />
              <p className="text-xs text-muted-foreground">
                Must be higher than or equal to 100.
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium">Body</Label>
              <ParameterSuggestions
                nodeId={node.id}
                value={config.responseBody || ''}
                onChange={(value) => updateConfig('responseBody', value)}
                placeholder=""
                className="min-h-[80px]"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">Show advanced settings</Label>
              <Switch 
                checked={config.showAdvancedSettings || false} 
                onCheckedChange={(checked) => updateConfig('showAdvancedSettings', checked)} 
              />
            </div>

            {config.showAdvancedSettings && (
              <>
                <Separator />
                <div>
                  <Label className="text-sm font-medium">Custom Headers</Label>
                  <Textarea 
                    value={JSON.stringify(config.headers || {}, null, 2)} 
                    onChange={(e) => {
                      try {
                        const headers = JSON.parse(e.target.value);
                        updateConfig('headers', headers);
                      } catch {
                        // Invalid JSON, don't update
                      }
                    }} 
                    placeholder='{"Content-Type": "application/json"}' 
                    className="min-h-[60px] resize-none font-mono text-xs" 
                  />
                </div>
              </>
            )}
          </div>
        );

      default:
        return (
          <div className="text-center py-8 text-muted-foreground">
            <p>No configuration options available for this node type.</p>
          </div>
        );
    }
  };

  const selectedWebhook = webhooks.find(w => w.id === config.selectedHook);
  const webhookUrl = selectedWebhook ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-handler/${selectedWebhook.url_path}` : '';

  const copyToClipboard = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      toast({
        title: "URL copied",
        description: "Webhook URL has been copied to clipboard."
      });
    }
  };

  const redetermineDataStructure = async () => {
    if (!config.selectedHook) {
      toast({
        title: "No webhook selected",
        description: "Please select a webhook first.",
        variant: "destructive"
      });
      return;
    }

    console.log('🔄 Starting data structure determination for webhook ID:', config.selectedHook);
    setIsListening(true);
    setDeterminedStructure(null);

    toast({
      title: "Listening for data",
      description: "Send a webhook request now. The system will analyze the data structure automatically.",
    });

    // Start listening for webhook data (polling for new requests)
    startListeningForData(config.selectedHook);
  };

  const startListeningForData = async (webhookId: string) => {
    console.log('🎯 Starting to listen for webhook data for ID:', webhookId);
    
    // Store the current timestamp to only look for new requests
    const startTime = new Date().toISOString();
    
    // Poll for new webhook requests every 2 seconds
    const pollInterval = setInterval(async () => {
      try {
        console.log('📡 Polling for webhook requests...');
        const { data: requests, error } = await supabase
          .from('webhook_requests')
          .select('*')
          .eq('webhook_id', webhookId)
          .gte('created_at', startTime)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('❌ Error fetching webhook requests:', error);
          return;
        }

        console.log('📥 Found requests:', requests?.length || 0);

        if (requests && requests.length > 0) {
          const latestRequest = requests[0];
          console.log('🎯 Latest request:', latestRequest);
          console.log('📦 Request body structure:', latestRequest.request_body);
          
          const structure = analyzeDataStructure(latestRequest.request_body);
          console.log('🏗️ Analyzed structure:', structure);
          
          setDeterminedStructure(structure);
          setIsListening(false);
          clearInterval(pollInterval);

          // Store the structure globally for parameter suggestions
          window.webhookStructures = window.webhookStructures || {};
          window.webhookStructures[webhookId] = structure;

          // Trigger a custom event to notify parameter suggestions to update
          window.dispatchEvent(new CustomEvent('webhookStructureUpdated', {
            detail: { webhookId, structure }
          }));

          console.log('✅ Webhook structure stored:', { webhookId, structure });

          toast({
            title: "Data structure determined!",
            description: "Webhook data structure has been analyzed and is now available in parameter suggestions.",
          });
        }
      } catch (error) {
        console.error('❌ Error polling for webhook data:', error);
      }
    }, 2000);

    // Stop listening after 5 minutes
    setTimeout(() => {
      console.log('⏰ Timeout reached, stopping listening');
      clearInterval(pollInterval);
      if (isListening) {
        setIsListening(false);
        toast({
          title: "Listening timeout",
          description: "Stopped listening for webhook data after 5 minutes.",
        });
      }
    }, 300000);
  };

  const analyzeDataStructure = (data: any): any => {
    if (!data || typeof data !== 'object') return null;
    
    const analyzeValue = (value: any, path: string = ''): any => {
      if (Array.isArray(value)) {
        return {
          type: 'array',
          items: value.length > 0 ? analyzeValue(value[0], `${path}[0]`) : 'unknown',
          description: `Array of ${value.length} items`
        };
      } else if (typeof value === 'object' && value !== null) {
        const properties: any = {};
        Object.keys(value).forEach(key => {
          properties[key] = analyzeValue(value[key], path ? `${path}.${key}` : key);
        });
        return {
          type: 'object',
          properties: properties,
          description: `Object with ${Object.keys(value).length} properties`
        };
      } else {
        return {
          type: typeof value,
          value: value,
          description: `${typeof value} value: ${String(value)}`
        };
      }
    };

    return analyzeValue(data);
  };

  return (
    <div className="space-y-6">
      
      {/* Configuration Fields */}
      <div className="space-y-4">
        <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Configuration
        </div>
        {renderConfigFields()}
      </div>

      {/* Create Webhook Dialog */}
      <CreateWebhookDialog
        open={showCreateWebhookDialog}
        onOpenChange={setShowCreateWebhookDialog}
        onSave={(webhookData) => {
          console.log('Webhook created:', webhookData);
          // Handle webhook creation logic here
        }}
      />
    </div>
  );
};

export default NodeConfigPanel;
