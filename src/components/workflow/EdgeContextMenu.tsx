import React from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { 
  Filter, 
  Unlink, 
  Ban, 
  MousePointer, 
  Route, 
  Plus 
} from 'lucide-react';

interface EdgeContextMenuProps {
  children: React.ReactNode;
  edgeId?: string;
  onAddNode?: (type: string, position?: { x: number; y: number }) => void;
}

const EdgeContextMenu: React.FC<EdgeContextMenuProps> = ({
  children,
  edgeId,
  onAddNode
}) => {
  const { setEdges, getEdge } = useReactFlow();

  const handleSetUpFilter = () => {
    console.log('Set up filter for edge:', edgeId);
    // Implementation for setting up filter
  };

  const handleUnlink = () => {
    if (edgeId) {
      setEdges((edges) => edges.filter((edge) => edge.id !== edgeId));
    }
  };

  const handleDisableRoute = () => {
    if (edgeId) {
      setEdges((edges) => 
        edges.map((edge) => 
          edge.id === edgeId 
            ? { ...edge, style: { ...edge.style, opacity: 0.3, strokeDasharray: '5,5' } }
            : edge
        )
      );
    }
  };

  const handleSelectWholeBranch = () => {
    console.log('Select whole branch for edge:', edgeId);
    // Implementation for selecting whole branch
  };

  const handleAddRouter = () => {
    if (edgeId && onAddNode) {
      const edge = getEdge(edgeId);
      if (edge) {
        // Calculate position between source and target
        onAddNode('router');
      }
    }
  };

  const handleAddModule = () => {
    if (edgeId && onAddNode) {
      const edge = getEdge(edgeId);
      if (edge) {
        // Calculate position between source and target
        onAddNode('httpTask');
      }
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleSetUpFilter}>
          <Filter className="mr-2 h-4 w-4" />
          Set up a filter
        </ContextMenuItem>
        
        <ContextMenuItem onClick={handleUnlink}>
          <Unlink className="mr-2 h-4 w-4" />
          Unlink
        </ContextMenuItem>
        
        <ContextMenuItem onClick={handleDisableRoute}>
          <Ban className="mr-2 h-4 w-4" />
          Disable route
        </ContextMenuItem>
        
        <ContextMenuItem onClick={handleSelectWholeBranch}>
          <MousePointer className="mr-2 h-4 w-4" />
          Select whole branch
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem onClick={handleAddRouter}>
          <Route className="mr-2 h-4 w-4" />
          Add a router
        </ContextMenuItem>
        
        <ContextMenuItem onClick={handleAddModule}>
          <Plus className="mr-2 h-4 w-4" />
          Add a module
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default EdgeContextMenu;