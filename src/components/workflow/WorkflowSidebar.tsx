import React from 'react';
import { Node } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Zap, Globe, Image, Clock, GitBranch, RotateCw, Shuffle, ChevronLeft, ChevronRight, Trash2, Copy, FileText } from 'lucide-react';
import NodeConfigPanel from './NodeConfigPanel';
import ExecutionStarter from './ExecutionStarter';
interface WorkflowSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onAddNode: (type: string) => void;
  selectedNode: Node | null;
  onNodeUpdate: (nodeId: string, updates: any) => void;
  onRemoveNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onExecuteFromNode: (nodeId: string | null) => void;
  executionStartNode: string | null;
  nodes: Node[];
  setNodes: (updater: (nodes: any[]) => any[]) => void;
}
const nodeTypes = [{
  type: 'gptTask',
  label: 'GPT Task',
  icon: Zap,
  color: 'bg-blue-500'
}, {
  type: 'httpTask',
  label: 'HTTP Request',
  icon: Globe,
  color: 'bg-green-500'
}, {
  type: 'multipartHttp',
  label: 'HTTP Multipart',
  icon: FileText,
  color: 'bg-purple-500'
}, {
  type: 'imageTask',
  label: 'Image Task',
  icon: Image,
  color: 'bg-purple-500'
}, {
  type: 'delay',
  label: 'Delay',
  icon: Clock,
  color: 'bg-orange-500'
}, {
  type: 'conditional',
  label: 'Conditional',
  icon: GitBranch,
  color: 'bg-yellow-500'
}, {
  type: 'iterator',
  label: 'Iterator',
  icon: RotateCw,
  color: 'bg-cyan-500'
}, {
  type: 'dataTransform',
  label: 'Transform',
  icon: Shuffle,
  color: 'bg-pink-500'
}, {
  type: 'arrayAggregator',
  label: 'Array Aggregator',
  icon: Plus,
  color: 'bg-indigo-500'
}];
const WorkflowSidebar: React.FC<WorkflowSidebarProps> = ({
  isOpen,
  onToggle,
  onAddNode,
  selectedNode,
  onNodeUpdate,
  onRemoveNode,
  onDuplicateNode,
  onExecuteFromNode,
  executionStartNode,
  nodes,
  setNodes
}) => {
  return (
    <>
      {/* Sidebar Toggle Button */}
      <Button
        onClick={onToggle}
        variant="outline"
        size="sm"
        className={`fixed top-4 right-4 z-10 transition-all duration-200 ${
          isOpen ? 'right-80' : 'right-4'
        }`}
      >
        {isOpen ? <ChevronRight className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </Button>

      {/* Sidebar Panel */}
      {isOpen && (
        <div className="fixed right-0 top-0 h-full w-80 bg-background border-l border-border z-20 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">Workflow Tools</h3>
            <Button onClick={onToggle} variant="ghost" size="sm">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            {selectedNode ? (
              <div className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <h4 className="font-medium">Node Settings</h4>
                  <div className="flex gap-1">
                    <Button
                      onClick={() => onDuplicateNode(selectedNode.id)}
                      variant="outline"
                      size="sm"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => onRemoveNode(selectedNode.id)}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <NodeConfigPanel
                  node={selectedNode}
                  onUpdate={(updates) => onNodeUpdate(selectedNode.id, updates)}
                />
              </div>
            ) : (
              <div className="p-4">
                {/* Execution Starter */}
                <div className="mb-6">
                  <h4 className="font-medium mb-3">Execution Control</h4>
                  <ExecutionStarter
                    onExecuteFromNode={onExecuteFromNode}
                    executionStartNode={executionStartNode}
                    nodes={nodes}
                    setNodes={setNodes}
                  />
                </div>
                
                <Separator className="my-4" />
                
                <h4 className="font-medium mb-3">Add Nodes</h4>
                <div className="grid gap-2">
                  {nodeTypes.map((nodeType) => {
                    const Icon = nodeType.icon;
                    return (
                      <Button
                        key={nodeType.type}
                        onClick={() => onAddNode(nodeType.type)}
                        variant="outline"
                        className="justify-start h-auto p-3"
                      >
                        <div className={`w-3 h-3 rounded-full ${nodeType.color} mr-3`} />
                        <Icon className="h-4 w-4 mr-2" />
                        {nodeType.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </>
  );
};
export default WorkflowSidebar;