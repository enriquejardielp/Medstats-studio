import React, { useState } from 'react';
import apiClient from '../api/client';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileCheck2, AlertCircle, CheckCircle2 } from 'lucide-react';

const CreateProjectPage: React.FC = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    if (selectedFile) {
      setCsvText('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name) {
      setError('El nombre del proyecto es obligatorio');
      return;
    }

    try {
      if (file) {
        const formData = new FormData();
        formData.append('name', name);
        if (description) formData.append('description', description);
        formData.append('file', file);

        await apiClient.post('/api/projects/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        if (!csvText.trim()) {
          setError('Debes seleccionar un archivo o pegar el contenido CSV');
          return;
        }
        await apiClient.post('/api/projects/', {
          name,
          description,
          filename: 'manual.csv',
          csv_data: csvText,
        });
      }

      setSuccess('Proyecto creado correctamente');
      setTimeout(() => navigate('/projects'), 1000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al crear proyecto');
    }
  };

  return (
    <div className="ms-page" style={{ maxWidth: 760, padding: '0.5rem 0.5rem 3rem' }}>
      <div className="ms-page-header slide-up">
        <div>
          <div className="ms-eyebrow">Nuevo proyecto</div>
          <h1 className="ms-page-title">Importa tu dataset</h1>
          <p className="ms-page-subtitle">Sube un archivo CSV o Excel, o pega directamente el contenido CSV.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="ms-card slide-up" style={{ padding: '1.75rem', display: 'grid', gap: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          <div>
            <label className="ms-label" htmlFor="project-name">Nombre del proyecto</label>
            <input id="project-name" className="ms-input" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej. Cohorte insuficiencia cardiaca 2024" />
          </div>
          <div>
            <label className="ms-label" htmlFor="project-description">Descripción <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 500 }}>(opcional)</span></label>
            <input id="project-description" className="ms-input" type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Objetivo, población, periodo…" />
          </div>
        </div>

        <div>
          <span className="ms-label">Archivo de datos</span>
          <label className="ms-dropzone" data-active={!!file}>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
            <span style={{ width: 44, height: 44, borderRadius: 12, background: file ? 'var(--color-accent)' : 'var(--color-ink)', color: file ? '#fff' : '#3fc1b3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {file ? <FileCheck2 size={20} /> : <UploadCloud size={20} />}
            </span>
            <span style={{ fontWeight: 700, marginTop: '0.75rem' }}>{file ? file.name : 'Arrastra un archivo o haz clic para seleccionarlo'}</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
              {file ? `${(file.size / 1024).toFixed(1)} KB` : 'CSV, XLSX o XLS'}
            </span>
          </label>
          <style>{`
            .ms-dropzone { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
              padding: 2rem 1rem; border: 1.5px dashed var(--color-border-strong); border-radius: 14px; background: var(--color-bg); cursor: pointer; }
            .ms-dropzone:hover { border-color: var(--color-accent); background: var(--color-accent-soft); }
            .ms-dropzone[data-active="true"] { border-style: solid; border-color: var(--color-accent); background: var(--color-accent-soft); }
          `}</style>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--color-text-tertiary)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          <span style={{ flex: 1, height: 1, background: 'var(--color-border)' }} /> o pega el CSV <span style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
        </div>

        <textarea
          rows={7}
          value={csvText}
          onChange={(e) => {
            setCsvText(e.target.value);
            if (e.target.value.trim()) setFile(null);
          }}
          placeholder={'id,edad,sexo,grupo\n1,64,F,tratamiento\n2,58,M,control'}
          className="ms-input ms-mono"
          style={{ fontSize: '0.8125rem', resize: 'vertical' }}
          disabled={!!file}
        />

        {error && (
          <div className="ms-alert ms-alert-error" role="alert">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} /><span>{error}</span>
          </div>
        )}
        {success && (
          <div className="ms-alert ms-alert-success" role="status">
            <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} /><span>{success}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem' }}>
          <button type="button" className="ms-btn ms-btn-ghost" onClick={() => navigate('/projects')}>Cancelar</button>
          <button type="submit" className="ms-btn ms-btn-primary">Guardar proyecto</button>
        </div>
      </form>
    </div>
  );
};

export default CreateProjectPage;
