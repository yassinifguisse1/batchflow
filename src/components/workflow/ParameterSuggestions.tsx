import React, { useState, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Database, FileText, Image, Code, Clock, Route, Lightbulb, Folder, Webhook } from 'lucide-react';
import ParameterGroup from './parameter-suggestions/ParameterGroup';
import ParameterSearchBox from './parameter-suggestions/ParameterSearchBox';
import { supabase } from '@/integrations/supabase/client';

interface Parameter {
  name: string;
  type: string;
  description: string;
  source: string;
  icon: React.ReactNode;
}

interface ParameterSuggestionsProps {
  nodeId: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const ParameterSuggestions: React.FC<ParameterSuggestionsProps> = ({
  nodeId,
  value,
  onChange,
  placeholder = "Enter value or select parameter...",
  className = ""
}) => {
  const [availableParameters, setAvailableParameters] = useState<Parameter[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [webhookStructures, setWebhookStructures] = useState<any>({});
  const { getNodes, getEdges } = useReactFlow();

  useEffect(() => {
    const updateParameters = () => {
      const nodes = getNodes();
      const edges = getEdges();
      const parameters: Parameter[] = [];

      console.log('Current nodeId:', nodeId);
      console.log('All nodes:', nodes);
      console.log('All edges:', edges);

      // Update webhook structures from global storage
      if (window.webhookStructures) {
        setWebhookStructures(window.webhookStructures);
      }

    // Get all previous nodes in the workflow execution order
    const getAllPreviousNodes = (currentNodeId: string, visited = new Set<string>()): string[] => {
      if (visited.has(currentNodeId)) return [];
      visited.add(currentNodeId);
      
      const incomingEdges = edges.filter(edge => edge.target === currentNodeId);
      const sourceNodeIds = incomingEdges.map(edge => edge.source);
      
      let allPrevious: string[] = [];
      sourceNodeIds.forEach(sourceId => {
        allPrevious.push(sourceId);
        allPrevious.push(...getAllPreviousNodes(sourceId, visited));
      });
      
      return allPrevious;
    };

    const previousNodeIds = getAllPreviousNodes(nodeId);
    console.log('All previous node IDs:', previousNodeIds);

    // Remove duplicates and sort by execution order
    const uniquePreviousNodeIds = [...new Set(previousNodeIds)];
    
    // Sort nodes by their position/creation order to maintain proper flow sequence
    const sortedNodeIds = uniquePreviousNodeIds.sort((a, b) => {
      const nodeA = nodes.find(n => n.id === a);
      const nodeB = nodes.find(n => n.id === b);
      if (!nodeA || !nodeB) return 0;
      
      // Sort by Y position first (top to bottom), then X position (left to right)
      if (Math.abs(nodeA.position.y - nodeB.position.y) > 50) {
        return nodeA.position.y - nodeB.position.y;
      }
      return nodeA.position.x - nodeB.position.x;
    });

    console.log('Sorted previous node IDs:', sortedNodeIds);

    sortedNodeIds.forEach((sourceId, index) => {
      const sourceNode = nodes.find(n => n.id === sourceId);
      if (sourceNode) {
        console.log('Found source node:', sourceNode);
        const nodeParameters = getNodeParameters(sourceNode);
        console.log('Parameters for node', sourceNode.data?.label, ':', nodeParameters);
        parameters.push(...nodeParameters);
      }
    });

    console.log('All available parameters:', parameters);
    
    // Deduplicate parameters by full name to avoid duplicates when nodes share labels
    const uniqueParamsMap = new Map<string, Parameter>();
    parameters.forEach((p) => {
      if (!uniqueParamsMap.has(p.name)) uniqueParamsMap.set(p.name, p);
    });
    const uniqueParameters = Array.from(uniqueParamsMap.values());

    setAvailableParameters(uniqueParameters);
    };

    updateParameters();

    // Listen for webhook structure updates
    const handleWebhookStructureUpdate = () => {
      console.log('Webhook structure updated, refreshing parameters');
      updateParameters();
    };

    window.addEventListener('webhookStructureUpdated', handleWebhookStructureUpdate);

    return () => {
      window.removeEventListener('webhookStructureUpdated', handleWebhookStructureUpdate);
    };
  }, [nodeId, getNodes, getEdges]);

  const generateParametersFromStructure = (structure: any, nodeLabel: string, path: string = ''): Parameter[] => {
    const parameters: Parameter[] = [];
    
    if (!structure || typeof structure !== 'object') return parameters;

    const processStructure = (obj: any, currentPath: string = ''): void => {
      if (obj.type === 'object' && obj.properties) {
        Object.keys(obj.properties).forEach(key => {
          const property = obj.properties[key];
          const paramName = currentPath ? `${nodeLabel}.${currentPath}.${key}` : `${nodeLabel}.${key}`;
          
          parameters.push({
            name: paramName,
            type: property.type || 'unknown',
            description: property.description || `${property.type || 'unknown'} value from webhook data`,
            source: `${nodeLabel}`,
            icon: <Webhook className="h-4 w-4" />
          });

          if (property.type === 'object' && property.properties) {
            processStructure(property, currentPath ? `${currentPath}.${key}` : key);
          }
        });
      } else if (obj.type === 'array' && obj.items) {
        const paramName = currentPath ? `${nodeLabel}.${currentPath}` : `${nodeLabel}`;
        parameters.push({
          name: paramName,
          type: 'array',
          description: obj.description || 'Array from webhook data',
          source: `${nodeLabel}`,
          icon: <Webhook className="h-4 w-4" />
        });
        
        if (obj.items.type === 'object') {
          processStructure(obj.items, `${currentPath}[0]`);
        }
      } else {
        // Direct value
        const paramName = currentPath ? `${nodeLabel}.${currentPath}` : `${nodeLabel}`;
        parameters.push({
          name: paramName,
          type: obj.type || 'unknown',
          description: obj.description || `${obj.type || 'unknown'} value from webhook data`,
          source: `${nodeLabel}`,
          icon: <Webhook className="h-4 w-4" />
        });
      }
    };

    processStructure(structure, path);
    return parameters;
  };

  const getNodeParameters = (node: any): Parameter[] => {
    const nodeType = node.type;
    const baseLabel = node.data?.label || 'Unknown';
    
    // Prefer stored nodeNumber for labeling; fallback to 1 if missing
    const number = node.data?.nodeNumber ?? 1;
    let nodeLabel: string;
    if (nodeType === 'trigger') {
      nodeLabel = `Trigger ${number}`;
    } else if (nodeType === 'gptTask') {
      nodeLabel = `GPT ${number}`;
    } else if (nodeType === 'httpTask') {
      nodeLabel = `HTTP ${number}`;
    } else if (nodeType === 'imageTask') {
      nodeLabel = `Image ${number}`;
    } else {
      nodeLabel = `${baseLabel} ${number}`;
    }

    switch (nodeType) {
      case 'trigger':
        const baseParameters = [
          {
            name: `${nodeLabel}.webhookData`,
            type: 'object',
            description: 'Complete webhook payload data',
            source: nodeLabel,
            icon: <Database className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.headers`,
            type: 'object',
            description: 'HTTP headers from webhook request',
            source: nodeLabel,
            icon: <Code className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.body`,
            type: 'string',
            description: 'Request body content',
            source: nodeLabel,
            icon: <FileText className="h-4 w-4" />
          }
        ];

        // Add determined structure parameters if available
        // Check for webhook ID in multiple possible locations
        const webhookId = node.data?.config?.webhookId || 
                         node.data?.config?.webhook?.id || 
                         node.data?.config?.selectedHook ||
                         node.data?.webhook?.id || 
                         node.data?.webhookId;
        
        console.log('Looking for webhook structure for ID:', webhookId);
        console.log('Available webhook structures:', window.webhookStructures);
        
        const currentStructures = window.webhookStructures || webhookStructures;
        
        if (webhookId && currentStructures[webhookId]) {
          const structure = currentStructures[webhookId];
          console.log('Found webhook structure:', structure);
          const structureParams = generateParametersFromStructure(structure, nodeLabel);
          
          // If we have determined structure, put those parameters first
          const backCompatParams = [
            {
              name: `${nodeLabel}.webhookData`,
              type: 'object',
              description: 'Complete webhook payload data',
              source: nodeLabel,
              icon: <Database className="h-4 w-4" />
            },
            {
              name: `${nodeLabel}.headers`,
              type: 'object',
              description: 'HTTP headers from webhook request',
              source: nodeLabel,
              icon: <Code className="h-4 w-4" />
            },
            {
              name: `${nodeLabel}.body`,
              type: 'string',
              description: 'Request body content',
              source: nodeLabel,
              icon: <FileText className="h-4 w-4" />
            }
          ];
          
          return [...structureParams, ...backCompatParams];
        } else {
          console.log('No webhook structure found for ID:', webhookId);
        }

        return baseParameters;

      case 'httpTask':
        return [
          {
            name: `${nodeLabel}.response`,
            type: 'object',
            description: 'HTTP response data',
            source: nodeLabel,
            icon: <Database className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.statusCode`,
            type: 'number',
            description: 'HTTP response status code',
            source: nodeLabel,
            icon: <Code className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.responseHeaders`,
            type: 'object',
            description: 'Response headers',
            source: nodeLabel,
            icon: <FileText className="h-4 w-4" />
          }
        ];

      case 'gptTask':
        return [
          {
            name: `${nodeLabel}.result`,
            type: 'string',
            description: 'GPT completion result text',
            source: nodeLabel,
            icon: <FileText className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.id`,
            type: 'string',
            description: 'Unique completion ID',
            source: nodeLabel,
            icon: <Code className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.object`,
            type: 'string',
            description: 'Response object type (chat.completion)',
            source: nodeLabel,
            icon: <Database className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.created`,
            type: 'number',
            description: 'Unix timestamp of completion creation',
            source: nodeLabel,
            icon: <Clock className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.model`,
            type: 'string',
            description: 'Model used for completion (e.g., gpt-4o-mini-2024-07-18)',
            source: nodeLabel,
            icon: <Database className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.choices`,
            type: 'array',
            description: 'Array of completion choices',
            source: nodeLabel,
            icon: <Database className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.choices[0].text`,
            type: 'string',
            description: 'Text content of first choice',
            source: nodeLabel,
            icon: <FileText className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.choices[0].index`,
            type: 'number',
            description: 'Index of the choice',
            source: nodeLabel,
            icon: <Code className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.choices[0].logprobs`,
            type: 'object',
            description: 'Log probabilities for tokens',
            source: nodeLabel,
            icon: <Database className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.choices[0].finish_reason`,
            type: 'string',
            description: 'Reason completion finished (stop, length, etc.)',
            source: nodeLabel,
            icon: <Code className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.choices[0].message`,
            type: 'object',
            description: 'Message object containing role and content',
            source: nodeLabel,
            icon: <Database className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.choices[0].message.role`,
            type: 'string',
            description: 'Message role (assistant, user, system)',
            source: nodeLabel,
            icon: <Code className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.choices[0].message.content`,
            type: 'string',
            description: 'Message content text',
            source: nodeLabel,
            icon: <FileText className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.usage`,
            type: 'object',
            description: 'Token usage statistics',
            source: nodeLabel,
            icon: <Database className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.usage.prompt_tokens`,
            type: 'number',
            description: 'Number of tokens in prompt',
            source: nodeLabel,
            icon: <Code className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.usage.completion_tokens`,
            type: 'number',
            description: 'Number of tokens in completion',
            source: nodeLabel,
            icon: <Code className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.usage.total_tokens`,
            type: 'number',
            description: 'Total tokens used',
            source: nodeLabel,
            icon: <Code className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.service_tier`,
            type: 'string',
            description: 'Service tier used (default, etc.)',
            source: nodeLabel,
            icon: <Database className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.system_fingerprint`,
            type: 'string',
            description: 'System fingerprint for reproducibility',
            source: nodeLabel,
            icon: <Code className="h-4 w-4" />
          }
        ];

      case 'imageTask':
        return [
          {
            name: `${nodeLabel}.imageUrl`,
            type: 'string',
            description: 'Generated image URL',
            source: nodeLabel,
            icon: <Image className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.metadata`,
            type: 'object',
            description: 'Image metadata and properties',
            source: nodeLabel,
            icon: <Database className="h-4 w-4" />
          }
        ];

      case 'dataTransform':
        return [
          {
            name: `${nodeLabel}.output`,
            type: 'any',
            description: 'Transformed data output',
            source: nodeLabel,
            icon: <Code className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.originalData`,
            type: 'any',
            description: 'Original input data',
            source: nodeLabel,
            icon: <Database className="h-4 w-4" />
          }
        ];

      case 'delay':
        return [
          {
            name: `${nodeLabel}.delayedAt`,
            type: 'date',
            description: 'Timestamp when delay completed',
            source: nodeLabel,
            icon: <Clock className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.duration`,
            type: 'number',
            description: 'Actual delay duration in milliseconds',
            source: nodeLabel,
            icon: <Clock className="h-4 w-4" />
          }
        ];

      case 'conditional':
        return [
          {
            name: `${nodeLabel}.conditionResult`,
            type: 'boolean',
            description: 'Result of condition evaluation',
            source: nodeLabel,
            icon: <Route className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.executedPath`,
            type: 'string',
            description: 'Which path was executed (true/false)',
            source: nodeLabel,
            icon: <Route className="h-4 w-4" />
          }
        ];

      case 'iterator':
        return [
          {
            name: `${nodeLabel}.items`,
            type: 'array',
            description: 'Array of processed items',
            source: nodeLabel,
            icon: <Database className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.currentItem`,
            type: 'any',
            description: 'Currently processed item',
            source: nodeLabel,
            icon: <Code className="h-4 w-4" />
          },
          {
            name: `${nodeLabel}.index`,
            type: 'number',
            description: 'Current iteration index',
            source: nodeLabel,
            icon: <Code className="h-4 w-4" />
          }
        ];

      default:
        return [];
    }
  };

  const handleParameterClick = (paramName: string) => {
    console.log('Parameter clicked:', paramName);
    const paramValue = `{{${paramName}}}`;
    console.log('Inserting value:', paramValue);
    
    // Get the textarea element to access cursor position
    const textarea = document.activeElement as HTMLTextAreaElement;
    
    if (textarea && textarea.tagName === 'TEXTAREA') {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = value || '';
      
      // Insert parameter at cursor position
      const newValue = currentValue.substring(0, start) + paramValue + currentValue.substring(end);
      onChange(newValue);
      
      // Restore cursor position after the inserted parameter
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + paramValue.length, start + paramValue.length);
      }, 0);
    } else {
      // Fallback: append to existing value
      const newValue = (value || '') + paramValue;
      onChange(newValue);
    }
    
    setIsOpen(false);
  };

  const handleTextareaClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Textarea clicked, available parameters:', availableParameters.length);
    if (availableParameters.length > 0) {
      setIsOpen(true);
    }
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Button clicked, opening parameter suggestions');
    setIsOpen(true);
  };

  // Group parameters by source
  const groupedParameters = availableParameters.reduce((groups, param) => {
    if (!groups[param.source]) {
      groups[param.source] = [];
    }
    groups[param.source].push(param);
    return groups;
  }, {} as Record<string, Parameter[]>);

  // Filter parameters based on search term
  const filteredGroups = Object.entries(groupedParameters).reduce((filtered, [source, params]) => {
    const filteredParams = params.filter(param =>
      param.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      param.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      param.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filteredParams.length > 0) {
      filtered[source] = filteredParams;
    }
    return filtered;
  }, {} as Record<string, Parameter[]>);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="flex items-center gap-2">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className={`flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none ${className}`}
              onClick={handleTextareaClick}
              rows={className?.includes('min-h-[72px]') ? 3 : className?.includes('min-h-[96px]') ? 4 : 1}
            />
            
            {availableParameters.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-10 px-3 shrink-0"
                type="button"
                onClick={handleButtonClick}
              >
                <Lightbulb className="h-4 w-4 text-yellow-600" />
              </Button>
            )}
          </div>
        </PopoverTrigger>
        
        {availableParameters.length > 0 && (
          <PopoverContent 
            side="right" 
            sideOffset={10}
            className="w-96 p-0 z-[9999] shadow-2xl border-2 pointer-events-auto max-h-[80vh]"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
            avoidCollisions={true}
            collisionPadding={20}
            style={{ pointerEvents: 'auto' }}
          >
            {/* Header */}
            <div className="p-4 border-b bg-muted/30">
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <Lightbulb className="h-4 w-4 text-yellow-600" />
                Available Parameters
              </h4>
              <ParameterSearchBox
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onClear={() => setSearchTerm('')}
              />
            </div>

            {/* Parameter Groups */}
            <div 
              className="flex-1 overflow-y-auto overflow-x-hidden pointer-events-auto scrollbar-thin scrollbar-thumb-muted-foreground/50 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/70 max-h-[calc(80vh-140px)]" 
              style={{ pointerEvents: 'auto' }}
              onWheel={(e) => {
                e.stopPropagation();
                const target = e.currentTarget;
                target.scrollTop += e.deltaY;
              }}
            >
              {Object.keys(filteredGroups).length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  {searchTerm ? 'No parameters match your search.' : 'No parameters available from connected nodes.'}
                </div>
              ) : (
                Object.entries(filteredGroups).map(([source, params]) => (
                  <ParameterGroup
                    key={source}
                    title={source}
                    icon={<Folder className="h-4 w-4 text-blue-600" />}
                    parameters={params}
                    onParameterClick={handleParameterClick}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t bg-muted/10">
              <p className="text-xs text-muted-foreground text-center">
                Click any parameter to insert it into the field
              </p>
            </div>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
};

export default ParameterSuggestions;
