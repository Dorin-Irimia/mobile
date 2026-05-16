// Shared category definitions for household expenses & incomes.
// Defaults are merged with user-defined custom categories from the store.

import { T } from '../theme';

export const DEFAULT_EXPENSE_CATEGORIES = [
  { key: 'utilitati',   label: 'Utilități',   icon: '💡', color: '#3B82F6', bg: '#EFF6FF' },
  { key: 'intretinere', label: 'Întreținere', icon: '🔧', color: '#10B981', bg: '#ECFDF5' },
  { key: 'mobila',      label: 'Mobilă',      icon: '🛋', color: '#8B5CF6', bg: '#F5F3FF' },
  { key: 'reparatii',   label: 'Reparații',   icon: '🛠', color: '#EF4444', bg: '#FEF2F2' },
  { key: 'mancare',     label: 'Mâncare',     icon: '🍽', color: '#F59E0B', bg: '#FFFBEB' },
  { key: 'curatenie',   label: 'Curățenie',   icon: '🧹', color: '#06B6D4', bg: '#ECFEFF' },
  { key: 'rate',        label: 'Rate',        icon: '💳', color: '#A855F7', bg: '#FAF5FF' },
  { key: 'abonamente',  label: 'Abonamente',  icon: '📺', color: '#EC4899', bg: '#FDF2F8' },
  { key: 'altele',      label: 'Altele',      icon: '📌', color: T.ink3,    bg: T.line2 },
];

export const DEFAULT_INCOME_CATEGORIES = [
  { key: 'salariu',   label: 'Salariu',         icon: '💼', color: '#10B981', bg: '#ECFDF5' },
  { key: 'chirie',    label: 'Chirie încasată', icon: '🏠', color: '#3B82F6', bg: '#EFF6FF' },
  { key: 'freelance', label: 'Freelance',       icon: '💻', color: '#8B5CF6', bg: '#F5F3FF' },
  { key: 'dividende', label: 'Dividende',       icon: '📈', color: '#F59E0B', bg: '#FFFBEB' },
  { key: 'bonusuri',  label: 'Bonusuri',        icon: '🎁', color: '#EC4899', bg: '#FDF2F8' },
  { key: 'cadou',     label: 'Cadou',           icon: '🎀', color: '#A855F7', bg: '#FAF5FF' },
  { key: 'altele',    label: 'Altele',          icon: '💵', color: T.ink3,    bg: T.line2 },
];

// Palette used when assigning colors to brand-new custom categories.
export const CUSTOM_COLOR_PALETTE = [
  '#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6',
  '#8B5CF6', '#EC4899', '#A855F7', '#14B8A6', '#F97316',
];

// Curated emoji picker — small enough to render in a grid, broad enough to cover use cases.
export const EMOJI_PICKER = [
  '💡','🔧','🛋','🛠','🍽','🧹','💳','📺','📌','💰','💼','🏠','💻','📈','🎁','🎀','💵',
  '🚗','⛽','🛒','🍔','☕','🍷','🎮','🎬','📚','🎓','🏥','💊','💄','👕','👟','🎽',
  '✈️','🚂','🏖','🌴','🎁','🎂','🎉','🎄','🐶','🐱','🌱','🪴','🧾','📦','🔑','🛡',
];

function withBg(color) {
  // Build a soft tint from a hex color for the category background.
  if (!color || !color.startsWith('#') || color.length !== 7) return T.line2;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const mix = (c) => Math.round(c + (255 - c) * 0.88);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

export function normalizeCustomCategory(c) {
  if (!c || !c.key || !c.label) return null;
  const color = c.color || CUSTOM_COLOR_PALETTE[0];
  return {
    key: String(c.key),
    label: String(c.label),
    icon: c.icon || '📌',
    color,
    bg: c.bg || withBg(color),
    custom: true,
    type: c.type === 'income' ? 'income' : 'expense',
  };
}

export function getCategoriesFor(type, customCategories = []) {
  const defaults = type === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
  const customs = (customCategories || [])
    .filter(c => (c.type || 'expense') === type)
    .map(normalizeCustomCategory)
    .filter(Boolean);
  return [...defaults, ...customs];
}

export function getCategoryMeta(key, type, customCategories = []) {
  const all = getCategoriesFor(type, customCategories);
  return all.find(c => c.key === key) || all[all.length - 1];
}

export function newCustomCategoryKey() {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
