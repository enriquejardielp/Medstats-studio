import React, { useState } from 'react';
import apiClient from '../api/client';
import { useNavigate } from 'react-router-dom';

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
    <div>
      <h2>Nuevo Proyecto</h2>
      <form onSubmit={handleSubmit} style={{ maxWidth: 600 }}>
        <div style={{ marginBottom: 10 }}>
          <label>Nombre del proyecto: </label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label>Descripción (opcional): </label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label>Archivo de datos (CSV o Excel): </label>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} style={{ marginBottom: 5 }} />
          <br />
          <small>También puedes pegar el contenido de un CSV aquí (si no subes archivo):</small>
          <textarea
            rows={8}
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              if (e.target.value.trim()) setFile(null);
            }}
            placeholder="nombre,edad,sexo..."
            style={{ width: '100%', padding: 8, fontFamily: 'monospace' }}
            disabled={!!file}
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {success && <p style={{ color: 'green' }}>{success}</p>}
        <button type="submit">Guardar proyecto</button>
        <button type="button" onClick={() => navigate('/projects')} style={{ marginLeft: 10 }}>Cancelar</button>
      </form>
    </div>
  );
};

export default CreateProjectPage;
