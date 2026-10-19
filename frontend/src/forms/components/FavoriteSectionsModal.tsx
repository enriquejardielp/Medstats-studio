import { useState, useMemo } from 'react';
import {
  X,
  Star,
  Plus,
  Trash2,
  Search,
  Check,
  Activity,
  Heart,
  ImageIcon,
  FlaskConical,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { FavoriteSection, FieldType } from '../types/clinical';
import { normalizeColumnKey } from '../utils/merger';

interface FavoriteSectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  favoriteSections: FavoriteSection[];
  onInsertSection: (section: FavoriteSection) => void;
  onSaveNewFavorite: (newSection: FavoriteSection) => void;
  onDeleteFavorite: (id: string) => void;
}

export function FavoriteSectionsModal({
  isOpen,
  onClose,
  favoriteSections,
  onInsertSection,
  onSaveNewFavorite,
  onDeleteFavorite,
}: FavoriteSectionsModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // New section creator state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<FavoriteSection['category']>('cardiovascular');
  const [newFields, setNewFields] = useState<
    Array<{
      name: string;
      label: string;
      type: FieldType;
      unit?: string;
      required?: boolean;
    }>
  >([
    { name: 'variable_1', label: 'Primera Variable', type: 'text', required: false },
  ]);

  const categories = [
    { id: 'all', label: 'Todas las Secciones' },
    { id: 'cardiovascular', label: 'Cardiovascular' },
    { id: 'imagen', label: 'Datos de Imagen' },
    { id: 'antecedentes', label: 'Antecedentes' },
    { id: 'laboratorio', label: 'Laboratorio' },
    { id: 'constantes', label: 'Constantes' },
  ];

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'cardiovascular':
        return <Heart className="w-4 h-4 text-rose-600" />;
      case 'imagen':
        return <ImageIcon className="w-4 h-4 text-indigo-600" />;
      case 'antecedentes':
        return <Activity className="w-4 h-4 text-amber-600" />;
      case 'laboratorio':
        return <FlaskConical className="w-4 h-4 text-emerald-600" />;
      case 'constantes':
        return <Clock className="w-4 h-4 text-teal-600" />;
      default:
        return <Layers className="w-4 h-4 text-slate-600" />;
    }
  };

  const filteredSections = useMemo(() => {
    return favoriteSections.filter((sec) => {
      if (selectedCategory !== 'all' && sec.category !== selectedCategory) {
        return false;
      }
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();

      if (sec.title.toLowerCase().includes(term)) return true;
      if (sec.description.toLowerCase().includes(term)) return true;
      // Also search through field labels and names
      return sec.fields.some(
        (f) =>
          f.name.toLowerCase().includes(term) ||
          f.label.toLowerCase().includes(term) ||
          (f.unit && f.unit.toLowerCase().includes(term))
      );
    });
  }, [favoriteSections, selectedCategory, searchTerm]);

  const handleAddFieldToNewSection = () => {
    setNewFields((prev) => [
      ...prev,
      {
        name: `variable_${prev.length + 1}`,
        label: `Variable ${prev.length + 1}`,
        type: 'text',
        required: false,
      },
    ]);
  };

  const handleRemoveFieldFromNewSection = (index: number) => {
    if (newFields.length <= 1) return;
    setNewFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveCustomSection = () => {
    if (!newTitle.trim()) {
      alert('Por favor indica un título para la sección.');
      return;
    }

    const created: FavoriteSection = {
      id: 'custom-fav-' + Date.now(),
      title: newTitle.trim(),
      description: newDescription.trim() || 'Módulo clínico reutilizable',
      category: newCategory,
      isDefaultPreset: false,
      fields: newFields.map((f) => ({
        ...f,
        name: normalizeColumnKey(f.name || f.label),
      })),
    };

    onSaveNewFavorite(created);
    setIsCreatingNew(false);
    setNewTitle('');
    setNewDescription('');
    setNewFields([{ name: 'variable_1', label: 'Primera Variable', type: 'text', required: false }]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <Star className="w-4 h-4 fill-teal-600 text-teal-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Biblioteca de Secciones Favoritas Reutilizables
              </h3>
              <p className="text-xs text-slate-500">
                Añade módulos clínicos completos a tu formulario con un solo clic o guarda los tuyos propios.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action strip & Search */}
        {!isCreatingNew && (
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar sección (ej. FEVI, antecedentes, imagen, tabaco, lípidos)..."
                  className="w-full text-xs sm:text-sm pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <button
                onClick={() => setIsCreatingNew(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-md hover:bg-teal-700 shadow-xs shrink-0 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Crear Sección Favorita</span>
              </button>
            </div>

            {/* Category Filter Pills (Functional Segmented Buttons) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isCreatingNew ? (
            /* Create new custom favorite section form */
            <div className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-teal-600" />
                  Diseñar Nueva Sección Favorita
                </h4>
                <button
                  onClick={() => setIsCreatingNew(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Título de la Sección <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ej. Estudio de Imagen Doppler / Antecedentes Renales"
                    className="w-full text-xs font-semibold border border-slate-300 rounded-md py-1.5 px-2.5 bg-white focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Categoría</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded-md py-1.5 px-2.5 bg-white"
                  >
                    <option value="cardiovascular">Cardiovascular</option>
                    <option value="imagen">Datos de Imagen</option>
                    <option value="antecedentes">Antecedentes</option>
                    <option value="laboratorio">Laboratorio</option>
                    <option value="constantes">Constantes</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Descripción o Indicaciones Clínicas
                  </label>
                  <input
                    type="text"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Breve explicación del objetivo clínico de este módulo"
                    className="w-full text-xs border border-slate-300 rounded-md py-1.5 px-2.5 bg-white"
                  />
                </div>
              </div>

              {/* Variables inside new section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Variables de esta Sección ({newFields.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddFieldToNewSection}
                    className="text-xs text-teal-700 hover:text-teal-900 font-medium"
                  >
                    + Añadir otra variable
                  </button>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {newFields.map((f, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded border border-slate-200 text-xs"
                    >
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={f.label}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewFields((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, label: val, name: normalizeColumnKey(val) }
                                  : item
                              )
                            );
                          }}
                          placeholder="Etiqueta visible (ej. FEVI)"
                          className="w-full text-xs border border-slate-300 rounded py-1 px-2"
                        />
                      </div>

                      <div className="col-span-4">
                        <select
                          value={f.type}
                          onChange={(e) => {
                            const val = e.target.value as FieldType;
                            setNewFields((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, type: val } : item))
                            );
                          }}
                          className="w-full text-xs border border-slate-300 rounded py-1 px-1.5"
                        >
                          <option value="text">Texto</option>
                          <option value="number">Número</option>
                          <option value="boolean">Sí / No</option>
                          <option value="select">Desplegable</option>
                          <option value="multiselect">Múltiple</option>
                          <option value="textarea">Observaciones</option>
                        </select>
                      </div>

                      <div className="col-span-2">
                        <input
                          type="text"
                          value={f.unit || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewFields((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, unit: val } : item))
                            );
                          }}
                          placeholder="Unidad (ej. %)"
                          className="w-full text-xs border border-slate-300 rounded py-1 px-1.5"
                        />
                      </div>

                      <div className="col-span-1 flex justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveFieldFromNewSection(idx)}
                          disabled={newFields.length <= 1}
                          className="text-slate-400 hover:text-rose-600 disabled:opacity-20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-3 py-1.5 text-xs text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustomSection}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded hover:bg-teal-700"
                >
                  Guardar en Secciones Favoritas
                </button>
              </div>
            </div>
          ) : filteredSections.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No se encontraron secciones favoritas con el término buscado.
            </div>
          ) : (
            /* List of Available Favorite Sections */
            filteredSections.map((sec) => {
              const isExpanded = expandedSectionId === sec.id;

              return (
                <div
                  key={sec.id}
                  className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-slate-50 border border-slate-100 rounded-md mt-0.5">
                        {getCategoryIcon(sec.category)}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm tracking-tight">
                            {sec.title}
                          </h4>
                          {sec.isDefaultPreset && (
                            <span className="text-[10px] text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded font-mono border border-teal-200">
                              Estándar Clínico
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 mt-0.5">{sec.description}</p>

                        <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700 font-mono">
                            {sec.fields.length} variables
                          </span>
                          <span>·</span>
                          <span className="capitalize">{sec.category}</span>
                          <span>·</span>
                          <button
                            type="button"
                            onClick={() => setExpandedSectionId(isExpanded ? null : sec.id)}
                            className="text-teal-700 hover:text-teal-900 font-medium flex items-center gap-0.5"
                          >
                            <span>{isExpanded ? 'Ocultar variables' : 'Ver variables incluidas'}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!sec.isDefaultPreset && (
                        <button
                          onClick={() => {
                            if (window.confirm(`¿Eliminar la sección favorita "${sec.title}"?`)) {
                              onDeleteFavorite(sec.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          title="Eliminar de favoritos"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          onInsertSection(sec);
                          onClose();
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-md shadow-2xs transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Insertar en Formulario</span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded field list preview */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50/80 rounded p-3">
                      <div className="text-[11px] font-semibold text-slate-700 mb-2">
                        Variables y columnas que se añadirán a tu base de datos:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {sec.fields.map((f, i) => (
                          <div
                            key={i}
                            className="bg-white p-2 rounded border border-slate-200 flex items-center justify-between"
                          >
                            <div className="truncate mr-2">
                              <span className="font-medium text-slate-800">{f.label}</span>
                              <div className="text-[10px] font-mono text-slate-500">
                                {f.name} · {f.type} {f.unit ? `(${f.unit})` : ''}
                              </div>
                            </div>
                            {f.required && (
                              <span className="text-[9px] text-rose-600 font-semibold bg-rose-50 px-1 py-0.2 rounded shrink-0">
                                Req.
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>
            {favoriteSections.length} secciones disponibles para reutilizar en cualquier formulario
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
