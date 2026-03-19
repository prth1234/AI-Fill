import React from 'react';
import './GradientText.css';

export default function GradientText({
  children,
  className = '',
  colors = ['#5227FF', '#FF9FFC', '#B19EEF'], // Default colors
  animationSpeed = 8,
}) {
  // Join colors for the CSS gradient
  const gradientColors = [...colors, colors[0]].join(', ');

  return (
    <div 
      className={`animated-gradient-text ${className}`}
      style={{
        '--gradient-colors': gradientColors,
        '--animation-duration': `${animationSpeed}s`,
      }}
    >
      <span className="text-content">
        {children}
      </span>
    </div>
  );
}
