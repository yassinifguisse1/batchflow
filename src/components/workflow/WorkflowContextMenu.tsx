import React, { useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { 
  Webhook, 
  Brain, 
  Globe, 
  Image, 
  Clock, 
  GitBranch, 
  RotateCcw, 
  Database, 
  Cog,
  Upload,
  Search,
  Layers,
  Route,
  Layers3,
  FileText
} from 'lucide-react';

interface WorkflowApp {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  category: 'scenario' | 'all';
}

const apps: WorkflowApp[] = [
  {
    id: 'webhooks',
    name: 'Webhooks',
    icon: <Webhook className="h-4 w-4" />,
    description: 'Trigger workflows with HTTP requests',
    category: 'scenario'
  },
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT, Whisper, DALL-E)',
    icon: <Brain className="h-4 w-4" />,
    description: 'AI-powered text and image generation',
    category: 'scenario'
  },
  {
    id: 'http',
    name: 'HTTP',
    icon: <Globe className="h-4 w-4" />,
    description: 'Make HTTP requests to any API',
    category: 'scenario'
  },
  {
    id: 'multipart-http',
    name: 'HTTP Multipart',
    icon: <FileText className="h-4 w-4" />,
    description: 'Upload files and form data via HTTP',
    category: 'scenario'
  },
  {
    id: 'uploadcare',
    name: 'Uploadcare',
    icon: <Upload className="h-4 w-4" />,
    description: 'File upload and processing service',
    category: 'scenario'
  },
  {
    id: 'webhook-response',
    name: 'Webhook Response',
    icon: <Webhook className="h-4 w-4" />,
    description: 'Return custom webhook response',
    category: 'scenario'
  },
  {
    id: 'flow-control',
    name: 'Flow Control',
    icon: <GitBranch className="h-4 w-4" />,
    description: 'Control workflow execution flow',
    category: 'all'
  },
  {
    id: 'iterator',
    name: 'Iterator',
    icon: <RotateCcw className="h-4 w-4" />,
    description: 'Process arrays and collections',
    category: 'all'
  },
  {
    id: 'delay',
    name: 'Delay',
    icon: <Clock className="h-4 w-4" />,
    description: 'Add delays to your workflow',
    category: 'all'
  },
  {
    id: 'data-transform',
    name: 'Data Transform',
    icon: <Database className="h-4 w-4" />,
    description: 'Transform and manipulate data',
    category: 'all'
  },
  {
    id: 'router',
    name: 'Router',
    icon: <Route className="h-4 w-4" />,
    description: 'Route data to multiple branches in parallel or sequence',
    category: 'all'
  },
  {
    id: 'array-aggregator',
    name: 'Array Aggregator',
    icon: <Layers3 className="h-4 w-4" />,
    description: 'Merge all responses from previous connected modules into one array',
    category: 'all'
  }
];

interface WorkflowContextMenuProps {
  children: React.ReactNode;
  onAddNode: (type: string, position?: { x: number; y: number }, config?: any) => void;
}

const WorkflowContextMenu: React.FC<WorkflowContextMenuProps> = ({
  children,
  onAddNode
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  const filteredApps = apps.filter(app =>
    app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const scenarioApps = filteredApps.filter(app => app.category === 'scenario');
  const allApps = filteredApps.filter(app => app.category === 'all');

  const handleContextMenu = (event: React.MouseEvent) => {
    // Convert screen coordinates to flow coordinates
    const flowPosition = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    setClickPosition(flowPosition);
  };

  const handleAddApp = (appId: string) => {
    const nodeTypeMap: Record<string, string> = {
      'webhooks': 'trigger',
      'openai': 'gptTask',
      'http': 'httpTask',
      'multipart-http': 'multipartHttp',
      'uploadcare': 'imageTask',
      'webhook-response': 'webhookResponse',
      'flow-control': 'conditional',
      'iterator': 'iterator',
      'delay': 'delay',
      'data-transform': 'dataTransform',
      'router': 'router',
      'array-aggregator': 'arrayAggregator'
    };

    const nodeType = nodeTypeMap[appId] || 'httpTask';
    
    // Set specific trigger type for trigger nodes
    let config = undefined;
    if (appId === 'webhooks') {
      config = { triggerType: 'webhook' };
    }
    
    onAddNode(nodeType, clickPosition || undefined, config);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={handleContextMenu}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-80 max-h-96 overflow-y-auto">
        {/* Search */}
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search apps or modules"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
        </div>

        <ContextMenuSeparator />

        {/* Apps in Scenario */}
        {scenarioApps.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Apps in Scenario
            </div>
            {scenarioApps.map((app) => (
              <ContextMenuItem 
                key={app.id}
                onClick={() => handleAddApp(app.id)}
                className="flex items-start gap-3 p-3 cursor-pointer"
              >
                <div className="flex-shrink-0 p-1.5 rounded-lg bg-primary/10 text-primary">
                  {app.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{app.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {app.description}
                  </div>
                </div>
              </ContextMenuItem>
            ))}
            <ContextMenuSeparator />
          </>
        )}

        {/* All Apps */}
        {allApps.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              All Apps
            </div>
            {allApps.map((app) => (
              <ContextMenuItem 
                key={app.id}
                onClick={() => handleAddApp(app.id)}
                className="flex items-start gap-3 p-3 cursor-pointer"
              >
                <div className="flex-shrink-0 p-1.5 rounded-lg bg-secondary/50">
                  {app.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{app.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {app.description}
                  </div>
                </div>
              </ContextMenuItem>
            ))}
          </>
        )}

        {filteredApps.length === 0 && searchTerm && (
          <div className="p-6 text-center text-muted-foreground">
            <div className="text-sm">No apps found</div>
            <div className="text-xs mt-1">Try a different search term</div>
          </div>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default WorkflowContextMenu;