import re

svg_template = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#0284C7"/>
    </linearGradient>

    <filter id="carShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.4"/>
    </filter>

    <clipPath id="iconClip">
      <rect width="256" height="256" rx="56"/>
    </clipPath>

    <style>
      /* Infinite subtle driving sense */
      @keyframes roadMove {
        0% { stroke-dashoffset: 0; }
        100% { stroke-dashoffset: -64; }
      }
      .road-dash {
        animation: roadMove 4s infinite linear;
      }
    </style>
  </defs>

  <g clip-path="url(#iconClip)">
    <rect width="256" height="256" rx="56" fill="url(#bgGrad)"/>
    
    <!-- Scenic S-Curve Highway -->
    <path d="M 128 -20 Q 180 64 128 128 T 128 276" fill="none" stroke="#0F172A" stroke-width="50" stroke-linecap="round" opacity="0.2"/>
    <path d="M 128 -20 Q 180 64 128 128 T 128 276" fill="none" class="road-dash" stroke="#FFFFFF" stroke-dasharray="16 16" stroke-width="4" opacity="0.4" />

    <!-- Standard Traffic Car smoothly passing -->
    <g>
      <animateMotion path="M 128 276 Q 76 192 128 128 T 128 -20" rotate="auto" begin="0s" dur="6s" keyTimes="0; 1" keyPoints="0; 1" calcMode="linear" repeatCount="indefinite" />
      <rect x="-16" y="-12" width="32" height="24" rx="6" fill="#94A3B8" filter="url(#carShadow)"/>
      <path d="M 2 -9 L 8 -7 L 8 7 L 2 9 Z" fill="#0F172A" opacity="0.8"/>
      <path d="M -12 -7 L -8 -6 L -8 6 L -12 7 Z" fill="#0F172A" opacity="0.8"/>
      <circle cx="14" cy="-8" r="3" fill="#FEF08A" opacity="0.5"/>
      <circle cx="14" cy="8" r="3" fill="#FEF08A" opacity="0.5"/>
      <rect x="-16" y="-9" width="3" height="4" rx="1" fill="#EF4444" opacity="0.8"/>
      <rect x="-16" y="5" width="3" height="4" rx="1" fill="#EF4444" opacity="0.8"/>
    </g>
  </g>
</svg>
"""

with open('scratch/middle_logo_slower.svg', 'w') as f:
    f.write(svg_template)

print("Generated scratch/middle_logo_slower.svg")
