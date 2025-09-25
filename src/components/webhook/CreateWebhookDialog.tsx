import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Info, HelpCircle, X, MoreHorizontal, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import AuthDialog from '@/components/auth/AuthDialog';

interface CreateWebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (webhookData: any) => void;
}

const CreateWebhookDialog: React.FC<CreateWebhookDialogProps> = ({
  open,
  onOpenChange,
  onSave
}) => {
  const [webhookName, setWebhookName] = useState('My gateway-webhook webhook');
  const [apiKeys, setApiKeys] = useState([{ id: 1, name: 'API key 1', key: '', header: 'x-make-apikey' }]);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  const addApiKey = () => {
    const newKey = {
      id: apiKeys.length + 1,
      name: `API key ${apiKeys.length + 1}`,
      key: '',
      header: 'x-make-apikey'
    };
    setApiKeys([...apiKeys, newKey]);
  };

  const removeApiKey = (id: number) => {
    setApiKeys(apiKeys.filter(key => key.id !== id));
  };

  const handleSave = async () => {
    if (!webhookName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a webhook name.",
        variant: "destructive"
      });
      return;
    }

    if (webhookName.length > 128) {
      toast({
        title: "Name too long",
        description: "Webhook name must be 128 characters or less.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Check if user is authenticated
      if (!isAuthenticated || !user) {
        setShowAuthDialog(true);
        setIsLoading(false);
        return;
      }

      // Generate a unique URL path for the webhook
      const urlPath = webhookName.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .trim()
        + '-' + Math.random().toString(36).substring(2, 8);

      // Prepare API keys data
      const apiKeysData = apiKeys
        .filter(key => key.key.trim()) // Only include keys with values
        .map(key => ({
          id: key.id.toString(),
          name: key.name,
          key: key.key,
          header: key.header
        }));

      // Create webhook in database
      const { data: webhook, error: webhookError } = await supabase
        .from('webhooks')
        .insert({
          name: webhookName,
          url_path: urlPath,
          user_id: user.id,
          api_keys: apiKeysData,
          workflow_data: {},
          status: 'active'
        })
        .select()
        .single();

      if (webhookError) {
        throw webhookError;
      }

      // Generate the full webhook URL
      const webhookUrl = `${process.env.VITE_SUPABASE_URL}/functions/v1/webhook-handler/${urlPath}`;

      toast({
        title: "Webhook created successfully!",
        description: `Your webhook is available at: ${webhookUrl}`,
      });

      // Call the onSave callback with the created webhook data
      if (onSave) {
        onSave({
          id: webhook.id,
          name: webhook.name,
          url: webhookUrl,
          urlPath: webhook.url_path,
          method: 'POST',
          apiKeys: apiKeysData
        });
      }

      // Reset form
      setWebhookName('My gateway-webhook webhook');
      setApiKeys([{ id: 1, name: 'API key 1', key: '', header: 'x-make-apikey' }]);
      onOpenChange(false);

    } catch (error: any) {
      console.error('Error creating webhook:', error);
      toast({
        title: "Error creating webhook",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md p-0 gap-0">
        {/* Header */}
        <DialogHeader className="bg-pink-400 text-white px-4 py-3 rounded-t-lg">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-white font-medium">Create a webhook</DialogTitle>
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              <HelpCircle className="h-4 w-4" />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-white hover:bg-white/20"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Webhook Name */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border border-gray-300 rounded flex items-center justify-center">
                <div className="w-2 h-2 bg-gray-400 rounded-sm"></div>
              </div>
              <Label className="text-sm font-medium">
                Webhook name <span className="text-red-500">*</span>
              </Label>
            </div>
            <Input
              value={webhookName}
              onChange={(e) => setWebhookName(e.target.value)}
              className="w-full"
            />
            <div className="flex items-center gap-1 text-xs text-yellow-600">
              <div className="w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center text-white text-xs">!</div>
              <span>Must be between 1 and 128 characters long.</span>
            </div>
          </div>

          {/* API Key Authentication */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border border-gray-300 rounded flex items-center justify-center">
                <div className="w-2 h-2 bg-gray-400 rounded-sm"></div>
              </div>
              <Label className="text-sm font-medium">API Key authentication</Label>
            </div>

            {/* API Keys Section */}
            <div className="ml-6 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border border-gray-300 rounded flex items-center justify-center">
                  <div className="w-2 h-2 bg-gray-400 rounded-sm"></div>
                </div>
                <Label className="text-sm font-medium">API keys</Label>
              </div>

              {/* API Key Items */}
              <div className="ml-6 space-y-3">
                {apiKeys.map((apiKey) => (
                  <div key={apiKey.id} className="space-y-2 p-3 border border-gray-200 rounded">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{apiKey.name}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0"
                        onClick={() => removeApiKey(apiKey.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Input
                        placeholder="Enter API key value"
                        type="password"
                        value={apiKey.key}
                        onChange={(e) => {
                          setApiKeys(keys => keys.map(k => 
                            k.id === apiKey.id ? { ...k, key: e.target.value } : k
                          ));
                        }}
                      />
                      <Input
                        placeholder="Header name (default: x-make-apikey)"
                        value={apiKey.header}
                        onChange={(e) => {
                          setApiKeys(keys => keys.map(k => 
                            k.id === apiKey.id ? { ...k, header: e.target.value } : k
                          ));
                        }}
                      />
                    </div>
                  </div>
                ))}

                {/* Create a keychain button */}
                <div className="flex items-center gap-2 mt-2">
                  <Button 
                    className="bg-pink-500 hover:bg-pink-600 text-white"
                    size="sm"
                  >
                    <div className="w-4 h-4 mr-2">🔗</div>
                    Create a keychain
                  </Button>
                </div>

                {/* Add API key button */}
                <button 
                  onClick={addApiKey}
                  className="flex items-center gap-2 text-blue-500 text-sm hover:text-blue-600 mt-2"
                >
                  <span className="text-lg">+</span>
                  Add API key
                </button>
              </div>
            </div>
          </div>

          {/* Info Alert */}
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-sm text-blue-700">
              <div className="space-y-1">
                <div>
                  Send the API key using the <code className="bg-gray-200 px-1 rounded text-pink-600">x-make-apikey</code> HTTP header.
                </div>
                <div className="mt-2">
                  Add one or more API keys to enable authentication. If any key matches, access is granted.
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Show advanced settings */}
          <div className="flex items-center justify-between pt-4">
            <Label className="text-sm">Show advanced settings</Label>
            <Switch
              checked={showAdvancedSettings}
              onCheckedChange={setShowAdvancedSettings}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <Button 
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button 
            className="bg-purple-600 hover:bg-purple-700"
            onClick={handleSave}
            disabled={isLoading}
          >
            {isLoading ? "Creating..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    
    <AuthDialog 
      open={showAuthDialog}
      onOpenChange={setShowAuthDialog}
      onAuthenticated={() => setShowAuthDialog(false)}
    />
    </>
  );
};

export default CreateWebhookDialog;