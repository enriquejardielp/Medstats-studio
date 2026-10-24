interface LogoProps {
  size?: number;
  variant?: 'light' | 'dark';
  showText?: boolean;
}

// Marca de MedStats: gráfico de tendencia y barras en una paleta serena.
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="#58796F" />
      <path d="M7 23.5h18" stroke="#DDE8E2" strokeWidth="1.35" strokeLinecap="round" opacity=".8" />
      <rect x="8" y="16" width="3.2" height="7.5" rx="1.4" fill="#E7EFEB" opacity=".75" />
      <rect x="14.4" y="11.5" width="3.2" height="12" rx="1.4" fill="#E7EFEB" opacity=".88" />
      <rect x="20.8" y="7.5" width="3.2" height="16" rx="1.4" fill="#FFFFFF" />
      <path d="m8.5 13.5 6-4 6.2 1.5 3-3" stroke="#B8D0C5" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23.7" cy="8" r="1.65" fill="#F7F8F6" />
    </svg>
  );
}

export default function Logo({ size = 36, variant = 'dark', showText = true }: LogoProps) {
  const textColor = variant === 'light' ? '#FFFFFF' : 'var(--color-ink)';
  const subColor = variant === 'light' ? '#D6E0DB' : 'var(--color-text-secondary)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
      <LogoMark size={size} />
      {showText && (
        <div style={{ lineHeight: 1 }}>
          <div className="ms-display" style={{ fontSize: '1.2rem', color: textColor }}>MedStats</div>
          <div style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: subColor, marginTop: '0.3rem' }}>
            Studio
          </div>
        </div>
      )}
    </div>
  );
}
