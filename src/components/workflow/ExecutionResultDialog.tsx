import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExecutionResult {
  status?: 'completed' | 'error' | 'running';
  data?: any;
  error?: string;
  statusCode?: number;
  headers?: Record<string, string>;
  executionTime?: number;
  timestamp?: Date | string;
  // GPT-specific fields
  success?: boolean;
  output?: string;
  result?: string; // GPT result field
  gpt_response?: string; // GPT response from edge function
  gpt_model?: string; // GPT model used
  duration?: number;
  model?: string;
  tokens_used?: number;
  usage?: any; // OpenAI usage object
  // HTTP-specific fields
  http_response?: any;
  http_error?: string;
  http_status?: number;
  http_success?: boolean;
  request_url?: string;
  request_method?: string;
  request_body?: any;
  request_headers?: any;
  body?: any; // HTTP response body
  response?: any; // HTTP response field from webhook handler
  statusText?: string; // HTTP status text
  config?: any; // Request configuration
  // Webhook-specific fields
  response_body?: any;
  id?: string;
  webhook_id?: string;
  processing_time_ms?: number;
}

interface ExecutionResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: ExecutionResult | null;
  nodeName: string;
  nodeConfig?: any; // Add node configuration for input display
  isWebhookTrigger?: boolean; // Flag to identify webhook triggers
}

const ExecutionResultDialog: React.FC<ExecutionResultDialogProps> = ({
  open,
  onOpenChange,
  result,
  nodeName,
  nodeConfig,
  isWebhookTrigger = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  if (!result) return null;

  // Determine status - if we have a result but no explicit status, assume completed
  const actualStatus = result.status || (result.result || result.output || result.data ? 'completed' : (result.error ? 'error' : 'completed'));
  
  const getStatusIcon = () => {
    switch (actualStatus) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
  };

  const getStatusBadge = () => {
    switch (actualStatus) {
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'running':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Running</Badge>;
      default:
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>;
    }
  };

  const formatTimestamp = (timestamp?: Date | string) => {
    if (!timestamp) return null;
    try {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      return date.toLocaleString();
    } catch {
      return timestamp.toString();
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    });
  };

  const copyParameterPath = (path: string, nodeName: string) => {
    // Convert node name to match parameter suggestion format
    const normalizedNodeName = getNodeDisplayName();
    const parameterPath = `{{${normalizedNodeName}.${path}}}`;
    navigator.clipboard.writeText(parameterPath).then(() => {
      toast({
        title: "Parameter Copied!",
        description: `${parameterPath} copied to clipboard`,
      });
    });
  };

  // JSON Tree Component with expand/collapse functionality
  const JsonTreeNode: React.FC<{
    data: any;
    nodeName: string;
    path: string;
    level: number;
  }> = ({ data, nodeName, path, level }) => {
    const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels

    if (data === null) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground italic">null</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 opacity-60 hover:opacity-100"
            onClick={() => copyParameterPath(path, nodeName)}
            title={`Copy: {{${getNodeDisplayName()}.${path}}}`}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    if (typeof data === 'string') {
      return (
        <div className="flex items-center gap-2">
          <span className="text-green-600 font-mono">"{data}"</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 opacity-60 hover:opacity-100"
            onClick={() => copyParameterPath(path, nodeName)}
            title={`Copy: {{${getNodeDisplayName()}.${path}}}`}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    if (typeof data === 'number') {
      return (
        <div className="flex items-center gap-2">
          <span className="text-blue-600 font-mono">{data}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 opacity-60 hover:opacity-100"
            onClick={() => copyParameterPath(path, nodeName)}
            title={`Copy: {{${getNodeDisplayName()}.${path}}}`}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    if (typeof data === 'boolean') {
      return (
        <div className="flex items-center gap-2">
          <span className="text-purple-600 font-mono">{data.toString()}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 opacity-60 hover:opacity-100"
            onClick={() => copyParameterPath(path, nodeName)}
            title={`Copy: {{${getNodeDisplayName()}.${path}}}`}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    if (Array.isArray(data)) {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 hover:bg-muted/50"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
            <span className="text-muted-foreground font-mono">
              [{data.length} items]
            </span>
            {path && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 opacity-60 hover:opacity-100"
                onClick={() => copyParameterPath(path, nodeName)}
                title={`Copy: {{${getNodeDisplayName()}.${path}}}`}
              >
                <Copy className="h-3 w-3" />
              </Button>
            )}
          </div>
          {isExpanded && (
            <div className="ml-6 space-y-1 border-l border-muted pl-4">
              {data.map((item, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-muted-foreground text-xs mt-1 font-mono">
                    [{index}]
                  </span>
                  <div className="flex-1">
                    <JsonTreeNode
                      data={item}
                      nodeName={nodeName}
                      path={path ? `${path}[${index}]` : `[${index}]`}
                      level={level + 1}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (typeof data === 'object') {
      const entries = Object.entries(data);
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 hover:bg-muted/50"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
            <span className="text-muted-foreground font-mono">
              {`{${entries.length} properties}`}
            </span>
            {path && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 opacity-60 hover:opacity-100"
                onClick={() => copyParameterPath(path, nodeName)}
                title={`Copy: {{${getNodeDisplayName()}.${path}}}`}
              >
                <Copy className="h-3 w-3" />
              </Button>
            )}
          </div>
          {isExpanded && (
            <div className="ml-6 space-y-1 border-l border-muted pl-4">
              {entries.map(([key, value]) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-blue-800 font-medium text-sm mt-1 font-mono">
                    "{key}":
                  </span>
                  <div className="flex-1">
                    <JsonTreeNode
                      data={value}
                      nodeName={nodeName}
                      path={path ? `${path}.${key}` : key}
                      level={level + 1}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return <span className="font-mono">{String(data)}</span>;
  };

  const renderJsonTree = (jsonString: string, nodeName: string) => {
    try {
      const jsonObj = JSON.parse(jsonString);
      return (
        <JsonTreeNode
          data={jsonObj}
          nodeName={nodeName}
          path=""
          level={0}
        />
      );
    } catch {
      return <pre className="text-xs whitespace-pre-wrap font-mono">{jsonString}</pre>;
    }
  };

  const getNodeDisplayName = () => {
    // Convert node name to match parameter suggestion format (e.g., "GPT Task" -> "GPT 1")
    // This should match the logic in ParameterSuggestions.tsx
    
    // Extract potential node types from the node name
    if (nodeName.toLowerCase().includes('gpt')) {
      const match = nodeName.match(/(\d+)/);
      const number = match ? match[1] : '1';
      return `GPT ${number}`;
    } else if (nodeName.toLowerCase().includes('http')) {
      const match = nodeName.match(/(\d+)/);
      const number = match ? match[1] : '1';
      return `HTTP ${number}`;
    } else if (nodeName.toLowerCase().includes('image')) {
      const match = nodeName.match(/(\d+)/);
      const number = match ? match[1] : '1';
      return `Image ${number}`;
    } else if (nodeName.toLowerCase().includes('trigger')) {
      const match = nodeName.match(/(\d+)/);
      const number = match ? match[1] : '1';
      return `Trigger ${number}`;
    } else {
      // For other node types, try to extract base name and number
      const match = nodeName.match(/^(.+?)\s*(\d+)?$/);
      if (match) {
        const baseName = match[1].trim();
        const number = match[2] || '1';
        return `${baseName} ${number}`;
      }
      return nodeName;
    }
  };

  const getInputData = () => {
    if (nodeConfig) {
      return JSON.stringify(nodeConfig, null, 2);
    }
    return 'No input configuration available';
  };

  const getOutputData = () => {
    // For webhook triggers, show the original HTTP request data first
    if (isWebhookTrigger) {
      console.log('🔍 Full webhook result for debugging:', result);
      
      // The webhook handler stores the HTTP request body directly in various ways
      // Let's check all possible locations where the original request might be stored
      
      // First, let's extract just the prompt/image_size fields that the user sent
      const extractWebhookPayload = (obj: any): any => {
        if (!obj || typeof obj !== 'object') return null;
        
        const payload: any = {};
        const keys = Object.keys(obj);
        
        // Look for prompt and image_size fields with numbers
        for (const key of keys) {
          if (key.match(/^(prompt|image_size)\d+$/)) {
            payload[key] = obj[key];
          }
        }
        
        return Object.keys(payload).length > 0 ? payload : null;
      };
      
      // Strategy 1: Check if the result itself contains the webhook fields
      const directPayload = extractWebhookPayload(result);
      if (directPayload) {
        console.log('🔍 Found webhook payload directly in result:', directPayload);
        return JSON.stringify(directPayload, null, 2);
      }
      
      // Strategy 2: Check request_body field (from webhook_requests table)
      if (result?.request_body) {
        const requestBodyPayload = extractWebhookPayload(result.request_body);
        if (requestBodyPayload) {
          console.log('🔍 Found webhook payload in request_body:', requestBodyPayload);
          return JSON.stringify(requestBodyPayload, null, 2);
        }
        // If no specific payload found but request_body exists, show it
        if (typeof result.request_body === 'object' && Object.keys(result.request_body).length > 0) {
          console.log('🔍 Showing full request_body:', result.request_body);
          return JSON.stringify(result.request_body, null, 2);
        }
      }
      
      // Strategy 3: Deep search in nested structures
      const deepSearchPayload = (obj: any, path = ''): any => {
        if (!obj || typeof obj !== 'object') return null;
        
        // First check if this level has webhook fields
        const levelPayload = extractWebhookPayload(obj);
        if (levelPayload) {
          console.log(`🔍 Found webhook payload at ${path}:`, levelPayload);
          return levelPayload;
        }
        
        // Then recursively check nested objects
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'object' && value !== null) {
            const found = deepSearchPayload(value, path ? `${path}.${key}` : key);
            if (found) return found;
          }
        }
        
        return null;
      };
      
      const foundPayload = deepSearchPayload(result);
      if (foundPayload) {
        return JSON.stringify(foundPayload, null, 2);
      }
      
      // Strategy 4: Show the first object that looks like webhook data
      const findFirstRelevantObject = (obj: any): any => {
        if (!obj || typeof obj !== 'object') return null;
        
        // If this object has multiple keys and looks like data, return it
        const keys = Object.keys(obj);
        if (keys.length > 2 && keys.some(k => typeof obj[k] === 'string')) {
          return obj;
        }
        
        // Otherwise, look in nested objects
        for (const value of Object.values(obj)) {
          if (typeof value === 'object' && value !== null) {
            const found = findFirstRelevantObject(value);
            if (found) return found;
          }
        }
        
        return null;
      };
      
      const relevantObject = findFirstRelevantObject(result);
      if (relevantObject) {
        console.log('🔍 Found relevant webhook object:', relevantObject);
        return JSON.stringify(relevantObject, null, 2);
      }
      
      // Fallback: show the entire result for debugging
      console.log('🔍 No specific webhook payload found, showing full result');
      return JSON.stringify(result, null, 2);
    }
    
    // For HTTP tasks, show the response data
    if (nodeName.toLowerCase().includes('http')) {
      console.log('🌐 HTTP result found:', result);
      
      // First check for body field (this is the actual response content)
      if (result?.body !== undefined && result?.body !== null) {
        // For simple string responses (like image URLs), return them directly
        if (typeof result.body === 'string') {
          console.log('🌐 Found string body response:', result.body);
          return result.body;
        }
        // For object responses, stringify them
        if (typeof result.body === 'object') {
          console.log('🌐 Found object body response:', result.body);
          return JSON.stringify(result.body, null, 2);
        }
        return String(result.body);
      }
      
      // Check for the response field (this is what webhook handler sets)
      if (result?.response !== undefined && result?.response !== null) {
        // For simple string responses (like image URLs), just return them directly
        if (typeof result.response === 'string') {
          console.log('🌐 Found string response:', result.response);
          return result.response;
        }
        try {
          const parsed = typeof result.response === 'string' ? JSON.parse(result.response) : result.response;
          return JSON.stringify(parsed, null, 2);
        } catch {
          return String(result.response);
        }
      }
      
      // If there's an http_response field
      if (result?.http_response) {
        return JSON.stringify(result.http_response, null, 2);
      }
      
      // If no response found but we have a successful status, show a message
      const statusCode = typeof result?.status === 'string' ? parseInt(result.status) : result?.status;
      if (result?.success !== false && statusCode && (statusCode >= 200 && statusCode < 300)) {
        return 'No response body';
      }
      
      // If there's an error, show error details
      if (result?.success === false || result?.http_error) {
        return result?.error || result?.http_error || 'HTTP request failed';
      }
      
      // Fallback: show the full result for debugging
      console.log('🌐 No specific response found, showing full result:', result);
      return JSON.stringify(result, null, 2);
    }
    
    // For GPT tasks, prioritize showing the actual AI response
    if (result?.gpt_response) {
      console.log('🧠 GPT response found:', result.gpt_response);
      return result.gpt_response;
    }
    if (result?.result && typeof result.result === 'string' && nodeName.toLowerCase().includes('gpt')) {
      console.log('🧠 GPT result found:', result.result);
      return result.result;
    }
    
    // For other node types, show the general result data
    if (result?.data) {
      return JSON.stringify(result.data, null, 2);
    }
    
    // Fallback to showing the entire result
    console.log('🔍 Full result object:', result);
    return JSON.stringify(result, null, 2);
  };

  const getLogData = () => {
    const logData: any = {};
    
    // For HTTP tasks, include HTTP-specific details
    if (nodeName.toLowerCase().includes('http')) {
      if (result?.status) logData.httpStatus = result.status;
      if (result?.statusText) logData.statusText = result.statusText;
      if (result?.headers) logData.responseHeaders = result.headers;
      if (result?.config?.url) logData.requestUrl = result.config.url;
      if (result?.config?.method) logData.requestMethod = result.config.method;
      if (result?.config?.headers) logData.requestHeaders = result.config.headers;
    }
    
    if (result?.usage) logData.usage = result.usage;
    if (result?.model || result?.gpt_model) logData.model = result.model || result.gpt_model;
    if (result?.duration || result?.executionTime) logData.executionTime = result.duration || result.executionTime;
    if (result?.statusCode) logData.statusCode = result.statusCode;
    if (result?.headers && !logData.responseHeaders) logData.headers = result.headers;
    if (result?.timestamp) logData.timestamp = result.timestamp;
    
    return Object.keys(logData).length > 0 ? JSON.stringify(logData, null, 2) : 'No log data available';
  };

  const getErrorData = () => {
    // For HTTP tasks, show detailed error information
    if (nodeName.toLowerCase().includes('http')) {
      if (result?.error || result?.http_error) {
        const errorInfo: any = {};
        if (result.error) errorInfo.error = result.error;
        if (result.http_error) errorInfo.httpError = result.http_error;
        if (result.status) errorInfo.statusCode = result.status;
        if (result.statusText) errorInfo.statusText = result.statusText;
        if (result.config?.url) errorInfo.requestUrl = result.config.url;
        
        return JSON.stringify(errorInfo, null, 2);
      }
    }
    
    if (result?.error) {
      return typeof result.error === 'string' ? result.error : JSON.stringify(result.error, null, 2);
    }
    return actualStatus === 'error' ? 'An error occurred but no details are available' : 'No errors';
  };

  const filterContent = (content: string) => {
    if (!searchTerm) return content;
    // Simple highlighting - in a real implementation you might want more sophisticated highlighting
    return content;
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        // Only allow closing via explicit X button click, not by clicking outside
        if (!newOpen) {
          onOpenChange(false);
        } else {
          onOpenChange(newOpen);
        }
      }}
    >
      <DialogContent 
        className="max-w-2xl max-h-[80vh] z-[200]"
        onPointerDownOutside={(e) => {
          // Prevent dialog from closing when clicking outside
          e.preventDefault();
          e.stopPropagation();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenChange(false);
        }}
        onInteractOutside={(e) => {
          // Prevent dialog from closing when clicking outside
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon()}
            {nodeName} - Execution Results
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Status and basic info */}
          <div className="flex items-center justify-between">
            {getStatusBadge()}
            {result.timestamp && (
              <span className="text-sm text-muted-foreground">
                {formatTimestamp(result.timestamp)}
              </span>
            )}
          </div>

          {/* Execution Details Summary */}
          {(result.model || result.gpt_model || result.duration || result.tokens_used || result.executionTime || result.usage) && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Execution Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {(result.model || result.gpt_model) && (
                  <div>
                    <span className="text-muted-foreground">Model:</span>
                    <Badge variant="outline" className="ml-2">{result.model || result.gpt_model}</Badge>
                  </div>
                )}
                {(result.duration || result.executionTime) && (
                  <div>
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="ml-2">{result.duration || result.executionTime}s</span>
                  </div>
                )}
                {(result.tokens_used || result.usage?.total_tokens) && (
                  <div>
                    <span className="text-muted-foreground">Tokens Used:</span>
                    <span className="ml-2">{result.tokens_used || result.usage?.total_tokens}</span>
                  </div>
                )}
                {result.usage?.prompt_tokens && (
                  <div>
                    <span className="text-muted-foreground">Prompt Tokens:</span>
                    <span className="ml-2">{result.usage.prompt_tokens}</span>
                  </div>
                )}
                {result.usage?.completion_tokens && (
                  <div>
                    <span className="text-muted-foreground">Response Tokens:</span>
                    <span className="ml-2">{result.usage.completion_tokens}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Search Box */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search in messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          {/* Tabbed Interface */}
          <Tabs defaultValue={isWebhookTrigger ? "output" : "input"} className="w-full">
            <TabsList className={`grid w-full ${isWebhookTrigger ? 'grid-cols-3' : 'grid-cols-4'}`} onClick={(e) => e.stopPropagation()}>
              {!isWebhookTrigger && <TabsTrigger value="input" onClick={(e) => e.stopPropagation()}>Input</TabsTrigger>}
              <TabsTrigger value="output" onClick={(e) => e.stopPropagation()}>Output</TabsTrigger>
              <TabsTrigger value="log" onClick={(e) => e.stopPropagation()}>Log</TabsTrigger>
              <TabsTrigger value="error" onClick={(e) => e.stopPropagation()}>Error</TabsTrigger>
            </TabsList>

            <TabsContent value="input" className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Configuration</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(getInputData(), 'Input configuration')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="h-64 border rounded p-3 bg-muted/50">
                <pre className="text-xs whitespace-pre-wrap font-mono">
                  {filterContent(getInputData())}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="output" className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {isWebhookTrigger ? "Received Data" : "Result"}
                </span>
                <div className="flex gap-1">
                  <span className="text-xs text-muted-foreground">Click any parameter to copy</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(getOutputData(), isWebhookTrigger ? 'Received data' : 'Output result')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-64 border rounded p-3 bg-muted/50">
                <div className="text-xs">
                  {renderJsonTree(getOutputData(), getNodeDisplayName())}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="log" className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Execution Log</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(getLogData(), 'Log data')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="h-64 border rounded p-3 bg-muted/50">
                <pre className="text-xs whitespace-pre-wrap font-mono">
                  {filterContent(getLogData())}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="error" className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Error Details</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(getErrorData(), 'Error details')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="h-64 border rounded p-3 bg-muted/50">
                <pre className={`text-xs whitespace-pre-wrap font-mono ${actualStatus === 'error' ? 'text-destructive' : ''}`}>
                  {filterContent(getErrorData())}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExecutionResultDialog;
