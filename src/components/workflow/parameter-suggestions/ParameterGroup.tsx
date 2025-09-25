
import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import ParameterTreeItem from './ParameterTreeItem';

interface Parameter {
  name: string;
  type: string;
  description: string;
  source: string;
  icon: React.ReactNode;
}

interface ParameterGroupProps {
  title: string;
  icon: React.ReactNode;
  parameters: Parameter[];
  onParameterClick: (paramName: string) => void;
  defaultExpanded?: boolean;
}

const ParameterGroup: React.FC<ParameterGroupProps> = ({
  title,
  icon,
  parameters,
  onParameterClick,
  defaultExpanded = true
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleGroupClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="border-b border-border last:border-b-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={handleGroupClick}
        className="w-full flex items-center gap-2 p-3 hover:bg-accent transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        {icon}
        <span className="font-medium text-sm">{title}</span>
        <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded">
          {parameters.length}
        </span>
      </button>
      
      {isExpanded && (
        <div className="pb-2">
          {parameters.map((param) => (
            <ParameterTreeItem
              key={param.name}
              parameter={param}
              onClick={onParameterClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ParameterGroup;
