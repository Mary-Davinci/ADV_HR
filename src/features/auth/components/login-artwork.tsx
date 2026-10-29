/**
 * Pannello di accesso: al centro il logo ufficiale di Accademia Da Vinci in un
 * medaglione avorio (il logo è pensato per fondo chiaro), attorno la geometria
 * vitruviana (cerchio e quadrato con base comune) animata con un effetto
 * "tecnologico": scala graduata e cerchi in rotazione, un fascio di luce che
 * percorre il cerchio, un punto in orbita, assi con un flusso di trattini.
 * Sotto, il nome dell'app.
 *
 * Con "riduci animazioni" attivo nel sistema il disegno resta fermo.
 * Il font del nome arriva dalla variabile `--font-display` impostata dalla pagina.
 */

// Leonardo: il raggio del cerchio è ~0,607 volte il lato del quadrato; i due
// condividono la base. Centro del cerchio = ombelico.
const CX = 400;
const CY = 380;
const R = 250;
const SIDE = Math.round(R / 0.607);
const SQUARE_X = CX - SIDE / 2;
const SQUARE_Y = CY + R - SIDE;
// Scala graduata: un trattino ogni 5° su un cerchio appena più grande.
const TICK_R = R + 8;
const TICK_GAP = (2 * Math.PI * TICK_R) / 72 - 1;
// Fascio di luce: un arco di ~25° che percorre il cerchio.
const SWEEP_LENGTH = (2 * Math.PI * R * 25) / 360;
const SWEEP_GAP = 2 * Math.PI * R - SWEEP_LENGTH;
// Medaglione con il logo ufficiale (public/brand, 973×348 px con trasparenza).
const MEDAL_R = 175;
const LOGO_W = 272;
const LOGO_H = Math.round((LOGO_W * 348) / 973);

const CSS = `
.la-spin, .la-spin-rev, .la-sweep, .la-orbit {
  transform-box: view-box;
  transform-origin: ${CX}px ${CY}px;
}
.la-spin { animation: la-rotate 120s linear infinite; }
.la-spin-rev { animation: la-rotate 70s linear infinite reverse; }
.la-sweep { animation: la-rotate 7s linear infinite; }
.la-orbit { animation: la-rotate 18s linear infinite reverse; }
.la-flow { animation: la-flow 3s linear infinite; }
.la-pulse { animation: la-pulse 4s ease-in-out infinite alternate; }
@keyframes la-rotate { to { transform: rotate(360deg); } }
@keyframes la-flow { to { stroke-dashoffset: -32; } }
@keyframes la-pulse { from { opacity: 0.35; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .la-spin, .la-spin-rev, .la-sweep, .la-orbit, .la-flow, .la-pulse { animation: none; }
  .la-sweep { opacity: 0; }
}
`;

export function LoginArtwork() {
  return (
    <svg
      role="img"
      aria-label="ADV HR – Accademia Da Vinci"
      className="absolute inset-0 size-full"
      viewBox="0 0 800 900"
      preserveAspectRatio="xMidYMid slice"
    >
      <style>{CSS}</style>
      <defs>
        <radialGradient id="login-glow" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="#2a2318" />
          <stop offset="100%" stopColor="#17140f" />
        </radialGradient>
        <radialGradient id="login-disc" cx="45%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#fbf7ee" />
          <stop offset="100%" stopColor="#eee4cf" />
        </radialGradient>
        <filter id="login-neon" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="800" height="900" fill="url(#login-glow)" />

      {/* Geometria vitruviana */}
      <g fill="none" stroke="#c9a24a">
        <circle cx={CX} cy={CY} r={R} strokeWidth="1.2" strokeOpacity="0.55" />
        <circle
          className="la-spin"
          cx={CX}
          cy={CY}
          r={TICK_R}
          strokeWidth="10"
          strokeOpacity="0.35"
          strokeDasharray={`1 ${TICK_GAP.toFixed(2)}`}
        />
        <circle
          className="la-spin-rev"
          cx={CX}
          cy={CY}
          r={MEDAL_R + 40}
          strokeWidth="1"
          strokeOpacity="0.4"
          strokeDasharray="2 8"
        />
        <rect x={SQUARE_X} y={SQUARE_Y} width={SIDE} height={SIDE} strokeWidth="1.2" strokeOpacity="0.42" />
        <g className="la-flow" strokeWidth="0.9" strokeOpacity="0.35" strokeDasharray="10 22">
          <line x1={CX} y1={CY - R - 70} x2={CX} y2={CY - MEDAL_R} />
          <line x1={CX} y1={CY + MEDAL_R} x2={CX} y2={CY + R + 30} />
          <line x1={CX - R - 60} y1={CY} x2={CX - MEDAL_R} y2={CY} />
          <line x1={CX + MEDAL_R} y1={CY} x2={CX + R + 60} y2={CY} />
        </g>
        <line
          x1={SQUARE_X}
          y1={SQUARE_Y}
          x2={SQUARE_X + SIDE}
          y2={SQUARE_Y + SIDE}
          strokeWidth="0.6"
          strokeOpacity="0.16"
        />
        <line
          x1={SQUARE_X + SIDE}
          y1={SQUARE_Y}
          x2={SQUARE_X}
          y2={SQUARE_Y + SIDE}
          strokeWidth="0.6"
          strokeOpacity="0.16"
        />
      </g>
      <circle cx={CX} cy={CY + R} r="3" fill="#c9a24a" fillOpacity="0.7" />

      {/* Fascio di luce sul cerchio e punto in orbita */}
      <circle
        className="la-sweep"
        cx={CX}
        cy={CY}
        r={R}
        fill="none"
        stroke="#f3d27a"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={`${SWEEP_LENGTH.toFixed(1)} ${SWEEP_GAP.toFixed(1)}`}
        filter="url(#login-neon)"
      />
      <g className="la-orbit">
        <circle cx={CX} cy={CY - MEDAL_R - 40} r="3.5" fill="#f7c843" filter="url(#login-neon)" />
      </g>

      {/* Medaglione con il logo */}
      <circle
        className="la-pulse"
        cx={CX}
        cy={CY}
        r={MEDAL_R + 6}
        fill="none"
        stroke="#f3d27a"
        strokeWidth="2"
        filter="url(#login-neon)"
      />
      <circle cx={CX} cy={CY} r={MEDAL_R} fill="url(#login-disc)" stroke="#c9a24a" strokeWidth="2" />
      <circle cx={CX} cy={CY} r={MEDAL_R - 9} fill="none" stroke="#c9a24a" strokeOpacity="0.5" strokeWidth="0.8" />
      <image
        href="/brand/accademia-da-vinci-logo.png"
        x={CX - LOGO_W / 2}
        y={CY - LOGO_H / 2}
        width={LOGO_W}
        height={LOGO_H}
      />

      <text
        x={CX}
        y="742"
        textAnchor="middle"
        fill="#f3ede0"
        fontSize="64"
        fontWeight="500"
        letterSpacing="12"
        style={{ fontFamily: "var(--font-display), Georgia, serif" }}
      >
        ADV HR
      </text>
      <line x1={CX - 30} y1="772" x2={CX + 30} y2="772" stroke="#c9a24a" strokeWidth="1.2" />
    </svg>
  );
}
