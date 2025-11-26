import React from 'react';

interface VisualizerProps {
  active: boolean;
  label?: string;
}

export const Visualizer: React.FC<VisualizerProps> = ({ active, label }) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div className="flex items-end justify-center h-12 space-x-1 space-x-reverse">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={`w-2 bg-emerald-400 rounded-t-sm transition-all duration-150 ease-in-out ${
              active ? 'animate-pulse' : 'h-1 opacity-30'
            }`}
            style={{
              height: active ? `${Math.random() * 100}%` : '4px',
              animationDelay: `${i * 0.1}s`
            }}
          />
        ))}
      </div>
      {label && <span className="text-xs text-emerald-200 font-medium">{label}</span>}
    </div>
  );
};