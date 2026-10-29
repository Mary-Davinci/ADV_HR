/**
 * Pannello di accesso: al centro il marchio di Accademia Da Vinci stilizzato
 * (D gialla con l'Uomo Vitruviano nelle due pose di Leonardo) in un medaglione
 * avorio, attorno la geometria vitruviana (cerchio e quadrato con base comune)
 * animata con un effetto "tecnologico": scala graduata e cerchi in rotazione,
 * un fascio di luce che percorre il cerchio, un punto in orbita, assi con un
 * flusso di trattini. Sotto, il nome dell'app. Tutto vettoriale.
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
// Medaglione: il marchio è disegnato in un riquadro 300×300 centrato su (152, 150).
const MEDAL_R = 165;
const MEDAL_SCALE = MEDAL_R / 140;

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
        <linearGradient id="login-yellow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f7c843" />
          <stop offset="100%" stopColor="#e3a414" />
        </linearGradient>
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

      {/* Medaglione con il marchio */}
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
      <g transform={`translate(${CX} ${CY}) scale(${MEDAL_SCALE.toFixed(3)}) translate(-152 -150)`}>
        <circle cx="152" cy="150" r="140" fill="url(#login-disc)" stroke="#c9a24a" strokeWidth="2" />
        <circle cx="152" cy="150" r="133" fill="none" stroke="#c9a24a" strokeOpacity="0.5" strokeWidth="0.8" />
        <g transform="translate(152 150) scale(0.86) translate(-152 -150)">
          <path
            fill="url(#login-yellow)"
            fillRule="evenodd"
            d="M40 40 H150 C220 40 262 92 262 150 C262 208 220 260 150 260 H40 V246 H62 V54 H40 Z M106 74 H148 C196 74 222 108 222 150 C222 192 196 226 148 226 H106 Z"
          />
          {/* Uomo Vitruviano: posa principale piena, seconda posa più leggera */}
          <g fill="#2b2418">
            <circle cx="152" cy="63" r="11.5" />
            <path d="M147 73 H157 V82 H147 Z" />
            <path d="M131 89 Q152 80 173 89 Q172 100 169 108 Q165 124 164 141 Q152 148 140 141 Q139 124 135 108 Q132 100 131 89 Z" />
          </g>
          <g fill="none" stroke="#2b2418" strokeLinecap="round">
            <path d="M135 91 L95 94" strokeWidth="7" />
            <path d="M95 94 L48 97" strokeWidth="4.5" />
            <path d="M169 91 L209 94" strokeWidth="7" />
            <path d="M209 94 L256 97" strokeWidth="4.5" />
            <path d="M146 141 L144 196" strokeWidth="9" />
            <path d="M144 196 L142 252" strokeWidth="5.5" />
            <path d="M158 141 L160 196" strokeWidth="9" />
            <path d="M160 196 L162 252" strokeWidth="5.5" />
            <g strokeOpacity="0.45">
              <path d="M136 89 L100 72 L60 55" strokeWidth="3.5" />
              <path d="M168 89 L204 72 L244 55" strokeWidth="3.5" />
              <path d="M145 141 L124 194 L102 246" strokeWidth="4" />
              <path d="M159 141 L180 194 L202 246" strokeWidth="4" />
            </g>
          </g>
        </g>
      </g>

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
