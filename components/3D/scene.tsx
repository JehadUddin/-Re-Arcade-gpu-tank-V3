import React from 'react';

interface Scene3DProps {
  showSky?: boolean;
}

const Scene3D: React.FC<Scene3DProps> = ({ showSky = false }) => {
  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      backgroundColor: showSky ? '#87CEEB' : '#000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: '12px'
    }}>
      {/* This is a placeholder for the 3D scene */}
      3D Viewport Placeholder
    </div>
  );
};

export default Scene3D;
