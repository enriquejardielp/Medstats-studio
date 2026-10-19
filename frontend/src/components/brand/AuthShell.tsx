import type { ReactNode } from 'react';
import Logo from './Logo';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

const highlights = [
  { k: 'Tabla 1', v: 'Descriptivos listos para publicar' },
  { k: 'Kaplan-Meier', v: 'Supervivencia con IC al 95 %' },
  { k: 'eCRF', v: 'Captura de datos estructurada' },
];

// Ilustración: curvas de supervivencia sobre una rejilla de papel milimetrado
function SurvivalIllustration() {
  return (
    <svg viewBox="0 0 480 300" style={{ width: '100%', height: 'auto' }} aria-hidden="true">
      <defs>
        <pattern id="ms-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        </pattern>
        <linearGradient id="ms-band" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3fc1b3" stopOpacity="0.28" />
          <stop offset="1" stopColor="#3fc1b3" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="480" height="300" fill="url(#ms-grid)" />
      <path d="M40 30V260H460" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" fill="none" />
      {[0, 1, 2, 3, 4].map(i => (
        <text key={i} x={40 + i * 100} y={280} fill="rgba(255,255,255,0.35)" fontSize="11" fontFamily="JetBrains Mono, monospace" textAnchor="middle">
          {i * 12}
        </text>
      ))}
      <path d="M40 40H96V58H150V84H210V104H270V136H330V150H392V170H460V260H40Z" fill="url(#ms-band)" />
      <path className="ms-draw" d="M40 40H96V58H150V84H210V104H270V136H330V150H392V170H460" stroke="#3fc1b3" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
      <path className="ms-draw ms-draw-late" d="M40 40H80V72H128V110H176V140H236V176H300V200H368V214H460" stroke="#e8775a" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
      {[[150, 84], [270, 136], [392, 170]].map(([x, y]) => (
        <path key={`${x}`} d={`M${x} ${y - 6}V${y + 6}`} stroke="#3fc1b3" strokeWidth="2" />
      ))}
      <g fontFamily="Manrope, sans-serif" fontSize="12" fontWeight="600">
        <circle cx="330" cy="40" r="4" fill="#3fc1b3" />
        <text x="342" y="44" fill="rgba(255,255,255,0.8)">Tratamiento</text>
        <circle cx="330" cy="62" r="4" fill="#e8775a" />
        <text x="342" y="66" fill="rgba(255,255,255,0.8)">Control</text>
      </g>
      <text x="252" y="232" fill="rgba(255,255,255,0.55)" fontSize="12" fontFamily="JetBrains Mono, monospace">log-rank p = 0.003</text>
    </svg>
  );
}

export default function AuthShell({ eyebrow, title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="ms-auth">
      <style>{`
        .ms-auth { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); background: var(--color-bg); }
        .ms-auth-art {
          position: relative; overflow: hidden; color: white;
          background: radial-gradient(120% 80% at 0% 0%, #1d4552 0%, transparent 60%),
                      radial-gradient(90% 70% at 100% 100%, #3a2a2a 0%, transparent 55%),
                      var(--color-ink);
          padding: 2.5rem 3rem; display: flex; flex-direction: column; justify-content: space-between; gap: 2rem;
        }
        .ms-auth-form { display: flex; align-items: center; justify-content: center; padding: 2.5rem 1.5rem; }
        .ms-auth-card { width: 100%; max-width: 25rem; }
        .ms-draw { stroke-dasharray: 900; stroke-dashoffset: 900; animation: ms-draw 2.2s cubic-bezier(0.4, 0, 0.2, 1) forwards 0.3s; }
        .ms-draw-late { animation-delay: 0.7s; }
        @keyframes ms-draw { to { stroke-dashoffset: 0; } }
        @media (max-width: 900px) {
          .ms-auth { grid-template-columns: 1fr; }
          .ms-auth-art { display: none; }
          .ms-auth-mobile-logo { display: flex !important; }
        }
      `}</style>

      <aside className="ms-auth-art">
        <Logo variant="light" />
        <div className="slide-up">
          <h2 className="ms-display" style={{ fontSize: 'clamp(2rem, 3.2vw, 2.9rem)', lineHeight: 1.08, maxWidth: '30rem' }}>
            De la hoja de datos al resultado <em style={{ color: '#3fc1b3' }}>publicable</em>.
          </h2>
          <p style={{ marginTop: '1rem', color: 'rgba(255,255,255,0.65)', maxWidth: '28rem', lineHeight: 1.6 }}>
            Estadística rigurosa, explicada en lenguaje clínico y con código reproducible en R.
          </p>
          <div style={{ marginTop: '2rem', maxWidth: '32rem' }}>
            <SurvivalIllustration />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '1.5rem' }}>
          {highlights.map(h => (
            <div key={h.k}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{h.k}</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', marginTop: '0.25rem', lineHeight: 1.45 }}>{h.v}</div>
            </div>
          ))}
        </div>
      </aside>

      <main className="ms-auth-form">
        <div className="ms-auth-card slide-up">
          <div className="ms-auth-mobile-logo" style={{ display: 'none', marginBottom: '2.5rem' }}>
            <Logo />
          </div>
          <div className="ms-eyebrow">{eyebrow}</div>
          <h1 className="ms-page-title" style={{ fontSize: '2.4rem' }}>{title}</h1>
          <p className="ms-page-subtitle">{subtitle}</p>
          <div style={{ marginTop: '2rem' }}>{children}</div>
          <div style={{ marginTop: '2rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)', textAlign: 'center' }}>{footer}</div>
        </div>
      </main>
    </div>
  );
}
