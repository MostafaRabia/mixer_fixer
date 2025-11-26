import React from 'react';
import { 
  ArrowTrendingDownIcon, 
  ArrowTrendingUpIcon, 
  SpeakerXMarkIcon, 
  SpeakerWaveIcon, 
  BoltIcon,
  AdjustmentsHorizontalIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { InstructionState } from '../types';

interface InstructionOverlayProps {
  instruction: InstructionState | null;
}

export const InstructionOverlay: React.FC<InstructionOverlayProps> = ({ instruction }) => {
  if (!instruction) return null;

  const getIcon = (action: string) => {
    switch (action) {
      case 'reduce_echo':
      case 'reduce_treble':
      case 'reduce_gain':
        return <ArrowTrendingDownIcon className="w-16 h-16 text-yellow-400" />;
      case 'increase_echo':
      case 'increase_volume':
        return <ArrowTrendingUpIcon className="w-16 h-16 text-green-400" />;
      case 'fix_buzz':
        return <BoltIcon className="w-16 h-16 text-red-400 animate-pulse" />;
      case 'mute':
        return <SpeakerXMarkIcon className="w-16 h-16 text-red-500" />;
      case 'check_cables':
        return <AdjustmentsHorizontalIcon className="w-16 h-16 text-blue-400" />;
      case 'success':
        return <CheckCircleIcon className="w-16 h-16 text-emerald-500" />;
      default:
        return <SpeakerWaveIcon className="w-16 h-16 text-white" />;
    }
  };

  const getVisualHint = (action: string) => {
    if (action.includes('reduce')) {
      return (
        <div className="absolute top-4 right-4 animate-spin-slow-reverse opacity-80">
           {/* Visual representation of turning a knob left */}
           <div className="w-12 h-12 rounded-full border-4 border-t-yellow-400 border-r-transparent border-b-white/20 border-l-white/20"></div>
        </div>
      );
    }
    if (action.includes('increase')) {
      return (
        <div className="absolute top-4 right-4 animate-spin-slow opacity-80">
           {/* Visual representation of turning a knob right */}
           <div className="w-12 h-12 rounded-full border-4 border-t-green-400 border-r-green-400 border-b-white/20 border-l-transparent"></div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-[90%] max-w-sm z-50 pointer-events-none">
      <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl flex items-center gap-5 relative overflow-hidden animate-slide-down">
        
        {/* Animated Background Glow */}
        <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-20 
          ${instruction.action.includes('fix') ? 'bg-red-500' : 'bg-blue-500'}`} 
        />

        <div className="relative shrink-0 bg-white/10 p-3 rounded-full">
          {getIcon(instruction.action)}
        </div>
        
        <div className="flex-1">
          <h3 className="text-white font-bold text-lg leading-tight mb-1">
            توجيه المهندس
          </h3>
          <p className="text-slate-200 text-lg font-medium leading-relaxed">
            {instruction.message}
          </p>
        </div>

        {getVisualHint(instruction.action)}
      </div>
    </div>
  );
};
