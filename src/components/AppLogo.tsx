import React from 'react';

const AppLogo: React.FC<React.SVGProps<SVGSVGElement>> = ({ className, ...props }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      fill="none"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="cube_grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="cube_top" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="15" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Main Cube Shape */}
      <path 
        d="M128 232L48 186V94L128 48L208 94V186L128 232Z" 
        fill="url(#cube_grad)" 
        stroke="#1e40af" 
        strokeWidth="4" 
        strokeLinejoin="round"
      />
      
      {/* Top Face */}
      <path 
        d="M128 48L208 94L128 140L48 94L128 48Z" 
        fill="url(#cube_top)" 
        stroke="#60a5fa" 
        strokeWidth="2"
      />
      
      {/* Inner Structure (The Borg Complexity) */}
      <path 
        d="M128 140V232" 
        stroke="#1e3a8a" 
        strokeWidth="4" 
        opacity="0.3"
      />
      <path 
        d="M128 140L208 186" 
        stroke="#1e3a8a" 
        strokeWidth="2" 
        opacity="0.3"
      />
      <path 
        d="M128 140L48 186" 
        stroke="#1e3a8a" 
        strokeWidth="2" 
        opacity="0.3"
      />

      {/* Glowing Core / W (WinBorg) Abstract */}
      <path 
        d="M96 110L128 128L160 110" 
        stroke="white" 
        strokeWidth="6" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        opacity="0.9"
      />
      <path 
        d="M128 128V160" 
        stroke="white" 
        strokeWidth="6" 
        strokeLinecap="round"
        opacity="0.7"
      />
      
      {/* Tech Accents */}
      <circle cx="128" cy="128" r="4" fill="white" className="animate-pulse" />
      <circle cx="48" cy="94" r="3" fill="#93c5fd" />
      <circle cx="208" cy="94" r="3" fill="#93c5fd" />
      <circle cx="128" cy="232" r="3" fill="#93c5fd" />

    </svg>
  );
};

export default AppLogo;