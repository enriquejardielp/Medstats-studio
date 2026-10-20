interface LogoProps {
  size?: number;
  variant?: 'light' | 'dark';
  showText?: boolean;
}

// Marca de MedStats: curva escalonada tipo Kaplan-Meier sobre unos ejes
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#252422" />
      <path d="M7 9v14h18" stroke="#CCC5B9" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M8 11h4v3h4v4h3v2h5" stroke="#EB5E28" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="20" r="1.8" fill="#EB5E28" />
    </svg>
  );
}

export default function Logo({ size = 36, variant = 'dark', showText = true }: LogoProps) {
  const textColor = variant === 'light' ? '#FFFFFF' : 'var(--color-ink)';
  const subColor = variant === 'light' ? '#CCC5B9' : 'var(--color-text-secondary)';
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
