import React, { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';

interface ExecutionStarterProps {
  onExecuteFromNode: (nodeId: string | null) => void;
  executionStartNode: string | null;
  nodes: any[];
  setNodes: (updater: (nodes: any[]) => any[]) => void;
}

const ExecutionStarter: React.FC<ExecutionStarterProps> = ({ 
  onExecuteFromNode, 
  executionStartNode, 
  nodes, 
  setNodes 
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData('application/execution-starter', 'true');
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Listen for drops on the React Flow canvas
  useEffect(() => {
    const handleGlobalDrop = (e: DragEvent) => {
      if (!isDragging) return;
      
      e.preventDefault();
      const targetElement = e.target as HTMLElement;
      
      // Look for React Flow node
      const nodeElement = targetElement.closest('.react-flow__node');
      if (nodeElement) {
        const nodeId = nodeElement.getAttribute('data-id');
        if (nodeId) {
          // Remove execution start from all nodes first
          setNodes((currentNodes) => 
            currentNodes.map(node => ({
              ...node,
              data: {
                ...node.data,
                isExecutionStart: false
              }
            }))
          );
          
          // Set execution start on the target node
          setNodes((currentNodes) => 
            currentNodes.map(node => 
              node.id === nodeId 
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      isExecutionStart: true
                    }
                  }
                : node
            )
          );
          
          onExecuteFromNode(nodeId);
        }
      }
    };

    const handleGlobalDragOver = (e: DragEvent) => {
      if (isDragging) {
        e.preventDefault();
      }
    };

    document.addEventListener('drop', handleGlobalDrop);
    document.addEventListener('dragover', handleGlobalDragOver);

    return () => {
      document.removeEventListener('drop', handleGlobalDrop);
      document.removeEventListener('dragover', handleGlobalDragOver);
    };
  }, [isDragging, onExecuteFromNode, setNodes]);

  return (
    <div className="mb-4">
      {/* Draggable flash icon in sidebar */}
      <div 
        className={`
          flex items-center gap-2 p-2 border border-dashed border-primary/30 rounded-lg
          cursor-grab hover:bg-primary/5 transition-colors
          ${isDragging ? 'opacity-50' : ''}
        `}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        title="Drag to set workflow execution starting point"
      >
        <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-glow rounded-lg flex items-center justify-center shadow-elegant">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="text-xs text-muted-foreground">
          Drag to set execution start
        </div>
      </div>
    </div>
  );
};

export default ExecutionStarter;