import type { ConditionalRule } from '../types/clinical';

/**
 * Evaluates whether a conditional rule is satisfied given current form data
 */
export function isConditionMet(
  rule: ConditionalRule | undefined,
  formData: Record<string, any>
): boolean {
  if (!rule || !rule.parentField) {
    return true; // No rule -> unconditionally visible
  }

  const parentVal = formData[rule.parentField];

  switch (rule.operator) {
    case 'is_not_empty': {
      if (parentVal === undefined || parentVal === null || parentVal === '') return false;
      if (Array.isArray(parentVal)) return parentVal.length > 0;
      return true;
    }

    case 'is_true': {
      return (
        parentVal === true ||
        parentVal === 'true' ||
        parentVal === 'Sí' ||
        parentVal === 'SÍ' ||
        parentVal === 1 ||
        parentVal === '1'
      );
    }

    case 'is_false': {
      return (
        parentVal === false ||
        parentVal === 'false' ||
        parentVal === 'No' ||
        parentVal === 'NO' ||
        parentVal === 0 ||
        parentVal === '0'
      );
    }

    case 'equals': {
      if (parentVal === undefined || parentVal === null) return false;
      if (Array.isArray(parentVal)) {
        return parentVal.map(String).includes(String(rule.value));
      }
      return (
        String(parentVal).trim().toLowerCase() === String(rule.value ?? '').trim().toLowerCase()
      );
    }

    case 'not_equals': {
      if (parentVal === undefined || parentVal === null) return true;
      if (Array.isArray(parentVal)) {
        return !parentVal.map(String).includes(String(rule.value));
      }
      return (
        String(parentVal).trim().toLowerCase() !== String(rule.value ?? '').trim().toLowerCase()
      );
    }

    case 'contains': {
      if (parentVal === undefined || parentVal === null || parentVal === '') return false;
      const target = String(rule.value ?? '').toLowerCase().trim();
      if (Array.isArray(parentVal)) {
        return parentVal.some((item) => String(item).toLowerCase().includes(target));
      }
      return String(parentVal).toLowerCase().includes(target);
    }

    case 'greater_than': {
      const num = parseFloat(parentVal);
      const target = parseFloat(rule.value);
      if (isNaN(num) || isNaN(target)) return false;
      return num > target;
    }

    case 'less_than': {
      const num = parseFloat(parentVal);
      const target = parseFloat(rule.value);
      if (isNaN(num) || isNaN(target)) return false;
      return num < target;
    }

    default:
      return true;
  }
}

/**
 * Returns a concise, user-friendly description of a condition
 */
export function getConditionDescription(
  rule: ConditionalRule | undefined,
  parentLabel?: string
): string {
  if (!rule || !rule.parentField) return '';
  const fieldName = parentLabel || rule.parentField;

  switch (rule.operator) {
    case 'is_true':
      return `Visible si "${fieldName}" es Sí`;
    case 'is_false':
      return `Visible si "${fieldName}" es No`;
    case 'is_not_empty':
      return `Visible si "${fieldName}" está rellenado`;
    case 'equals':
      return `Visible si "${fieldName}" = "${rule.value}"`;
    case 'not_equals':
      return `Visible si "${fieldName}" ≠ "${rule.value}"`;
    case 'contains':
      return `Visible si "${fieldName}" incluye "${rule.value}"`;
    case 'greater_than':
      return `Visible si "${fieldName}" > ${rule.value}`;
    case 'less_than':
      return `Visible si "${fieldName}" < ${rule.value}`;
    default:
      return `Visible condicionado a ${fieldName}`;
  }
}
