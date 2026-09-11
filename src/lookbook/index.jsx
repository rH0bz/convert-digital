import { createRoot } from 'react-dom/client';
import Lookbook from './Lookbook.jsx';
import { createLookbookLoader } from './storefront.js';

/*
 * Entry point. For each [data-lookbook] element: read the JSON from Liquid, load
 * the first looks, then mount React (which replaces the placeholder looks).
 * Also remounts sections when the theme editor reloads them.
 */

const SELECTOR = '[data-lookbook]';

// Kept on window so a theme editor re-run of this script doesn't mount twice.
// A value of null means the first looks are still loading.
const roots = (window.__lookbookRoots ||= new Map());

function readPayload(el) {
  const dataNode = document.getElementById(el.dataset.lookbook);

  if (!dataNode) {
    console.warn('[lookbook] no JSON payload found for', el);
    return null;
  }

  try {
    return JSON.parse(dataNode.textContent);
  } catch (error) {
    // Usually a value in snippets/lookbook.liquid that is missing the `json` filter.
    console.error('[lookbook] could not parse JSON payload', error);
    return null;
  }
}

async function mount(el) {
  if (roots.has(el)) return;

  const payload = readPayload(el);
  if (!payload) return;

  roots.set(el, null);

  // Load before mounting, so React swaps the placeholders for looks in one render.
  const loader = createLookbookLoader(payload.source);
  let firstBatch;
  try {
    firstBatch = await loader.next();
  } catch (error) {
    console.error('[lookbook] could not load looks from the Storefront API', error);
    firstBatch = { entries: [], hasMore: false, failed: true };
  }

  // The theme editor removed the section while it was loading.
  if (roots.get(el) !== null || !el.isConnected) return;

  const root = createRoot(el);
  roots.set(el, root);
  root.render(<Lookbook {...payload} loader={loader} firstBatch={firstBatch} />);
}

function unmount(el) {
  if (!roots.has(el)) return;

  const root = roots.get(el);
  roots.delete(el);
  // Deferred so React isn't unmounted in the middle of a render.
  if (root) queueMicrotask(() => root.unmount());
}

function mountWithin(scope) {
  if (scope.matches?.(SELECTOR)) mount(scope);
  scope.querySelectorAll?.(SELECTOR).forEach(mount);
}

function unmountWithin(scope) {
  if (scope.matches?.(SELECTOR)) unmount(scope);
  scope.querySelectorAll?.(SELECTOR).forEach(unmount);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountWithin(document));
} else {
  mountWithin(document);
}

// Theme editor events (they never fire on the live store). Registered only once.
if (!window.__lookbookListening) {
  window.__lookbookListening = true;

  document.addEventListener('shopify:section:load', (event) => mountWithin(event.target));
  document.addEventListener('shopify:section:unload', (event) => unmountWithin(event.target));
}
