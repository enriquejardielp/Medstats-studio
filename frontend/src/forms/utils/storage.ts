import type { ClinicalForm, RecordEntry, FavoriteSection, TrashItem, FormBackup } from '../types/clinical';
import { DEFAULT_FAVORITE_SECTIONS } from '../data/favoriteSections';

const FORMS_KEY = 'cliniform_saved_forms_v1';
const ACTIVE_FORM_ID_KEY = 'cliniform_active_form_id_v1';
const RECORDS_PREFIX = 'cliniform_records_';

// IDs de formularios de ejemplo a excluir para garantizar el estado inicial limpio
const EXAMPLE_TEMPLATE_IDS = new Set([
  'triaje-urgencias',
  'estudio-cardiovascular',
  'valoracion-braden',
]);

export function getSavedForms(): ClinicalForm[] {
  try {
    const raw = localStorage.getItem(FORMS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filtrar formularios de ejemplo predeterminados
        const cleanForms = parsed.filter((f) => f && f.id && !EXAMPLE_TEMPLATE_IDS.has(f.id));
        return cleanForms;
      }
    }
  } catch (e) {
    console.error('Error loading forms from storage:', e);
  }

  // Estado inicial limpio: no se carga ningún formulario por defecto
  return [];
}

export function saveForms(forms: ClinicalForm[]) {
  try {
    localStorage.setItem(FORMS_KEY, JSON.stringify(forms));
  } catch (e) {
    console.error('Error saving forms:', e);
  }
}

export function getActiveFormId(forms: ClinicalForm[]): string {
  if (!forms || forms.length === 0) return '';
  const saved = localStorage.getItem(ACTIVE_FORM_ID_KEY);
  if (saved && forms.some((f) => f.id === saved)) {
    return saved;
  }
  return forms[0]?.id || '';
}

export function setActiveFormId(id: string) {
  localStorage.setItem(ACTIVE_FORM_ID_KEY, id);
}

export function getRecordsForForm(form?: ClinicalForm | null): RecordEntry[] {
  if (!form?.id) return [];
  const key = `${RECORDS_PREFIX}${form.id}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading records for form:', form.id, e);
  }

  return [];
}

export function saveRecordsForForm(formId: string, records: RecordEntry[]) {
  if (!formId) return;
  const key = `${RECORDS_PREFIX}${formId}`;
  try {
    localStorage.setItem(key, JSON.stringify(records));
  } catch (e) {
    console.error('Error saving records for form:', formId, e);
  }
}

// Favorite Sections Storage
const FAVORITE_SECTIONS_KEY = 'cliniform_favorite_sections_v1';

export function getFavoriteSections(): FavoriteSection[] {
  try {
    const raw = localStorage.getItem(FAVORITE_SECTIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading favorite sections from storage:', e);
  }

  // Initial default: copy default favorite sections to storage
  const defaults = [...DEFAULT_FAVORITE_SECTIONS];
  saveFavoriteSections(defaults);
  return defaults;
}

export function saveFavoriteSections(sections: FavoriteSection[]) {
  try {
    localStorage.setItem(FAVORITE_SECTIONS_KEY, JSON.stringify(sections));
  } catch (e) {
    console.error('Error saving favorite sections:', e);
  }
}

export function addFavoriteSection(newSection: FavoriteSection): FavoriteSection[] {
  const current = getFavoriteSections();
  const existsIdx = current.findIndex((s) => s.id === newSection.id || s.title.toLowerCase() === newSection.title.toLowerCase());
  let updated: FavoriteSection[];
  if (existsIdx >= 0) {
    updated = current.map((s, idx) => (idx === existsIdx ? newSection : s));
  } else {
    updated = [newSection, ...current];
  }
  saveFavoriteSections(updated);
  return updated;
}

export function deleteFavoriteSection(id: string): FavoriteSection[] {
  const current = getFavoriteSections();
  const updated = current.filter((s) => s.id !== id);
  saveFavoriteSections(updated);
  return updated;
}

// Auto-Backup and Trash Keys
const TRASH_KEY = 'cliniform_trash_forms_v1';
const BACKUPS_KEY = 'cliniform_backups_v1';

export function getTrashItems(): TrashItem[] {
  try {
    const raw = localStorage.getItem(TRASH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error loading trash:', e);
  }
  return [];
}

export function saveTrashItems(items: TrashItem[]) {
  try {
    localStorage.setItem(TRASH_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Error saving trash:', e);
  }
}

/**
 * Moves a form and its records to trash (so user never accidentally loses data)
 */
export function moveFormToTrash(formId: string): { remainingForms: ClinicalForm[]; trashItems: TrashItem[] } {
  const allForms = getSavedForms();
  const targetForm = allForms.find((f) => f.id === formId);
  if (!targetForm) return { remainingForms: allForms, trashItems: getTrashItems() };

  const records = getRecordsForForm(targetForm);
  const trashItems = getTrashItems();

  const newTrashItem: TrashItem = {
    id: 'trash-' + Date.now(),
    form: targetForm,
    records,
    deletedAt: new Date().toISOString(),
  };

  const updatedTrash = [newTrashItem, ...trashItems];
  saveTrashItems(updatedTrash);

  const remaining = allForms.filter((f) => f.id !== formId);
  saveForms(remaining);

  // If deleted form was active, switch active form
  const activeId = getActiveFormId(remaining);
  if (activeId === formId && remaining.length > 0) {
    setActiveFormId(remaining[0].id);
  }

  return { remainingForms: remaining, trashItems: updatedTrash };
}

/**
 * Restores a deleted form and its records from trash
 */
export function restoreFormFromTrash(trashId: string): { restoredForm: ClinicalForm; forms: ClinicalForm[] } | null {
  const trashItems = getTrashItems();
  const target = trashItems.find((t) => t.id === trashId);
  if (!target) return null;

  const currentForms = getSavedForms();
  // Ensure ID doesn't collide
  const restoredForm: ClinicalForm = {
    ...target.form,
    updatedAt: new Date().toISOString(),
  };

  const updatedForms = [restoredForm, ...currentForms];
  saveForms(updatedForms);
  saveRecordsForForm(restoredForm.id, target.records || []);

  const remainingTrash = trashItems.filter((t) => t.id !== trashId);
  saveTrashItems(remainingTrash);
  setActiveFormId(restoredForm.id);

  return { restoredForm, forms: updatedForms };
}

/**
 * Duplicates a form with an option to clone or start fresh records
 */
export function duplicateForm(formId: string, cloneRecords: boolean = false): { newForm: ClinicalForm; forms: ClinicalForm[] } {
  const allForms = getSavedForms();
  const original = allForms.find((f) => f.id === formId) || allForms[0];

  if (!original) {
    throw new Error('Formulario original no encontrado');
  }

  const newFormId = 'form-' + Date.now();
  const newForm: ClinicalForm = {
    ...original,
    id: newFormId,
    title: `${original.title} (Copia)`,
    codePrefix: original.codePrefix ? `${original.codePrefix}` : 'PAC-',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: (original.fields || []).map((f, i) => ({
      ...f,
      id: `f_${Date.now()}_${i}`,
    })),
  };

  const updatedForms = [newForm, ...allForms];
  saveForms(updatedForms);

  if (cloneRecords) {
    const originalRecords = getRecordsForForm(original);
    const clonedRecords = originalRecords.map((r, i) => ({
      ...r,
      id: `rec-${Date.now()}-${i}`,
      recordCode: `${r.recordCode}_copia`,
    }));
    saveRecordsForForm(newForm.id, clonedRecords);
  } else {
    saveRecordsForForm(newForm.id, []);
  }

  setActiveFormId(newForm.id);
  return { newForm, forms: updatedForms };
}

/**
 * Creates a system backup snapshot before major edits
 */
export function createSystemBackup(reason: string = 'Respaldo manual'): FormBackup | null {
  const forms = getSavedForms();
  if (forms.length === 0) return null;
  const activeId = getActiveFormId(forms);
  const activeForm = forms.find((f) => f.id === activeId) || forms[0];
  const records = getRecordsForForm(activeForm);

  const backup: FormBackup = {
    id: 'bk-' + Date.now(),
    form: activeForm,
    records,
    timestamp: new Date().toISOString(),
    reason,
  };

  try {
    const raw = localStorage.getItem(BACKUPS_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    const updated = [backup, ...(Array.isArray(existing) ? existing.slice(0, 9) : [])];
    localStorage.setItem(BACKUPS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving backup:', e);
  }

  return backup;
}
