import React from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { 
  Settings, 
  Play, 
  AlertTriangle, 
  Edit, 
  Copy, 
  FileText, 
  Trash2,
  Layers
} from 'lucide-react';

interface NodeContextMenuProps {
  children: React.ReactNode;
  nodeId: string;
  nodeType: string;
  onRunSingle: (nodeId: string) => void;
  onAddErrorHandler: (nodeId: string) => void;
  onRename: (nodeId: string) => void;
  onClone: (nodeId: string) => void;
  onCopyModule: (nodeId: string) => void;
  onAddNote: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onSettings: (nodeId: string) => void;
}

const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
  children,
  nodeId,
  nodeType,
  onRunSingle,
  onAddErrorHandler,
  onRename,
  onClone,
  onCopyModule,
  onAddNote,
  onDelete,
  onSettings
}) => {
  const isTrigger = nodeType === 'trigger';

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div onContextMenu={(e) => {
          e.stopPropagation(); // Prevent WorkflowContextMenu from opening
        }}>
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56 bg-popover border border-border shadow-lg z-[9999] backdrop-blur-sm">
        <ContextMenuItem 
          onClick={() => onSettings(nodeId)}
          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted"
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </ContextMenuItem>
        
        {!isTrigger && (
          <ContextMenuItem 
            onClick={() => onRunSingle(nodeId)}
            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted"
          >
            <Play className="h-4 w-4" />
            <span>Run this module only</span>
          </ContextMenuItem>
        )}
        
        <ContextMenuItem 
          onClick={() => onAddErrorHandler(nodeId)}
          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted"
        >
          <AlertTriangle className="h-4 w-4" />
          <span>Add error handler</span>
        </ContextMenuItem>
        
        <ContextMenuItem 
          onClick={() => onRename(nodeId)}
          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted"
        >
          <Edit className="h-4 w-4" />
          <span>Rename</span>
        </ContextMenuItem>
        
        <ContextMenuItem 
          onClick={() => onClone(nodeId)}
          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted"
        >
          <Layers className="h-4 w-4" />
          <span>Clone</span>
        </ContextMenuItem>
        
        <ContextMenuItem 
          onClick={() => onCopyModule(nodeId)}
          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted"
        >
          <Copy className="h-4 w-4" />
          <span>Copy module</span>
        </ContextMenuItem>
        
        <ContextMenuItem 
          onClick={() => onAddNote(nodeId)}
          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted"
        >
          <FileText className="h-4 w-4" />
          <span>Add a note</span>
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(nodeId);
          }}
          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-destructive hover:text-destructive-foreground text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete module</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default NodeContextMenu;