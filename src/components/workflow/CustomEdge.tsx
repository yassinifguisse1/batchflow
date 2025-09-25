import React, { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  EdgeProps,
} from '@xyflow/react';
import EdgeContextMenu from './EdgeContextMenu';

const CustomEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <EdgeContextMenu edgeId={id}>
        <BaseEdge 
          path={edgePath} 
          markerEnd={markerEnd} 
          style={{
            ...style,
            stroke: isHovered ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
            strokeWidth: isHovered ? 3 : 2,
            strokeDasharray: '5,5',
            transition: 'all 0.2s ease-in-out',
            cursor: 'pointer',
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        />
      </EdgeContextMenu>
      
      {/* Invisible hit area for better interaction */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            padding: '10px',
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <EdgeContextMenu edgeId={id}>
            <div 
              className="w-16 h-8 cursor-pointer hover:bg-primary/10 rounded transition-colors duration-200" 
              style={{
                background: isHovered ? 'hsla(var(--primary), 0.1)' : 'transparent',
              }}
            />
          </EdgeContextMenu>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default CustomEdge;