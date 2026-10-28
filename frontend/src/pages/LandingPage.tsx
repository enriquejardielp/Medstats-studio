import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import Logo from '../components/brand/Logo';
import { ClinicalShowcase } from '../components/landing/ClinicalShowcase';
import { FormDatabaseShowcase } from '../components/landing/FormDatabaseShowcase';
import { StudioSandbox } from '../components/landing/StudioSandbox';
import { AuthModal } from '../components/auth/AuthModal';
import {
  FileSpreadsheet,
  ShieldCheck,
  ArrowRight,
  Layers,
  BarChart3,
  ClipboardList,
  Database,
  Zap,
  FileCheck,
  Lock,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Estado del modal de autenticación
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [gatedReason, setGatedReason] = useState<string | undefined>(undefined);
  const [pendingData, setPendingData] = useState<{ name: string; csvData: string; filename: string } | null>(null);

  const handleOpenAuth = (mode: 'login' | 'register', reason?: string, data?: { name: string; csvData: string; filename: string }) => {
    setAuthModalMode(mode);
    setGatedReason(reason);
    setPendingData(data || null);
    setAuthModalOpen(true);
  };

  const scrollToSandbox = () => {
    const el = document.getElementById('sandbox-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToForms = () => {
    const el = document.getElementById('forms-database-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)' }}>
      {/* ============================================================== */}
      {/* 1. NAVEGACIÓN SUPERIOR GLASSMORPHIC                            */}
      {/* ============================================================== */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: 'rgba(247, 245, 241, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div
          style={{
            maxWidth: '1240px',
            margin: '0 auto',
            padding: '0.85rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo MedStats Studio */}
          <div style={{ cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <Logo size={34} />
          </div>

          {/* Enlaces de Navegación Rápida */}
          <nav
            style={{
              display: 'none',
              alignItems: 'center',
              gap: '1.75rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
            }}
            className="md-nav-links"
          >
            <a href="#forms-database-section" style={{ textDecoration: 'none', color: 'inherit' }}>
              Formularios y Bases de Datos
            </a>
            <a href="#showcase-section" style={{ textDecoration: 'none', color: 'inherit' }}>
              Figuras Clínicas
            </a>
            <a href="#workflow-section" style={{ textDecoration: 'none', color: 'inherit' }}>
              Metodología
            </a>
            <a href="#sandbox-section" style={{ textDecoration: 'none', color: 'inherit' }}>
              Prueba tu Excel
            </a>
            <a href="#faq-section" style={{ textDecoration: 'none', color: 'inherit' }}>
              Preguntas Frecuentes
            </a>
          </nav>

          {/* Acciones de Autenticación */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isAuthenticated ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <span style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  {user?.email}
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="ms-btn ms-btn-primary ms-btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <span>Ir a mi Panel</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleOpenAuth('login')}
                  className="ms-btn ms-btn-ghost ms-btn-sm"
                  style={{ fontWeight: 600 }}
                >
                  Iniciar Sesión
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAuth('register')}
                  className="ms-btn ms-btn-primary ms-btn-sm"
                  style={{
                    boxShadow: '0 2px 8px rgba(156, 76, 46, 0.22)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>Crear Cuenta</span>
                  <ArrowRight size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. HERO SECTION ESTILO APPLE / GOOGLE DESIGN                   */}
      {/* ============================================================== */}
      <section
        style={{
          padding: 'clamp(3.5rem, 6vw, 5.5rem) 1.5rem 3rem',
          maxWidth: '1240px',
          margin: '0 auto',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Badge superior sin estrellitas */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.55rem',
            padding: '0.35rem 1rem',
            borderRadius: '9999px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--color-border)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
            marginBottom: '1.5rem',
            fontSize: '0.8125rem',
            fontWeight: 700,
            color: 'var(--color-accent)',
          }}
        >
          <span>La Suite Bioestadística para Médicos e Investigadores Clínicos</span>
        </div>

        {/* Titular Principal en Tipografía Fraunces */}
        <h1
          className="ms-display"
          style={{
            fontSize: 'clamp(2.3rem, 5vw, 4.2rem)',
            lineHeight: 1.1,
            maxWidth: '1000px',
            margin: '0 auto 1.35rem',
            color: 'var(--color-ink)',
            letterSpacing: '-0.025em',
          }}
        >
          Crea tu base de datos con formularios a medida{' '}
          <span style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>y analiza tus datos clínicos</span> con rigor bioestadístico.
        </h1>

        {/* Subtítulo explicativo */}
        <p
          style={{
            fontSize: 'clamp(1.05rem, 1.8vw, 1.25rem)',
            color: 'var(--color-text-secondary)',
            maxWidth: '820px',
            margin: '0 auto 2.5rem',
            lineHeight: 1.6,
            fontWeight: 400,
          }}
        >
          Diseña cuadernos de recogida de datos (eCRF) con validaciones en tiempo real para estructurar tu cohorte sin errores, o sube tu propia hoja de cálculo Excel para generar curvas de supervivencia, modelos multivariantes y tablas basales de publicación sin programar en R.
        </p>

        {/* Botones de Acción Primarios */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
            marginBottom: '3rem',
          }}
        >
          <button
            type="button"
            onClick={scrollToSandbox}
            className="ms-btn ms-btn-primary ms-btn-lg"
            style={{
              padding: '0.9rem 1.75rem',
              fontSize: '1rem',
              boxShadow: '0 8px 24px -4px rgba(156, 76, 46, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
            }}
          >
            <FileSpreadsheet size={18} />
            <span>Probar con tu Excel ahora</span>
          </button>

          <button
            type="button"
            onClick={scrollToForms}
            className="ms-btn ms-btn-secondary ms-btn-lg"
            style={{
              padding: '0.9rem 1.6rem',
              fontSize: '1rem',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Database size={17} color="var(--color-accent)" />
            <span>Crear Base de Datos con eCRF</span>
          </button>
        </div>

        {/* Barra de sellos de confianza médica */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'clamp(1rem, 3vw, 2.5rem)',
            flexWrap: 'wrap',
            fontSize: '0.8125rem',
            color: 'var(--color-text-secondary)',
            paddingTop: '1rem',
            borderTop: '1px solid var(--color-border-subtle)',
            maxWidth: '980px',
            margin: '0 auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <ClipboardList size={16} color="var(--color-accent)" />
            <span>Formularios eCRF a medida</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <ShieldCheck size={16} color="var(--color-success)" />
            <span>Normas ICMJE, STROBE & CONSORT</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <FileCheck size={16} color="var(--color-success)" />
            <span>Tablas listas para Word / APA 7ª</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Zap size={16} color="var(--color-accent)" />
            <span>Código R reproducible al 100%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Lock size={16} color="var(--color-text-tertiary)" />
            <span>Evaluación en modo de prueba local</span>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 3. PILAR: CREACIÓN DE BASE DE DATOS A PARTIR DE FORMULARIOS   */}
      {/* ============================================================== */}
      <section
        id="forms-database-section"
        style={{
          padding: '2.5rem 1.5rem 4rem',
          maxWidth: '1240px',
          margin: '0 auto',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="ms-eyebrow" style={{ color: 'var(--color-accent)' }}>
            Pilar Fundamental de la Plataforma
          </div>
          <h2 className="ms-display" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.7rem)', color: 'var(--color-ink)', marginTop: '0.35rem' }}>
            Crea tu base de datos clínica con formularios customizables
          </h2>
          <p style={{ maxWidth: '740px', margin: '0.65rem auto 0', color: 'var(--color-text-secondary)', fontSize: '0.98rem', lineHeight: 1.6 }}>
            Elimina las hojas de cálculo desordenadas y con errores de entrada. Diseña cuadernos de recogida de datos electrónicos (eCRF) adaptados a tu estudio, valida límites fisiológicos en el momento del registro y obtén automáticamente una base de datos estructurada y conectada directamente al motor de análisis estadístico.
          </p>
        </div>

        <FormDatabaseShowcase onOpenAuthModal={(reason) => handleOpenAuth('register', reason)} />
      </section>

      {/* ============================================================== */}
      {/* 4. FIGURAS CLÍNICAS INTERACTIVAS (SHOWCASE)                    */}
      {/* ============================================================== */}
      <section
        id="showcase-section"
        style={{
          padding: '2.5rem 1.5rem 4.5rem',
          maxWidth: '1240px',
          margin: '0 auto',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="ms-eyebrow" style={{ color: 'var(--color-accent)' }}>
            Demostración Bioestadística en Vivo
          </div>
          <h2 className="ms-display" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.7rem)', color: 'var(--color-ink)', marginTop: '0.35rem' }}>
            Visualizaciones estadísticas interactivas de publicación
          </h2>
          <p style={{ maxWidth: '640px', margin: '0.65rem auto 0', color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
            Interactúa directamente con las figuras clínicas: ajusta el horizonte temporal de supervivencia, calibra el umbral diagnóstico de la curva ROC o inspecciona los Odds Ratios del modelo multivariante.
          </p>
        </div>

        <ClinicalShowcase />
      </section>

      {/* ============================================================== */}
      {/* 5. METODOLOGÍA Y FLUJO EN 3 PASOS                             */}
      {/* ============================================================== */}
      <section
        id="workflow-section"
        style={{
          padding: '4rem 1.5rem',
          backgroundColor: '#F1EDE6',
          borderTop: '1px solid var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div className="ms-eyebrow" style={{ color: 'var(--color-accent)' }}>
              Metodología Diseñada para Clínicos
            </div>
            <h2 className="ms-display" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', color: 'var(--color-ink)', marginTop: '0.35rem' }}>
              De la captura de datos a la publicación en tres pasos
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            {/* Paso 1 */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '18px',
                padding: '2rem',
                border: '1px solid var(--color-border)',
                boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--color-teal-100)',
                  color: 'var(--color-accent)',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.25rem',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                01
              </div>
              <h3 className="ms-display" style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--color-ink)' }}>
                Diseña tu eCRF o importa tu Excel
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Construye el cuaderno de recogida de datos (eCRF) a medida de tu cohorte para capturar información con validación de rangos, o bien importa directamente una hoja de cálculo existente en formato .xlsx o .csv.
              </p>
            </div>

            {/* Paso 2 */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '18px',
                padding: '2rem',
                border: '1px solid var(--color-border)',
                boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--color-teal-100)',
                  color: 'var(--color-accent)',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.25rem',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                02
              </div>
              <h3 className="ms-display" style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--color-ink)' }}>
                Base de datos limpia y verificación de supuestos
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Los datos se ordenan automáticamente en una base estructurada. MedStats comprueba supuestos de normalidad (Shapiro-Wilk) y homogeneidad (Levene), seleccionando el test paramétrico o no paramétrico idóneo.
              </p>
            </div>

            {/* Paso 3 */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '18px',
                padding: '2rem',
                border: '1px solid var(--color-border)',
                boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--color-teal-100)',
                  color: 'var(--color-accent)',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.25rem',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                03
              </div>
              <h3 className="ms-display" style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--color-ink)' }}>
                Resultados en 5 capas y código R reproducible
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Obtén un resumen redactado en lenguaje médico formal, tablas APA listas para pegar en Word, gráficos vectoriales de alta resolución y el script R completo para auditar ante comités de ética y revisores.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 6. SANDBOX INTERACTIVO (SUBIDA DE EXCEL PROPIO)                */}
      {/* ============================================================== */}
      <StudioSandbox
        onOpenAuthModal={(reason, data) => handleOpenAuth('register', reason, data)}
      />

      {/* ============================================================== */}
      {/* 7. BENTO GRID DE CAPACIDADES CLÍNICAS                          */}
      {/* ============================================================== */}
      <section
        id="pillars-section"
        style={{
          padding: '4.5rem 1.5rem',
          maxWidth: '1240px',
          margin: '0 auto',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div className="ms-eyebrow" style={{ color: 'var(--color-accent)' }}>
            Capacidades Profesionales
          </div>
          <h2 className="ms-display" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.7rem)', color: 'var(--color-ink)', marginTop: '0.35rem' }}>
            Diseñado para cumplir con los estándares biomédicos más exigentes
          </h2>
          <p style={{ maxWidth: '640px', margin: '0.65rem auto 0', color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
            La combinación perfecta entre recogida de datos hospitalaria rigurosa y potencia bioestadística.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
          {/* Card 1: Bases de datos y eCRF */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '2rem',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--color-teal-100)',
                  color: 'var(--color-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.25rem',
                }}
              >
                <ClipboardList size={22} />
              </div>
              <h3 className="ms-display" style={{ fontSize: '1.35rem', marginBottom: '0.6rem', color: 'var(--color-ink)' }}>
                Bases de Datos con Formularios eCRF a Medida
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Construye cuadernos de recogida de datos electrónicos para estudios prospectivos. Define variables numéricas con rangos de plausibilidad fisiológica, menús desplegables para clasificaciones diagnósticas y vinculación directa al motor bioestadístico sin hojas de cálculo rotas.
              </p>
            </div>
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border-subtle)', fontSize: '0.78rem', color: 'var(--color-accent)', fontWeight: 700 }}>
              Control de calidad de datos hospitalarios →
            </div>
          </div>

          {/* Card 2: Salida 5 Capas */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '2rem',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--color-teal-100)',
                  color: 'var(--color-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.25rem',
                }}
              >
                <Layers size={22} />
              </div>
              <h3 className="ms-display" style={{ fontSize: '1.35rem', marginBottom: '0.6rem', color: 'var(--color-ink)' }}>
                Arquitectura de Salida en 5 Capas
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Cada análisis se desglosa en 5 niveles: Resumen clínico en texto narrativo claro, Tablas de publicación APA/ICMJE, Diagnósticos de supuestos, Métricas técnicas completas y Código R 100% reproducible.
              </p>
            </div>
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border-subtle)', fontSize: '0.78rem', color: 'var(--color-accent)', fontWeight: 700 }}>
              Auditabilidad científica total →
            </div>
          </div>

          {/* Card 3: Catálogo */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '2rem',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--color-teal-100)',
                  color: 'var(--color-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.25rem',
                }}
              >
                <BarChart3 size={22} />
              </div>
              <h3 className="ms-display" style={{ fontSize: '1.35rem', marginBottom: '0.6rem', color: 'var(--color-ink)' }}>
                Catálogo Estadístico Completo
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Tabla 1 descriptiva, test t de Student, ANOVA, U de Mann-Whitney, Kruskal-Wallis, Chi-cuadrado y Fisher, Correlación, Regresión Lineal y Logística multivariante, Curvas ROC diagnósticas y Supervivencia Kaplan-Meier.
              </p>
            </div>
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border-subtle)', fontSize: '0.78rem', color: 'var(--color-accent)', fontWeight: 700 }}>
              Desde el MIR hasta tesis y proyectos de investigación →
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 8. PREGUNTAS FRECUENTES (FAQ)                                  */}
      {/* ============================================================== */}
      <section
        id="faq-section"
        style={{
          padding: '4rem 1.5rem',
          backgroundColor: '#FAF8F5',
          borderTop: '1px solid var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div style={{ maxWidth: '840px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div className="ms-eyebrow" style={{ color: 'var(--color-accent)' }}>
              Resolución de Dudas
            </div>
            <h2 className="ms-display" style={{ fontSize: 'clamp(1.7rem, 3vw, 2.3rem)', color: 'var(--color-ink)', marginTop: '0.35rem' }}>
              Preguntas Frecuentes
            </h2>
          </div>

          <div style={{ display: 'grid', gap: '1.25rem' }}>
            {[
              {
                q: '¿Cómo funciona la creación de bases de datos con formularios eCRF?',
                a: 'En lugar de rellenar hojas de cálculo donde se introducen textos erróneos o valores imposibles, diseñas un formulario clínico con tus variables y rangos permitidos. Cada paciente registrado a través del formulario se añade automáticamente a una base de datos rectangular y limpia, lista para ser analizada con un solo clic.',
              },
              {
                q: '¿Necesito saber programar en R o Python para usar MedStats Studio?',
                a: 'En absoluto. MedStats Studio fue concebido específicamente para médicos, biólogos sanitarios e investigadores que desean rigor estadístico formal sin la barrera de la programación o la sintaxis compleja de software anticuado.',
              },
              {
                q: '¿Puedo importar mis bases de datos ya existentes en Excel o CSV?',
                a: 'Sí. Puedes subir cualquier archivo .xlsx o .csv en cualquier momento. MedStats detectará automáticamente los nombres de columnas y sus tipos de datos para que comiences el análisis de inmediato.',
              },
              {
                q: '¿Son válidas las tablas y gráficos para manuscritos de revistas internacionales?',
                a: 'Totalmente. Tanto las tablas como los gráficos están formateados conforme a las directrices de publicación biomédica (ICMJE, STROBE y APA 7ª) para permitir copiar y pegar directamente a Microsoft Word o exportar a LaTeX.',
              },
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '14px',
                  padding: '1.25rem 1.5rem',
                  border: '1px solid var(--color-border)',
                }}
              >
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-ink)', marginBottom: '0.45rem' }}>
                  {item.q}
                </h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 9. LLAMADA A LA ACCIÓN FINAL (HERO INFERIOR)                   */}
      {/* ============================================================== */}
      <section
        style={{
          padding: '5rem 1.5rem',
          maxWidth: '1040px',
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            backgroundColor: '#342F2A',
            color: '#F7F5F1',
            borderRadius: '28px',
            padding: 'clamp(2.5rem, 5vw, 4rem) 2rem',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 25px 60px -15px rgba(52, 47, 42, 0.4)',
          }}
        >
          <div className="ms-eyebrow" style={{ color: '#E9C8B3' }}>
            Empieza hoy mismo
          </div>
          <h2
            className="ms-display"
            style={{
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              color: '#FFFFFF',
              margin: '0.5rem auto 1rem',
              maxWidth: '680px',
            }}
          >
            Acelera tu investigación y publica con confianza estadística
          </h2>
          <p
            style={{
              fontSize: '1rem',
              color: '#D8D0C5',
              maxWidth: '560px',
              margin: '0 auto 2.25rem',
              lineHeight: 1.6,
            }}
          >
            Crea tu cuenta gratuita en segundos para guardar tus formularios y proyectos, o prueba el visor con tu propio archivo Excel sin registrarte.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleOpenAuth('register')}
              className="ms-btn ms-btn-primary ms-btn-lg"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: '#FFFFFF',
                boxShadow: '0 6px 20px rgba(156, 76, 46, 0.4)',
              }}
            >
              Crear cuenta gratuita
            </button>
            <button
              type="button"
              onClick={scrollToSandbox}
              className="ms-btn ms-btn-lg"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              Probar con un Excel
            </button>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 10. PIE DE PÁGINA (FOOTER)                                     */}
      {/* ============================================================== */}
      <footer
        style={{
          borderTop: '1px solid var(--color-border)',
          backgroundColor: '#FAF8F5',
          padding: '3rem 1.5rem 2rem',
        }}
      >
        <div
          style={{
            maxWidth: '1240px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.5rem',
          }}
        >
          <Logo size={28} />

          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>
            © {new Date().getFullYear()} MedStats Studio. Diseñado con rigor bioestadístico para la investigación biomédica.
          </div>

          <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            <button
              type="button"
              onClick={() => handleOpenAuth('login')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 600 }}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => handleOpenAuth('register')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 600 }}
            >
              Crear cuenta
            </button>
          </div>
        </div>
      </footer>

      {/* ============================================================== */}
      {/* MODAL DE AUTENTICACIÓN / REGISTRO                              */}
      {/* ============================================================== */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        gatedReason={gatedReason}
        pendingProjectData={pendingData}
        onSuccess={() => {
          navigate('/dashboard');
        }}
      />
    </div>
  );
};

export default LandingPage;
