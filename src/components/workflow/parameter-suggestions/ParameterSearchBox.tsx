
import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface ParameterSearchBoxProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onClear: () => void;
}

const ParameterSearchBox: React.FC<ParameterSearchBoxProps> = ({
  searchTerm,
  onSearchChange,
  onClear
}) => {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search parameters..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="pl-9 pr-9 h-9 text-sm"
      />
      {searchTerm && (
        <button
          onClick={onClear}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 hover:bg-accent rounded p-0.5"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
};

export default ParameterSearchBox;
