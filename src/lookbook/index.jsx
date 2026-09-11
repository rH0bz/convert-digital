import { createRoot } from 'react-dom/client';
import Lookbook from './Lookbook.jsx';
import { createLookbookLoader } from './storefront.js';

/*
 * Mount layer.
 *
 * Liquid renders a <div data-lookbook="<id of a JSON script tag>"> holding
 * skeleton placeholders, plus a <script type="application/json"> with the
 * section's settings and the ids of the looks to show. For each pair this file
 * loads the first looks through the Storefront API and only then mounts React,
 * which replaces the placeholders with the looks in a single render. The
 * skeleton therefore stays up, from the first paint, until there is something
 * to show in its place.
 *
 * The Shopify theme editor re-renders a whole section every time the merchant
 * changes a setting. Without the shopify:section:load / :unload handling below,
 * the section would either go blank after an edit or leak a second React root
 * on top of the first.
 */

const SELECTOR = '[data-lookbook]';

/*
 * The theme editor can re-insert (and therefore re-run) a section script tag
 * when the section is re-rendered. Hanging the root registry off window keeps a
 * second execution from losing track of the roots the first one created, which
 * would otherwise mount React twice into the same node.
 *
 * An element maps to `null` while its first looks are loading, so a second
 * mount call does not start another request, and an unmount during the load is
 * noticed when the load finishes.
 */
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
    // Almost always an unescaped character from Liquid — check that every field
    // in snippets/lookbook.liquid is piped through the `json` filter.
    console.error('[lookbook] could not parse JSON payload', error);
    return null;
  }
}

async function mount(el) {
  if (roots.has(el)) return;

  const payload = readPayload(el);
  if (!payload) return;

  roots.set(el, null);

  const loader = createLookbookLoader(payload.source);
  let firstBatch;
  try {
    firstBatch = await loader.next();
  } catch (error) {
    console.error('[lookbook] could not load looks from the Storefront API', error);
    firstBatch = { entries: [], hasMore: false, failed: true };
  }

  // Unmounted by the theme editor while the looks were loading.
  if (roots.get(el) !== null || !el.isConnected) return;

  const root = createRoot(el);
  roots.set(el, root);
  root.render(<Lookbook {...payload} loader={loader} firstBatch={firstBatch} />);
}

function unmount(el) {
  if (!roots.has(el)) return;

  const root = roots.get(el);
  roots.delete(el);
  // Deferred so React is never asked to unmount mid-render.
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

// Same reason as the registry above: register the editor listeners only once.
if (!window.__lookbookListening) {
  window.__lookbookListening = true;

  // Fired by the theme editor only — no-ops on the live storefront.
  document.addEventListener('shopify:section:load', (event) => mountWithin(event.target));
  document.addEventListener('shopify:section:unload', (event) => unmountWithin(event.target));
}
