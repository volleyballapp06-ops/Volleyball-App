import React from 'react';
import { Trophy, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark' | 'color';
}

export const Logo: React.FC<LogoProps> = ({ className, size = 'md', variant = 'color' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  const iconSizes = {
    sm: 14,
    md: 20,
    lg: 32,
    xl: 48
  };

  return (
    <div className={cn(
      "relative flex items-center justify-center rounded-xl overflow-hidden bg-primary shadow-lg shadow-primary/20",
      sizeClasses[size],
      className
    )}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
      
      {/* SVG Volleyball Pattern */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full opacity-10 stroke-white fill-none"
      >
        <circle cx="50" cy="50" r="45" strokeWidth="2" />
        <path d="M50 5 C 70 25, 70 75, 50 95" strokeWidth="2" />
        <path d="M5 50 C 25 30, 75 30, 95 50" strokeWidth="2" />
        <path d="M50 5 C 30 25, 30 75, 50 95" strokeWidth="2" />
        <path d="M5 50 C 25 70, 75 70, 95 50" strokeWidth="2" />
      </svg>

      {/* Main Icon */}
      <Trophy 
        size={iconSizes[size]} 
        className="relative z-10 text-white drop-shadow-md" 
        strokeWidth={2.5}
      />
      
      {/* Accent Spike */}
      <Zap 
        size={iconSizes[size] / 2} 
        className="absolute bottom-1 right-1 text-yellow-400 animate-pulse" 
        fill="currentColor"
      />
    </div>
  );
};
