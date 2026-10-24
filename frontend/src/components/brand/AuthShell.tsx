import type { ReactNode } from 'react';
import Logo from './Logo';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

const highlights = [
  { k: 'Tabla 1', v: 'Descriptivos listos para publicar' },
  { k: 'Kaplan-Meier', v: 'Supervivencia con IC al 95 %' },
  { k: 'eCRF', v: 'Captura de datos estructurada' },
];

// Ilustración: curvas de supervivencia con IC al 95 % sobre papel milimetrado.
// Los datos son simulados y solo tienen fines decorativos.
function SurvivalIllustration() {
  return (
    <figure className="ms-auth-figure">
      <figcaption className="ms-auth-figure-head">
        <span className="ms-auth-figure-title">Supervivencia global</span>
        <span className="ms-auth-figure-tag">Datos simulados</span>
      </figcaption>

      <svg
        viewBox="0 0 480 280"
        className="ms-auth-chart"
        role="img"
        aria-label="Gráfica ilustrativa con datos simulados: la curva del grupo tratamiento se mantiene por encima de la del grupo control durante 48 meses."
      >
        {/* Líneas guía horizontales */}
        <g stroke="rgba(255,252,242,0.08)" strokeWidth="1">
          <line x1="52" x2="452" y1="16" y2="16" />
          <line x1="52" x2="452" y1="88" y2="88" />
          <line x1="52" x2="452" y1="160" y2="160" />
        </g>

        {/* Ejes */}
        <path d="M52 16V232H452" stroke="rgba(255,252,242,0.35)" strokeWidth="1.5" fill="none" />

        {/* Marcas y títulos de ejes */}
        <g fill="rgba(255,252,242,0.5)" fontSize="11" fontFamily="JetBrains Mono, monospace">
          {[['1.0', 16], ['0.8', 88], ['0.6', 160], ['0.4', 232]].map(([label, y]) => (
            <text key={label} x="44" y={Number(y) + 4} textAnchor="end">{label}</text>
          ))}
          {[0, 12, 24, 36, 48].map((m, i) => (
            <text key={m} x={52 + i * 100} y="250" textAnchor="middle">{m}</text>
          ))}
        </g>
        <g fill="rgba(255,252,242,0.5)" fontSize="11" fontFamily="Manrope, sans-serif" fontWeight="600">
          <text x="252" y="272" textAnchor="middle">Meses desde la inclusión</text>
          <text transform="translate(12 124) rotate(-90)" textAnchor="middle">Probabilidad</text>
        </g>

        {/* Intervalos de confianza al 95 % */}
        <path
          className="ms-band ms-band-late"
          fill="rgba(204,197,185,0.16)"
          d="M52.0 16.0 L93.7 16.0 L93.7 33.3 L127.0 33.3 L127.0 51.6 L168.7 51.6 L168.7 73.9 L210.3 73.9 L210.3 96.4 L252.0 96.4 L252.0 119.1 L293.7 119.1 L293.7 138.2 L343.7 138.2 L343.7 153.8 L393.7 153.8 L393.7 165.9 L452.0 165.9 L452.0 174.4 L452.0 224.8 L452.0 211.7 L393.7 211.7 L393.7 195.0 L343.7 195.0 L343.7 174.6 L293.7 174.6 L293.7 150.5 L252.0 150.5 L252.0 122.8 L210.3 122.8 L210.3 94.9 L168.7 94.9 L168.7 66.8 L127.0 66.8 L127.0 41.9 L93.7 41.9 L93.7 16.0 L52.0 16.0 Z"
        />
        <path
          className="ms-band"
          fill="rgba(235,94,40,0.2)"
          d="M52.0 16.0 L93.7 16.0 L93.7 23.1 L127.0 23.1 L127.0 31.1 L168.7 31.1 L168.7 43.0 L210.3 43.0 L210.3 55.1 L252.0 55.1 L252.0 67.3 L293.7 67.3 L293.7 79.6 L343.7 79.6 L343.7 88.3 L393.7 88.3 L393.7 97.1 L452.0 97.1 L452.0 102.4 L452.0 145.6 L452.0 136.5 L393.7 136.5 L393.7 123.7 L343.7 123.7 L343.7 110.8 L293.7 110.8 L293.7 94.3 L252.0 94.3 L252.0 77.7 L210.3 77.7 L210.3 61.0 L168.7 61.0 L168.7 44.1 L127.0 44.1 L127.0 30.5 L93.7 30.5 L93.7 16.0 L52.0 16.0 Z"
        />

        {/* Curvas (pathLength=1 hace que la animación no dependa de la longitud real) */}
        <path
          className="ms-draw ms-draw-late"
          pathLength={1}
          stroke="#CCC5B9"
          strokeWidth="2.5"
          fill="none"
          strokeLinejoin="round"
          d="M52.0 16.0 L93.7 16.0 L93.7 37.6 L127.0 37.6 L127.0 59.2 L168.7 59.2 L168.7 84.4 L210.3 84.4 L210.3 109.6 L252.0 109.6 L252.0 134.8 L293.7 134.8 L293.7 156.4 L343.7 156.4 L343.7 174.4 L393.7 174.4 L393.7 188.8 L452.0 188.8 L452.0 199.6"
        />
        <path
          className="ms-draw"
          pathLength={1}
          stroke="#EB5E28"
          strokeWidth="2.75"
          fill="none"
          strokeLinejoin="round"
          d="M52.0 16.0 L93.7 16.0 L93.7 26.8 L127.0 26.8 L127.0 37.6 L168.7 37.6 L168.7 52.0 L210.3 52.0 L210.3 66.4 L252.0 66.4 L252.0 80.8 L293.7 80.8 L293.7 95.2 L343.7 95.2 L343.7 106.0 L393.7 106.0 L393.7 116.8 L452.0 116.8 L452.0 124.0"
        />

        {/* Marcas de censura */}
        <g className="ms-band" stroke="#EB5E28" strokeWidth="2">
          {[[143.7, 37.6], [235.3, 66.4], [327.0, 95.2], [418.7, 116.8]].map(([x, y]) => (
            <path key={`a${x}`} d={`M${x} ${y - 6}V${y + 6}`} />
          ))}
        </g>
        <g className="ms-band ms-band-late" stroke="#CCC5B9" strokeWidth="2">
          {[[110.3, 37.6], [185.3, 84.4], [277.0, 134.8], [368.7, 174.4]].map(([x, y]) => (
            <path key={`b${x}`} d={`M${x} ${y - 6}V${y + 6}`} />
          ))}
        </g>
      </svg>

      <div className="ms-auth-figure-foot">
        <div className="ms-auth-legend">
          <span className="ms-auth-legend-item"><i className="ms-auth-swatch is-accent" /> Tratamiento</span>
          <span className="ms-auth-legend-item"><i className="ms-auth-swatch is-muted" /> Control</span>
        </div>
        <span className="ms-auth-stat">log-rank <em>p</em> = 0.003</span>
      </div>
    </figure>
  );
}

export default function AuthShell({ eyebrow, title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="ms-auth">
      <aside className="ms-auth-art" aria-label="Sobre MedStats Studio">
        <div className="ms-auth-art-logo">
          <Logo variant="light" />
        </div>

        <div className="ms-auth-art-body slide-up">
          <h2 className="ms-auth-headline ms-display">
            De la hoja de datos al resultado <em>publicable</em>.
          </h2>
          <p className="ms-auth-lede">
            Estadística rigurosa, explicada en lenguaje clínico y con código reproducible en R.
          </p>
          <SurvivalIllustration />
        </div>

        <ul className="ms-auth-highlights">
          {highlights.map(h => (
            <li key={h.k} className="ms-auth-highlight">
              <div className="ms-auth-highlight-k">{h.k}</div>
              <div className="ms-auth-highlight-v">{h.v}</div>
            </li>
          ))}
        </ul>
      </aside>

      <main className="ms-auth-stage">
        <div className="ms-auth-card slide-up">
          <div className="ms-auth-mobile-logo">
            <Logo />
          </div>

          <header className="ms-auth-header">
            <div className="ms-eyebrow">{eyebrow}</div>
            <h1 className="ms-page-title ms-auth-title">{title}</h1>
            <p className="ms-page-subtitle ms-auth-subtitle">{subtitle}</p>
          </header>

          {children}

          {footer && <div className="ms-auth-footer">{footer}</div>}
        </div>

        <p className="ms-auth-disclaimer">
          Herramienta de apoyo a la investigación. No sustituye el criterio clínico.
        </p>
      </main>
    </div>
  );
}
