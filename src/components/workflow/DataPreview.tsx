import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DataPreviewProps {
  data: any;
  type: 'input' | 'output';
  maxHeight?: string;
}

export const DataPreview: React.FC<DataPreviewProps> = ({ data, type, maxHeight = "100px" }) => {
  const renderPreview = () => {
    if (!data) return null;
    
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const preview = jsonString.length > 100 ? jsonString.substring(0, 100) + '...' : jsonString;
      
      return (
        <div className="text-xs text-muted-foreground mt-2">
          <div className="font-medium text-foreground mb-1">
            {type === 'input' ? 'Input:' : 'Output:'}
          </div>
          <ScrollArea style={{ maxHeight }} className="border rounded p-2 bg-muted/30">
            <pre className="whitespace-pre-wrap font-mono">
              {preview}
            </pre>
          </ScrollArea>
        </div>
      );
    } catch {
      return (
        <div className="text-xs text-muted-foreground mt-2">
          <div className="font-medium text-foreground mb-1">
            {type === 'input' ? 'Input:' : 'Output:'}
          </div>
          <div className="text-xs text-muted-foreground">
            {String(data).substring(0, 100)}...
          </div>
        </div>
      );
    }
  };

  return renderPreview();
};