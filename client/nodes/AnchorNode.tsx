import { Handle, Position } from "@xyflow/react";

export default function AnchorNode() {
  return (
    <div style={{
      width: 4,
      height: 4,
      background: '#0066ff',
      borderRadius: '50%',
      border: '2px solid white',
      boxShadow: '0 0 4px rgba(0,0,0,0.3)',
      pointerEvents: 'none'
    }}>
      <Handle 
        type="source" 
        position={Position.Right} 
        style={{ opacity: 0 }} // The handle is the whole dot
      />
    </div>
  );
}