import React from 'react';

/**
 * Official Emblem of India (Lion Capital of Ashoka)
 */
export const EmblemOfIndia = ({ className = '', size = 52 }) => (
  <div className={`emblem-container ${className}`} style={{ width: size, flexShrink: 0 }}>
    <img 
      src="/assets/india-emblem.png" 
      alt="Emblem of India" 
      style={{ width: '100%', height: 'auto', display: 'block', filter: 'brightness(1.1)' }} 
    />
  </div>
);

/**
 * Jago Grahak Jago Official Tricolor Leaf/Wave Logo
 */
export const JagoGrahakWave = ({ className = '', width = 54, height = 48 }) => (
  <svg 
    className={className} 
    width={width} 
    height={height} 
    viewBox="0 0 60 50" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Saffron Top Ribbon */}
    <path 
      d="M12 28C14 18 26 8 56 4C42 12 36 18 30 22C24 26 18 28 12 28Z" 
      fill="#FF9933" 
    />
    {/* White Middle Ribbon */}
    <path 
      d="M10 32C16 30 26 25 38 18C46 14 52 10 56 4C50 14 42 22 34 27C24 33 14 34 10 32Z" 
      fill="#FFFFFF" 
    />
    {/* Ashoka Chakra */}
    <circle cx="34" cy="20" r="4.5" stroke="#000080" strokeWidth="0.8" fill="none" />
    <circle cx="34" cy="20" r="1.2" fill="#000080" />
    {Array.from({ length: 12 }).map((_, i) => (
      <line
        key={i}
        x1="34"
        y1="20"
        x2={34 + 4.2 * Math.cos((i * 30 * Math.PI) / 180)}
        y2={20 + 4.2 * Math.sin((i * 30 * Math.PI) / 180)}
        stroke="#000080"
        strokeWidth="0.5"
      />
    ))}
    {/* Green Bottom Ribbon */}
    <path 
      d="M8 35C16 36 28 32 42 23C46 20 50 17 54 13C44 24 34 32 24 36C16 40 10 38 8 35Z" 
      fill="#138808" 
    />
  </svg>
);

/**
 * Official Aadhaar Sun-Fingerprint Logo
 */
export const AadhaarLogo = ({ width = 42, height = 36, className = '' }) => (
  <div className={`aadhaar-logo-wrapper ${className}`} style={{ width, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
    <svg width={width} height={height} viewBox="0 0 54 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Radiant Sun Rays */}
      <g fill="#F59E0B">
        <polygon points="27,1 29,7 25,7" />
        <polygon points="36,4 36,10 33,8" />
        <polygon points="18,4 21,8 18,10" />
        <polygon points="44,11 41,15 40,12" />
        <polygon points="10,11 14,12 13,15" />
        <polygon points="49,20 44,21 45,18" />
        <polygon points="5,20 9,18 10,21" />
      </g>
      {/* Sun Arch Background */}
      <path d="M7 26 C7 14 16 6 27 6 C38 6 47 14 47 26 Z" fill="#FBBF24" opacity="0.3" />
      
      {/* Concentric Fingerprint Arcs in Red */}
      <g stroke="#DC2626" strokeWidth="2.4" strokeLinecap="round" fill="none">
        <path d="M11 26 C11 16 18 9 27 9 C36 9 43 16 43 26" />
        <path d="M16 26 C16 19 21 14 27 14 C33 14 38 19 38 26" />
        <path d="M21 26 C21 22 24 19 27 19 C30 19 33 22 33 26" />
        <path d="M26 26 C26 25 26.5 24 27 24 C27.5 24 28 25 28 26" />
      </g>
      
      {/* Text "AADHAAR" */}
      <text 
        x="27" 
        y="38" 
        textAnchor="middle" 
        fill="#DC2626" 
        fontSize="7.5" 
        fontWeight="800" 
        letterSpacing="0.8" 
        fontFamily="'Plus Jakarta Sans', sans-serif"
      >
        AADHAAR
      </text>
    </svg>
  </div>
);

/**
 * Official DigiLocker Logo
 */
export const DigiLockerLogo = ({ width = 40, height = 40, className = '' }) => (
  <div className={`digilocker-logo-wrapper ${className}`} style={{ width, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
    <svg width={width} height={height} viewBox="0 0 54 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="digiDocGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>
      </defs>
      {/* Folded Document Base */}
      <path 
        d="M17 6 H33 L41 14 V32 C41 33.1 40.1 34 39 34 H17 C15.9 34 15 33.1 15 32 V8 C15 6.9 15.9 6 17 6 Z" 
        fill="url(#digiDocGrad)" 
      />
      {/* Folded Corner */}
      <path d="M33 6 V14 H41 Z" fill="#818CF8" />
      
      {/* Cloud Silhouette */}
      <path 
        d="M20 28 C18.9 28 18 27.1 18 26 C18 25.1 18.6 24.3 19.5 24.1 C19.4 23.8 19.3 23.4 19.3 23 C19.3 21.3 20.7 20 22.3 20 C23.1 20 23.8 20.3 24.3 20.8 C24.9 19.7 26.1 19 27.5 19 C29.4 19 31 20.6 31 22.5 C31 22.7 31 22.8 30.9 23 C31.6 23.3 32 24.1 32 25 C32 26.1 31.1 27 30 27 H20 Z" 
        fill="#FFFFFF" 
      />
      {/* Lock inside cloud */}
      <rect x="23.5" y="24" width="5" height="3.5" rx="0.6" fill="#4F46E5" />
      <path d="M24.5 24 V22.8 C24.5 22.2 25 21.6 26 21.6 C27 21.6 27.5 22.2 27.5 22.8 V24" stroke="#4F46E5" strokeWidth="0.8" fill="none" />
      
      {/* Text "DigiLocker" */}
      <text 
        x="27" 
        y="44" 
        textAnchor="middle" 
        fill="#4338CA" 
        fontSize="7.5" 
        fontWeight="700" 
        letterSpacing="0.2"
        fontFamily="'Plus Jakarta Sans', sans-serif"
      >
        DigiLocker
      </text>
    </svg>
  </div>
);
