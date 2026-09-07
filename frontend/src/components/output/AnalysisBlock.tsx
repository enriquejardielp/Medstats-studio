import {
  ChevronDown,
  ChevronRight,
  Trash2,
  Table,
  ShieldCheck,
  Info,
  Code2,
  Clock,
  Database,
  Image as ImageIcon,
} from 'lucide-react';
import type { AnalysisResult } from '../../types/analysis';
import { WarningsBanner } from './WarningsBanner';
import { Layer1Summary } from './Layer1Summary';
import { Layer2Tables } from './Layer2Tables';
import { Layer3Diagnostics } from './Layer3Diagnostics';
import { Layer4Technical } from './Layer4Technical';
import { Layer5ReproducibleCode } from './Layer5ReproducibleCode';
import { StatisticalPlots } from './StatisticalPlots';

interface Props {
  result: AnalysisResult;
  onDelete?: (analysisId: string) => void;
}

export const AnalysisBlock: React.FC<Props> = ({ result, onDelete }) => {
  const [openPlots, setOpenPlots] = useState(true);
  const [openTables, setOpenTables] = useState(true);
  const [openDiagnostics, setOpenDiagnostics] = useState(true);
  const [openTechnical, setOpenTechnical] = useState(false);
  const [openCode, setOpenCode] = useState(false);

  const meta = result.metadata;
  const createdDate = meta.created_at ? new Date(meta.created_at).toLocaleTimeString() : '';

  return (
    <div
      id={`analysis-block-${meta.analysis_id}`}
      style={{
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        padding: '1.5rem',
      }}
    >
      {/* 1. Cabecera del Bloque de Análisis (Estilo SPSS Output Tree Header) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          borderBottom: '2px solid #f1f5f9',
          paddingBottom: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {meta.analysis_type}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Clock size={12} /> {createdDate}
            </span>
          </div>

          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
            {meta.title}
          </h3>

          {meta.description && (
            <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              {meta.description}
            </p>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Database size={13} color="#94a3b8" />
              <strong>Muestra:</strong> N = {meta.sample_size} (Válidos: {meta.valid_observations})
            </span>
            <span>
              <strong>Variables:</strong> {meta.variables_used.join(', ')}
            </span>
          </div>
        </div>

        {onDelete && (
          <button
            onClick={() => onDelete(meta.analysis_id)}
            title="Eliminar este bloque de resultados"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '4px',
              transition: 'color 0.15s, background-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#ef4444';
              e.currentTarget.style.backgroundColor = '#fef2f2';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = '#94a3b8';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* 2. Advertencias Estadísticas */}
      {result.warnings && result.warnings.length > 0 && (
        <WarningsBanner warnings={result.warnings} />
      )}

      {/* 3. CAPA 1: Resumen Ejecutivo (Siempre visible) */}
      <Layer1Summary summary={result.summary} />

      {/* 3.1 Gráficos Estadísticos Contextuales */}
      {result.plots && result.plots.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
          <button
            onClick={() => setOpenPlots(!openPlots)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: openPlots ? '#f8fafc' : 'white',
              border: 'none',
              borderBottom: openPlots ? '1px solid #e2e8f0' : 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.88rem', color: '#1e293b' }}>
              <ImageIcon size={16} color="#2563eb" />
              <span>Gráficos Estadísticos Contextuales</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>
                ({result.plots.length} visualización{result.plots.length !== 1 ? 'es' : ''})
              </span>
            </div>
            {openPlots ? <ChevronDown size={16} color="#64748b" /> : <ChevronRight size={16} color="#64748b" />}
          </button>

          {openPlots && (
            <div style={{ padding: '1rem', backgroundColor: 'white' }}>
              <StatisticalPlots plots={result.plots} />
            </div>
          )}
        </div>
      )}

      {/* 4. CAPA 2: Resultados Completos (Tablas) */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
        <button
          onClick={() => setOpenTables(!openTables)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            background: openTables ? '#f8fafc' : 'white',
            border: 'none',
            borderBottom: openTables ? '1px solid #e2e8f0' : 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.88rem', color: '#1e293b' }}>
            <Table size={16} color="#2563eb" />
            <span>Tablas Estadísticas Detalladas</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>
              ({result.tables.length} tabla{result.tables.length !== 1 ? 's' : ''})
            </span>
          </div>
          {openTables ? <ChevronDown size={16} color="#64748b" /> : <ChevronRight size={16} color="#64748b" />}
        </button>

        {openTables && (
          <div style={{ padding: '1rem', backgroundColor: 'white' }}>
            <Layer2Tables tables={result.tables} />
          </div>
        )}
      </div>

      {/* 5. CAPA 3: Diagnósticos y Supuestos */}
      {result.diagnostics && result.diagnostics.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
          <button
            onClick={() => setOpenDiagnostics(!openDiagnostics)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: openDiagnostics ? '#f8fafc' : 'white',
              border: 'none',
              borderBottom: openDiagnostics ? '1px solid #e2e8f0' : 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.88rem', color: '#1e293b' }}>
              <ShieldCheck size={16} color="#16a34a" />
              <span>Diagnósticos y Pruebas de Supuestos</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>
                ({result.diagnostics.length} prueba{result.diagnostics.length !== 1 ? 's' : ''})
              </span>
            </div>
            {openDiagnostics ? <ChevronDown size={16} color="#64748b" /> : <ChevronRight size={16} color="#64748b" />}
          </button>

          {openDiagnostics && (
            <div style={{ padding: '1rem', backgroundColor: 'white' }}>
              <Layer3Diagnostics diagnostics={result.diagnostics} />
            </div>
          )}
        </div>
      )}

      {/* 6. CAPA 4: Información Técnica */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
        <button
          onClick={() => setOpenTechnical(!openTechnical)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.65rem 1rem',
            background: openTechnical ? '#f8fafc' : 'white',
            border: 'none',
            borderBottom: openTechnical ? '1px solid #e2e8f0' : 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>
            <Info size={15} />
            <span>Ficha Técnica y Parámetros del Modelo</span>
          </div>
          {openTechnical ? <ChevronDown size={16} color="#64748b" /> : <ChevronRight size={16} color="#64748b" />}
        </button>

        {openTechnical && (
          <div style={{ padding: '1rem', backgroundColor: 'white' }}>
            <Layer4Technical technical={result.technical} metadata={meta} />
          </div>
        )}
      </div>

      {/* 7. CAPA 5: Código R Reproducible */}
      {result.reproducible_code && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
          <button
            onClick={() => setOpenCode(!openCode)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.65rem 1rem',
              background: openCode ? '#f8fafc' : 'white',
              border: 'none',
              borderBottom: openCode ? '1px solid #e2e8f0' : 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>
              <Code2 size={15} color="#0284c7" />
              <span>Código R Reproducible</span>
            </div>
            {openCode ? <ChevronDown size={16} color="#64748b" /> : <ChevronRight size={16} color="#64748b" />}
          </button>

          {openCode && (
            <div style={{ padding: '1rem', backgroundColor: 'white' }}>
              <Layer5ReproducibleCode code={result.reproducible_code} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
