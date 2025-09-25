
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Node } from '@xyflow/react';
import NodeConfigPanel from './NodeConfigPanel';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface NodeSettingsDialogProps {
  node: Node | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (nodeId: string, updates: any) => void;
}

const NodeSettingsDialog: React.FC<NodeSettingsDialogProps> = ({
  node,
  isOpen,
  onClose,
  onUpdate
}) => {
  if (!node) return null;

  const handleUpdate = (updates: any) => {
    onUpdate(node.id, updates);
  };

  const getNodeTitle = () => {
    const nodeType = node.type;
    const label = (node.data?.label as string) || '';
    
    switch (nodeType) {
      case 'trigger':
        return 'Webhook Configuration';
      case 'gptTask':
        return 'GPT Task Configuration';
      case 'httpTask':
        return 'HTTP Request Configuration';
      case 'multipartHttp':
        return 'HTTP Multipart Configuration';
      case 'imageTask':
        return 'Image Task Configuration';
      case 'delay':
        return 'Delay Configuration';
      case 'conditional':
        return 'Conditional Configuration';
      case 'iterator':
        return 'Iterator Configuration';
      case 'dataTransform':
        return 'Data Transform Configuration';
      case 'router':
        return 'Router Configuration';
      case 'webhookResponse':
        return 'Webhooks';
      default:
        return `${label || nodeType} Configuration`;
    }
  };

  const handleDialogClick = (e: React.MouseEvent) => {
    // Prevent closing when clicking inside the dialog content
    e.stopPropagation();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-4xl max-h-[85vh] overflow-hidden p-0 gap-0 z-50"
        onClick={handleDialogClick}
        onPointerDownOutside={(e) => {
          // Check if the click is on a popover or its content
          const target = e.target as Element;
          if (target.closest('[data-radix-popper-content-wrapper]') || 
              target.closest('[data-radix-popover-content]')) {
            e.preventDefault();
          }
        }}
      >
        {/* Pink Header */}
        <div className="bg-pink-500 text-white px-6 py-4 flex items-center justify-between">
          <DialogTitle className="text-lg font-medium text-white">
            {getNodeTitle()}
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-pink-600 h-6 w-6"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto max-h-[65vh]">
          <NodeConfigPanel node={node} onUpdate={handleUpdate} />
        </div>

        {/* Footer with buttons */}
        <div className="border-t bg-muted/20 px-6 py-4 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={onClose}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NodeSettingsDialog;
