import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  MoreHorizontal, 
  Webhook, 
  Plus, 
  Key, 
  HelpCircle, 
  X,
  Edit,
  Trash2,
  Copy,
  RefreshCcw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface WebhookData {
  id: string;
  name: string;
  url: string;
  method: string;
  apiKeys: Array<{
    id: string;
    name: string;
    key: string;
    header: string;
  }>;
}

interface WebhookConfigProps {
  webhook?: WebhookData;
  onSave: (webhook: WebhookData) => void;
  onCancel: () => void;
}

const WebhookConfig: React.FC<WebhookConfigProps> = ({ webhook, onSave, onCancel }) => {
  const [selectedHook, setSelectedHook] = useState(webhook?.id || '');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [webhookOptions, setWebhookOptions] = useState<Array<{ id: string; name: string; url: string; url_path: string; }>>([]);
  const [loading, setLoading] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    method: 'POST',
    apiKeys: [] as Array<{ id: string; name: string; key: string; header: string; }>
  });
  const [newApiKey, setNewApiKey] = useState({ name: '', key: '', header: 'x-make-apikey' });
  const [showApiKeyForm, setShowApiKeyForm] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [listeningWebhookId, setListeningWebhookId] = useState<string | null>(null);
  const [determinedStructure, setDeterminedStructure] = useState<unknown>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch webhooks from database
  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      console.log('Fetching webhooks from database...');
      
      // First check if there are any webhooks at all
      const { data: allWebhooks, error: allError } = await supabase
        .from('webhooks')
        .select('id, name, url_path, user_id');
      
      console.log('All webhooks in database:', allWebhooks);
      
      // Then get user's webhooks only
      const { data, error } = await supabase
        .from('webhooks')
        .select('id, name, url_path')
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching webhooks:', error);
        throw error;
      }

      console.log('Fetched webhooks data:', data);

      const formattedWebhooks = (data || []).map(webhook => ({
        id: webhook.id,
        name: webhook.name,
        url: `${import.meta.env.SUPABASE_URL}/functions/v1/webhook-handler/${webhook.url_path}`,
        url_path: webhook.url_path
      }));

      console.log('Formatted webhooks:', formattedWebhooks);
      setWebhookOptions(formattedWebhooks);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      toast({
        title: "Error",
        description: "Failed to load webhooks.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWebhook = async () => {
    if (!newWebhook.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a webhook name.",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to create webhooks.",
        variant: "destructive"
      });
      return;
    }

    try {
      const urlPath = Math.random().toString(36).substr(2, 9);
      
      const { data, error } = await supabase
        .from('webhooks')
        .insert({
          name: newWebhook.name,
          url_path: urlPath,
          api_keys: newWebhook.apiKeys,
          status: 'active',
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      const webhook: WebhookData = {
        id: data.id,
        name: data.name,
        // check this after
        url: `${window.location.origin}/webhook/${data.url_path}`,
        method: newWebhook.method,
        apiKeys: newWebhook.apiKeys
      };

      onSave(webhook);
      setShowCreateDialog(false);
      setNewWebhook({ name: '', url: '', method: 'POST', apiKeys: [] });
      setNewApiKey({ name: '', key: '', header: 'x-make-apikey' });
      setShowApiKeyForm(false);
      
      // Refresh the webhook list
      fetchWebhooks();

      toast({
        title: "Webhook created",
        description: `"${webhook.name}" has been created successfully.`
      });
    } catch (error) {
      console.error('Error creating webhook:', error);
      toast({
        title: "Error",
        description: "Failed to create webhook.",
        variant: "destructive"
      });
    }
  };

  const handleAddApiKey = () => {
    if (!newApiKey.name.trim() || !newApiKey.key.trim()) {
      toast({
        title: "API key details required",
        description: "Please enter both name and key.",
        variant: "destructive"
      });
      return;
    }

    const apiKey = {
      id: `key-${Date.now()}`,
      name: newApiKey.name,
      key: newApiKey.key,
      header: newApiKey.header
    };

    setNewWebhook(prev => ({
      ...prev,
      apiKeys: [...prev.apiKeys, apiKey]
    }));

    setNewApiKey({ name: '', key: '', header: 'x-make-apikey' });
    setShowApiKeyForm(false);

    toast({
      title: "API key added",
      description: "The API key has been added to the webhook."
    });
  };

  const removeApiKey = (keyId: string) => {
    setNewWebhook(prev => ({
      ...prev,
      apiKeys: prev.apiKeys.filter(key => key.id !== keyId)
    }));
  };

  const copyUrlToClipboard = async () => {
    const selectedWebhook = webhookOptions.find(w => w.id === selectedHook);
    if (selectedWebhook) {
      try {
        await navigator.clipboard.writeText(selectedWebhook.url);
        toast({
          title: "URL copied",
          description: "Webhook URL has been copied to clipboard."
        });
      } catch (error) {
        toast({
          title: "Copy failed",
          description: "Failed to copy URL to clipboard.",
          variant: "destructive"
        });
      }
    }
  };

  const redetermineDataStructure = async () => {
    const selectedWebhook = webhookOptions.find(w => w.id === selectedHook);
    if (!selectedWebhook) {
      toast({
        title: "No webhook selected",
        description: "Please select a webhook first.",
        variant: "destructive"
      });
      return;
    }

    console.log('🔄 Starting data structure determination for webhook:', selectedWebhook.name, 'ID:', selectedHook);
    setIsListening(true);
    setListeningWebhookId(selectedHook);
    setDeterminedStructure(null);

    toast({
      title: "Listening for data",
      description: "Send a webhook request now. The system will analyze the data structure automatically.",
    });

    // Start listening for webhook data (polling for new requests)
    startListeningForData(selectedHook);
  };

  const stopListening = () => {
    setIsListening(false);
    setListeningWebhookId(null);
    
    toast({
      title: "Stopped listening",
      description: "No longer listening for webhook data.",
    });
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
          setListeningWebhookId(null);
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
        stopListening();
      }
    }, 300000);
  };

  const analyzeDataStructure = (data: unknown): unknown => {
    if (!data || typeof data !== 'object') return null;
    
    const analyzeValue = (value: unknown, path: string = ''): unknown => {
      if (Array.isArray(value)) {
        return {
          type: 'array',
          items: value.length > 0 ? analyzeValue(value[0], `${path}[0]`) : 'unknown',
          description: `Array of ${value.length} items`
        };
      } else if (typeof value === 'object' && value !== null) {
        const properties: unknown = {};
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
    <Card className="w-full">
      <CardHeader className="bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            <CardTitle>Webhooks</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
              <HelpCircle className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel} className="text-white hover:bg-white/20">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Webhook className="h-4 w-4 text-muted-foreground" />
            <Label className="font-medium">Webhook *</Label>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Select value={selectedHook} onValueChange={setSelectedHook}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a hook" />
                </SelectTrigger>
                <SelectContent className="bg-card border border-border shadow-lg z-50">
                  {webhookOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              disabled={!selectedHook}
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader className="bg-gradient-to-r from-pink-500 to-pink-600 text-white -m-6 mb-0 p-6 rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <DialogTitle className="flex items-center gap-2">
                      Create a webhook
                    </DialogTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                        <HelpCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </DialogHeader>
                
                <div className="space-y-6 pt-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Webhook className="h-4 w-4 text-muted-foreground" />
                      <Label className="font-medium">Webhook name *</Label>
                    </div>
                    <Input
                      placeholder="My gateway-webhook webhook"
                      value={newWebhook.name}
                      onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                    />
                    <p className="text-xs text-amber-600">
                      Must be between 1 and 128 characters long.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <Label className="font-medium">API Key authentication</Label>
                    </div>

                    {newWebhook.apiKeys.length > 0 && (
                      <div className="space-y-2">
                        {newWebhook.apiKeys.map((apiKey) => (
                          <div key={apiKey.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div>
                              <div className="font-medium text-sm">{apiKey.name}</div>
                              <div className="text-xs text-muted-foreground">{apiKey.header}</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeApiKey(apiKey.id)}
                              className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {showApiKeyForm ? (
                      <div className="space-y-3 p-4 border border-border rounded-lg">
                        <div className="space-y-2">
                          <Label className="text-sm">API Key Name</Label>
                          <Input
                            placeholder="My API Key"
                            value={newApiKey.name}
                            onChange={(e) => setNewApiKey(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">API Key Value</Label>
                          <Input
                            type="password"
                            placeholder="Enter API key"
                            value={newApiKey.key}
                            onChange={(e) => setNewApiKey(prev => ({ ...prev, key: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Header Name</Label>
                          <Input
                            placeholder="x-make-apikey"
                            value={newApiKey.header}
                            onChange={(e) => setNewApiKey(prev => ({ ...prev, header: e.target.value }))}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleAddApiKey} size="sm" className="flex-1">
                            Add Key
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setShowApiKeyForm(false)} 
                            size="sm"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => setShowApiKeyForm(true)}
                        className="flex items-center gap-2 text-primary hover:text-primary-foreground"
                      >
                        <Plus className="h-4 w-4" />
                        Add API key
                      </Button>
                    )}

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold mt-0.5">
                          i
                        </div>
                        <div className="text-sm">
                          <div className="font-medium text-blue-800">
                            Send the API key using the <span className="text-pink-600">x-make-apikey</span> HTTP header.
                          </div>
                          <div className="text-blue-700 mt-1">
                            Add one or more API keys to enable authentication. If any key matches, access is granted.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      id="advanced-settings"
                      checked={showAdvanced}
                      onCheckedChange={setShowAdvanced}
                    />
                    <Label htmlFor="advanced-settings" className="text-sm">
                      Show advanced settings
                    </Label>
                  </div>

                  {showAdvanced && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Webhook URL</Label>
                        <Input
                          value={`${window.location.origin}/webhook/${newWebhook.name.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).substr(2, 6)}`}
                          readOnly
                          className="bg-muted"
                          placeholder="https://your-webhook-url.com"
                        />
                      </div>
                    </>
                  )}

                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateDialog(false)}
                    >
                      Close
                    </Button>
                    <Button
                      onClick={handleCreateWebhook}
                      disabled={!newWebhook.name.trim()}
                      className="bg-primary hover:bg-primary/90"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {selectedHook && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <span className="text-white text-xs">🌐</span>
                </div>
                <span className="text-blue-600 font-medium">
                  {webhookOptions.find(w => w.id === selectedHook)?.url}
                </span>
              </div>
              
              {isListening && listeningWebhookId === selectedHook ? (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
                  <div className="text-sm text-orange-800">
                    <div className="font-medium">Make is now listening for the data and will determine the data structure from the incoming data automatically.</div>
                    <div className="mt-2">
                      To initiate this, please send your data sample to the webhook address displayed above.
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={stopListening}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Stop
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyUrlToClipboard}
                      className="bg-blue-600 text-white hover:bg-blue-700 border-blue-600"
                    >
                      Copy address to clipboard
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={redetermineDataStructure}
                    className="bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    disabled={loading || isListening}
                  >
                    <RefreshCcw className={`h-4 w-4 mr-2 ${isListening ? 'animate-spin' : ''}`} />
                    {isListening ? 'Listening for data...' : 'Redetermine data structure'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyUrlToClipboard}
                    className="bg-blue-600 text-white hover:bg-blue-700 border-blue-600"
                  >
                    Copy address to clipboard
                  </Button>
                </div>
              )}

              {determinedStructure && !isListening && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-sm">
                    <div className="font-medium text-green-800 mb-2">Data structure determined!</div>
                    <div className="text-green-700 text-xs">
                      The webhook data structure has been analyzed and is now available in parameter suggestions.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            For more information on how to create a webhook in Webhooks, see the{' '}
            <span className="text-primary hover:underline cursor-pointer">online Help</span>.
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="show-advanced"
            checked={showAdvanced}
            onCheckedChange={setShowAdvanced}
          />
          <Label htmlFor="show-advanced" className="text-sm">
            Show advanced settings
          </Label>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={() => {
              const selectedWebhook = webhookOptions.find(w => w.id === selectedHook);
              if (selectedWebhook) {
                onSave({
                  id: selectedWebhook.id,
                  name: selectedWebhook.name,
                  url: selectedWebhook.url,
                  method: 'POST',
                  apiKeys: []
                });
              }
            }}
            disabled={!selectedHook}
            className="bg-primary hover:bg-primary/90"
          >
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WebhookConfig;