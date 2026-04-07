const BASE_TIMELINE_SECONDS = 12;
const BASE_ROAD_MOVE_SECONDS = 2;
const BASE_SPOT_PULSE_SECONDS = 1.5;

const formatSeconds = (seconds) => `${Number(seconds.toFixed(3))}s`;

const BASE_SVG = String.raw`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="512" height="512">
  <defs>
    <!-- Premium Gradients -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#0284C7"/>
    </linearGradient>
    
    <linearGradient id="pinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#E2E8F0"/>
    </linearGradient>

    <linearGradient id="pGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284C7"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>

    <linearGradient id="overlay" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.2"/>
    </linearGradient>

    <!-- Shadows -->
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#000000" flood-opacity="0.3"/>
    </filter>

    <filter id="carShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
    
    <!-- Crispy shadow to give the branding text an embossed pop -->
    <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0F172A" flood-opacity="0.6"/>
    </filter>

    <clipPath id="iconClip">
      <rect width="256" height="256" rx="56"/>
    </clipPath>

    <!-- Majestic 12-second Narrative Timeline -->
    <style>
      /* Scene 1 (Scenic Highway) crossfades out seamlessly */
      @keyframes fadeScene1 {
        0%, 33.3% { opacity: 1; }
        41.6%, 95% { opacity: 0; }
        100% { opacity: 1; }
      }
      #scene1 { animation: fadeScene1 12s infinite; }

      /* Scene 2 (Parking Area) elegantly fades in exactly as the highway vanishes */
      @keyframes fadeScene2 {
        0%, 33.3% { opacity: 0; }
        41.6%, 95% { opacity: 1; }
        100% { opacity: 0; }
      }
      #scene2 { animation: fadeScene2 12s infinite; }

      /* Pin hits exactly at 8s (66.6%) */
      @keyframes pinDrop {
        0%, 64.6% { opacity: 0; transform: translateY(-40px) scale(0.8); }
        66.6% { opacity: 1; transform: translateY(0px) scale(1); }
        67.8% { transform: translateY(-6px) scale(1); }
        69% { transform: translateY(0px) scale(1); }
        95% { opacity: 1; transform: translateY(0px) scale(1); }
        100% { opacity: 0; transform: translateY(-20px) scale(0.9); }
      }
      #pin {
        transform-origin: 128px 219.5px;
        animation: pinDrop 12s infinite ease-in-out;
        opacity: 0; 
      }
      
      /* Glowing neon logo draws exactly after pin descent */
      @keyframes pDraw {
        0%, 68% { stroke-dashoffset: 120; opacity: 0; }
        69% { opacity: 1; stroke-dashoffset: 120; }
        79% { stroke-dashoffset: 0; opacity: 1; }
        95% { stroke-dashoffset: 0; opacity: 1; }
        100% { opacity: 0; }
      }
      #p-path {
        stroke-dasharray: 120;
        stroke-dashoffset: 120;
        animation: pDraw 12s infinite ease-out;
        opacity: 0;
      }

      /* Brand Text floats up seamlessly synchronized with the P drawing */
      @keyframes textReveal {
        0%, 68% { opacity: 0; transform: translateY(8px); }
        69% { opacity: 0; transform: translateY(8px); }
        79% { opacity: 1; transform: translateY(0px); }
        95% { opacity: 1; transform: translateY(0px); }
        100% { opacity: 0; transform: translateY(0px); }
      }
      #brandText {
        animation: textReveal 12s infinite ease-out;
        opacity: 0;
      }

      /* Subtle pulsing glow for target space marker */
      @keyframes spotFade {
        0%, 64.6% { opacity: 1; }
        66.6%, 100% { opacity: 0; }
      }
      #target-spot {
        animation: spotFade 12s infinite;
      }

      /* Infinite subtle driving sense */
      @keyframes roadMove {
        0% { stroke-dashoffset: 0; }
        100% { stroke-dashoffset: -64; }
      }
      .road-dash {
        animation: roadMove 2s infinite linear;
      }
    </style>
  </defs>

  <rect width="256" height="256" rx="56" fill="url(#bgGrad)"/>
  
  <g clip-path="url(#iconClip)">
    
    <!-- ============================================
         SCENE 1: Scenic S-Curve Highway
         ============================================ -->
    <g id="scene1">
      <path d="M 128 -20 Q 180 64 128 128 T 128 276" fill="none" stroke="#0F172A" stroke-width="50" stroke-linecap="round" opacity="0.2"/>
      <path d="M 128 -20 Q 180 64 128 128 T 128 276" fill="none" class="road-dash" stroke="#FFFFFF" stroke-dasharray="16 16" stroke-width="4" opacity="0.4" />

      <!-- Standard Traffic Car smoothly passing -->
      <g opacity="0">
        <animate attributeName="opacity" values="0; 1; 1; 0; 0" keyTimes="0; 0.02; 0.38; 0.40; 1" dur="12s" repeatCount="indefinite" />
        <g>
          <animateMotion path="M 128 276 Q 76 192 128 128 T 128 -20" rotate="auto" begin="0s" dur="12s" keyTimes="0; 0.041; 0.375; 1" keyPoints="0; 0; 1; 1" calcMode="spline" keySplines="0 0 1 1; 0.4 0 0.6 1; 0 0 1 1" repeatCount="indefinite" />
          <rect x="-16" y="-12" width="32" height="24" rx="6" fill="#94A3B8" filter="url(#carShadow)"/>
          <path d="M 2 -9 L 8 -7 L 8 7 L 2 9 Z" fill="#0F172A" opacity="0.8"/>
          <path d="M -12 -7 L -8 -6 L -8 6 L -12 7 Z" fill="#0F172A" opacity="0.8"/>
          <circle cx="14" cy="-8" r="3" fill="#FEF08A" opacity="0.5"/>
          <circle cx="14" cy="8" r="3" fill="#FEF08A" opacity="0.5"/>
          <rect x="-16" y="-9" width="3" height="4" rx="1" fill="#EF4444" opacity="0.8"/>
          <rect x="-16" y="5" width="3" height="4" rx="1" fill="#EF4444" opacity="0.8"/>
        </g>
      </g>
    </g>

    <!-- ============================================
         SCENE 2: The Structured Parking Zone
         ============================================ -->
    <g id="scene2">
      <!-- Asphalt driving aisle and parking bays -->
      <rect x="20" y="0" width="60" height="256" fill="#0F172A" opacity="0.15" />
      <rect x="80" y="0" width="96" height="256" fill="#0F172A" opacity="0.25" />
      <path d="M 50 320 L 50 -60" fill="none" class="road-dash" stroke="#FFFFFF" stroke-dasharray="16 16" stroke-width="2" opacity="0.4" />

      <!-- Minimalist Parking Space Lines -->
      <g stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.45">
        <line x1="176" y1="0" x2="176" y2="256" /> <!-- Back Wall Boundary -->
        <!-- Bay Dividers -->
        <line x1="80" y1="2" x2="176" y2="2" />
        <line x1="80" y1="38" x2="176" y2="38" />
        <line x1="80" y1="74" x2="176" y2="74" />
        <line x1="80" y1="110" x2="176" y2="110" />
        <line x1="80" y1="146" x2="176" y2="146" />
        <line x1="80" y1="182" x2="176" y2="182" />
        <line x1="80" y1="218" x2="176" y2="218" />
        <line x1="80" y1="254" x2="176" y2="254" />
      </g>

      <!-- Pre-Parked Vehicles defining the lot -->
      <g filter="url(#carShadow)">
        <g transform="translate(136, 20) rotate(-2)">
          <rect x="-16" y="-12" width="32" height="24" rx="4" fill="#94A3B8"/>
          <path d="M 2 -9 L 8 -7 L 8 7 L 2 9 Z" fill="#0F172A" opacity="0.8"/>
          <path d="M -12 -7 L -8 -6 L -8 6 L -12 7 Z" fill="#0F172A" opacity="0.8"/>
        </g>
        <g transform="translate(128, 92)">
          <rect x="-16" y="-12" width="32" height="24" rx="4" fill="#CBD5E1"/>
          <path d="M 2 -9 L 8 -7 L 8 7 L 2 9 Z" fill="#0F172A" opacity="0.8"/>
          <path d="M -12 -7 L -8 -6 L -8 6 L -12 7 Z" fill="#0F172A" opacity="0.8"/>
        </g>
        <g transform="translate(124, 164)">
          <rect x="-16" y="-12" width="32" height="24" rx="4" fill="#475569"/>
          <path d="M 2 -9 L 8 -7 L 8 7 L 2 9 Z" fill="#0F172A" opacity="0.8"/>
          <path d="M -12 -7 L -8 -6 L -8 6 L -12 7 Z" fill="#0F172A" opacity="0.8"/>
        </g>
        <g transform="translate(130, 236) rotate(3)">
          <rect x="-16" y="-12" width="32" height="24" rx="4" fill="#64748B"/>
          <path d="M 2 -9 L 8 -7 L 8 7 L 2 9 Z" fill="#0F172A" opacity="0.8"/>
          <path d="M -12 -7 L -8 -6 L -8 6 L -12 7 Z" fill="#0F172A" opacity="0.8"/>
        </g>
      </g>

      <!-- The Target glowing bay Marker -->
      <g id="target-spot">
        <rect x="80" y="110" width="96" height="36" fill="#10B981" opacity="0.2" />
        <rect x="84" y="114" width="88" height="28" fill="none" rx="4" stroke="#34D399" stroke-width="2" stroke-dasharray="6 4">
          <animate attributeName="opacity" values="0.3; 1; 0.3" dur="1.5s" repeatCount="indefinite" />
        </rect>
        <text x="142" y="138" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="28" fill="#10B981" opacity="0.8" text-anchor="middle">P</text>
      </g>

      <!-- The User's Hero Car -->
      <g opacity="0">
        <animate attributeName="opacity" values="0; 0; 1; 1; 0; 0" keyTimes="0; 0.40; 0.416; 0.666; 0.68; 1" dur="12s" repeatCount="indefinite" />
        <g>
          <animateMotion path="M 50 320 L 50 160 Q 50 128 82 128 L 128 128" rotate="auto" begin="0s" dur="12s" keyTimes="0; 0.416; 0.666; 1" keyPoints="0; 0; 1; 1" calcMode="spline" keySplines="0 0 1 1; 0.4 0 0.2 1; 0 0 1 1" repeatCount="indefinite" />
          <rect x="-16" y="-12" width="32" height="24" rx="6" fill="#FFFFFF" filter="url(#carShadow)"/>
          <path d="M 2 -9 L 8 -7 L 8 7 L 2 9 Z" fill="#0F172A" opacity="0.9"/>
          <path d="M -12 -7 L -8 -6 L -8 6 L -12 7 Z" fill="#0F172A" opacity="0.9"/>
          <circle cx="14" cy="-8" r="3" fill="#FEF08A"/>
          <circle cx="14" cy="8" r="3" fill="#FEF08A"/>
          <rect x="-16" y="-9" width="3" height="4" rx="1" fill="#EF4444"/>
          <rect x="-16" y="5" width="3" height="4" rx="1" fill="#EF4444"/>
        </g>
      </g>
    </g>

    <!-- Unified premium ambient sheen -->
    <rect width="256" height="256" fill="url(#overlay)"/>
  </g>

  <!-- The majestic location pin descending -->
  <g id="pin">
    <path d="M 128 44 A 64 64 0 0 0 64 108 C 64 160 120 215 124.5 219.5 C 126.5 221.5 129.5 221.5 131.5 219.5 C 136 215 192 160 192 108 A 64 64 0 0 0 128 44 Z" fill="url(#pinGrad)" filter="url(#shadow)"/>
    <path id="p-path" d="M 106 136 V 80 M 106 80 H 132 A 20 20 0 0 1 132 120 H 106" fill="none" stroke="url(#pGrad)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  </g>

  <!-- Animated Brand Name Reveal with custom complimentary startup coloring -->
  <text id="brandText" x="128" y="246" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="900" letter-spacing="1" text-anchor="middle" filter="url(#textShadow)">
    <tspan fill="#FFFFFF">Park</tspan><tspan fill="#FEF08A">Mate</tspan>
  </text>
</svg>`;

export const createParkMateAnimatedLogoSvg = (
  durationMs = BASE_TIMELINE_SECONDS * 1000,
) => {
  const durationSeconds = Math.max(durationMs / 1000, 0.1);
  const animationScale = durationSeconds / BASE_TIMELINE_SECONDS;

  return BASE_SVG
    .replaceAll(/12s/g, formatSeconds(durationSeconds))
    .replace(
      /animation: roadMove 2s infinite linear;/g,
      `animation: roadMove ${formatSeconds(BASE_ROAD_MOVE_SECONDS * animationScale)} infinite linear;`,
    )
    .replaceAll(
      /dur="1\.5s"/g,
      `dur="${formatSeconds(BASE_SPOT_PULSE_SECONDS * animationScale)}"`,
    );
};

export const createParkMateAnimatedLogoHtml = (
  durationMs = BASE_TIMELINE_SECONDS * 1000,
) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: transparent;
      }

      body {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      svg {
        width: 100%;
        height: 100%;
        display: block;
      }
    </style>
  </head>
  <body>
    ${createParkMateAnimatedLogoSvg(durationMs)}
  </body>
</html>`;
