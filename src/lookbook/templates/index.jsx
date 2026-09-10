/*
 * Template registry.
 *
 * Maps the entry's "Template" choice list value onto the component that renders
 * it. This is the only file that needs editing to add a template: write the
 * component alongside this one, add it to TEMPLATES, and add the choice to the
 * metaobject definition in admin.
 *
 * Each template owns the whole entry — header, product arrangement AND
 * container width — because Full width differs from Default only in width. That
 * is also why `page-width` lives in the templates rather than on the section
 * wrapper.
 */

import DefaultRow from './DefaultRow.jsx';
import FullWidthRow from './FullWidthRow.jsx';
import MasonryGrid from './MasonryGrid.jsx';
import MasonryProductImages from './MasonryProductImages.jsx';

export const DEFAULT_TEMPLATE = 'default';

/*
 * Keyed by normalised name, so the choice list in admin can read however the
 * merchant wrote it — "Full Width", "full-width" and "full_width" all land on
 * the same component.
 */
const TEMPLATES = {
  default: DefaultRow,
  full_width: FullWidthRow,
  masonry: MasonryGrid,
  masonry_product_images: MasonryProductImages,
};

/*
 * Spellings that should resolve to a template but would not normalise onto its
 * key. Kept separate from TEMPLATES so the canonical list above stays readable.
 *
 * The masonry entries carry the choice's former wording, "Fluid Grid". Renaming
 * a choice in admin does not rewrite the value already stored on each entry, so
 * without these an entry saved before the rename would silently fall back to
 * Default.
 */
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

/*
 * "Full Width" -> "full_width", "  Masonry-Grid " -> "masonry_grid". The result
 * is looked up in TEMPLATES, then in ALIASES, so a normalised name that is not
 * canonical (like "fluid_grid") still finds its component.
 */
export function normalizeTemplate(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/*
 * Never returns nothing: an empty choice, or a choice added in admin before its
 * component exists here, falls back to Default rather than dropping the look
 * off the page.
 */
export function resolveTemplate(value) {
  const key = normalizeTemplate(value);
  const resolved = ALIASES[key] ?? key;

  return TEMPLATES[resolved] ?? TEMPLATES[DEFAULT_TEMPLATE];
}

export { DefaultRow, FullWidthRow, MasonryGrid, MasonryProductImages };
