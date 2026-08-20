// ============================================
// Tipos para MedStats Studio
// ============================================

// Usuario autenticado
export interface User {
  id: number;
  email: string;
  full_name?: string;
  hospital?: string;
  role: string;
  is_active: boolean;
  created_at?: string;
}

// Credenciales de login
export interface LoginCredentials {
  email: string;
  password: string;
}

// Respuesta de autenticación
export interface AuthResponse {
  access_token: string;
  token_type: string;
}

// Proyecto (coincide con el modelo del backend)
export interface Project {
  id: number;
  name: string;
  description?: string;
  filename: string;
  columns: string[];
  column_types?: Record<string, string>;
  row_count: number;
  created_at: string;
  updated_at?: string;
}

// Payload para crear un proyecto
export interface ProjectCreatePayload {
  name: string;
  description?: string;
  filename: string;
  csv_data: string;
  column_types?: Record<string, string>;
}

// Datos de un proyecto para edición (respuesta del endpoint /projects/{id}/data)
export interface ProjectData {
  columns: string[];
  types: Record<string, string>;  // Mapeo columna -> tipo (numeric, categorical, etc.)
  data: any[][];                  // Array de filas, cada fila es un array de valores
}

// Payload para actualizar los datos de un proyecto
export interface UpdateProjectDataPayload {
  columns: string[];
  types: Record<string, string>;
  data: any[][];
}

// Tipos de columna admitidos
export type ColumnType = 'numeric' | 'categorical' | 'binary' | 'date' | 'id' | 'text';

// (Opcional) Tipos para el selector de temas (solo uso interno en el componente)
export type ThemeKey = 'ag-theme-alpine' | 'ag-theme-alpine-dark' | 'ag-theme-balham' | 'ag-theme-balham-dark' | 'ag-theme-material';