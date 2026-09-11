/*
 * Template registry: maps an entry's Template value to its component.
 * To add a template, see docs/templates-and-styles.md.
 */

import DefaultRow from './DefaultRow.jsx';
import FullWidthRow from './FullWidthRow.jsx';
import MasonryGrid from './MasonryGrid.jsx';
import MasonryProductImages from './MasonryProductImages.jsx';

export const DEFAULT_TEMPLATE = 'default';

// Keyed by normalised name, so "Full Width", "full-width" and "full_width" all match.
const TEMPLATES = {
  default: DefaultRow,
  full_width: FullWidthRow,
  masonry: MasonryGrid,
  masonry_product_images: MasonryProductImages,
};

// Other names that should still work, such as the old "Fluid Grid" (now Masonry).
const ALIASES = {
  full: 'full_width',
  fullwidth: 'full_width',
  full_bleed: 'full_width',
  wide: 'full_width',
  fluid_grid: 'masonry',
  fluidgrid: 'masonry',
  fluid: 'masonry',
  grid: 'masonry',
  masonry_grid: 'masonry',
  masonry_images: 'masonry_product_images',
  masonry_product_image: 'masonry_product_images',
  product_images: 'masonry_product_images',
  masonry_with_product_images: 'masonry_product_images',
  standard: 'default',
  normal: 'default',
};

// "Full Width" becomes "full_width".
export function normalizeTemplate(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Falls back to Default, so a look with an unknown template still shows.
export function resolveTemplate(value) {
  const key = normalizeTemplate(value);
  const resolved = ALIASES[key] ?? key;

  return TEMPLATES[resolved] ?? TEMPLATES[DEFAULT_TEMPLATE];
}

export { DefaultRow, FullWidthRow, MasonryGrid, MasonryProductImages };
