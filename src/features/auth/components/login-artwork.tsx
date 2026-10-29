/**
 * Sfondo del pannello di accesso: la geometria dell'Uomo Vitruviano (cerchio e
 * quadrato con le proporzioni di Leonardo) a tratto dorato su fondo avorio.
 * Vettoriale: resta nitido a qualsiasi risoluzione, al posto della vecchia foto
 * a 640 px che, ingrandita a metà schermo, risultava sfocata.
 */

// Leonardo: il raggio del cerchio è ~0,607 volte il lato del quadrato; i due
// condividono la base. Centro del cerchio = ombelico.
// Spostata a destra e in parte fuori dal bordo: a sinistra resta spazio per il testo.
const CX = 640;
const CY = 430;
const R = 320;
const SIDE = Math.round(R / 0.607);
const SQUARE_X = CX - SIDE / 2;
const SQUARE_Y = CY + R - SIDE;

const TICKS = Array.from({ length: 72 }, (_, index) => {
  const angle = (index * 5 * Math.PI) / 180;
  const length = index % 6 === 0 ? 16 : 7;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x1: CX + cos * R,
    y1: CY + sin * R,
    x2: CX + cos * (R + length),
    y2: CY + sin * (R + length),
    major: index % 6 === 0,
  };
});

export function LoginArtwork() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 size-full"
      viewBox="0 0 800 1000"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="login-glow" cx="78%" cy="18%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#f7f3ea" />
          <stop offset="100%" stopColor="#efe9dd" />
        </radialGradient>
        <linearGradient id="login-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d8b45a" />
          <stop offset="100%" stopColor="#8a6a1f" />
        </linearGradient>
        <linearGradient id="login-streak" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c9a24a" stopOpacity="0" />
          <stop offset="55%" stopColor="#d8b45a" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#c9a24a" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="800" height="1000" fill="url(#login-glow)" />

      <g fill="none" stroke="url(#login-gold)">
        {/* Cerchio e quadrato vitruviani */}
        <circle cx={CX} cy={CY} r={R} strokeWidth="1.25" strokeOpacity="0.55" />
        <rect x={SQUARE_X} y={SQUARE_Y} width={SIDE} height={SIDE} strokeWidth="1.25" strokeOpacity="0.45" />

        {/* Studi di proporzione: cerchio interno, assi e diagonali */}
        <circle cx={CX} cy={CY} r={R * 0.62} strokeWidth="0.75" strokeOpacity="0.3" strokeDasharray="2 6" />
        <line x1={CX} y1={CY - R - 60} x2={CX} y2={CY + R + 40} strokeWidth="0.75" strokeOpacity="0.28" />
        <line x1={CX - R - 60} y1={CY} x2={CX + R + 60} y2={CY} strokeWidth="0.75" strokeOpacity="0.28" />
        <line
          x1={SQUARE_X}
          y1={SQUARE_Y}
          x2={SQUARE_X + SIDE}
          y2={SQUARE_Y + SIDE}
          strokeWidth="0.75"
          strokeOpacity="0.18"
        />
        <line
          x1={SQUARE_X + SIDE}
          y1={SQUARE_Y}
          x2={SQUARE_X}
          y2={SQUARE_Y + SIDE}
          strokeWidth="0.75"
          strokeOpacity="0.18"
        />

        {/* Scala graduata sul cerchio */}
        {TICKS.map(({ major, ...tick }, index) => (
          <line key={index} {...tick} strokeWidth={major ? 1 : 0.6} strokeOpacity={major ? 0.5 : 0.3} />
        ))}
      </g>

      {/* Punti di riferimento: centro (ombelico) e base comune */}
      <circle cx={CX} cy={CY} r="3" fill="#b08a30" fillOpacity="0.6" />
      <circle cx={CX} cy={CY + R} r="2.5" fill="#b08a30" fillOpacity="0.5" />

      {/* Scie dorate */}
      <g fill="none" stroke="url(#login-streak)" strokeLinecap="round">
        <path d="M120 960 C 320 900, 460 990, 620 900 S 820 790, 860 740" strokeWidth="2" strokeOpacity="0.9" />
        <path d="M140 990 C 340 930, 480 1010, 650 925 S 840 825, 870 775" strokeWidth="1.25" strokeOpacity="0.6" />
        <path d="M100 930 C 300 870, 440 965, 590 875 S 800 760, 850 705" strokeWidth="1" strokeOpacity="0.45" />
      </g>
    </svg>
  );
}
