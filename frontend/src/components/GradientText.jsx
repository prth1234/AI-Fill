import React from 'react';
import './GradientText.css';

export default function GradientText({
  children,
  className = '',
  colors = ['#5227FF', '#FF9FFC', '#B19EEF'],
  animationSpeed = 8,
  showBorder = false,
}) {
  const gradientColors = [...colors, colors[0]].join(', ');

  return (
    <div 
      className={`animated-gradient-text-container ${showBorder ? 'has-border' : ''} ${className}`}
      style={{
        '--gradient-colors': gradientColors,
        '--animation-duration': `${animationSpeed}s`,
      }}
    >
      <div className="animated-gradient-text">
        <span className="text-content">
          {children}
        </span>
      </div>
    </div>
  );
}

