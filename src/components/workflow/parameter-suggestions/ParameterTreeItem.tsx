
import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface Parameter {
  name: string;
  type: string;
  description: string;
  source: string;
  icon: React.ReactNode;
}

interface ParameterTreeItemProps {
  parameter: Parameter;
  onClick: (paramName: string) => void;
}

const ParameterTreeItem: React.FC<ParameterTreeItemProps> = ({ parameter, onClick }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('ParameterTreeItem clicked:', parameter.name);
    onClick(parameter.name);
  };

  return (
    <div
      onClick={handleClick}
      className="flex items-center gap-2 p-2 mx-2 mb-1 rounded-md hover:bg-accent cursor-pointer transition-colors relative z-10 pointer-events-auto"
      style={{ pointerEvents: 'auto' }}
    >
      {parameter.icon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-blue-600 truncate">
            {parameter.name}
          </span>
          <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded shrink-0">
            {parameter.type}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {parameter.description}
        </p>
      </div>
    </div>
  );
};

export default ParameterTreeItem;
