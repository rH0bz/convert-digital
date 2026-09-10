import { createRoot } from 'react-dom/client';
import Lookbook from './Lookbook.jsx';

/*
 * Mount layer.
 *
 * Liquid renders an empty <div data-lookbook="<id of a JSON script tag>"> plus
 * a <script type="application/json"> holding the lookbook data. This file finds
 * those pairs and mounts React into them.
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
    // in sections/lookbook.liquid is piped through the `json` filter.
    console.error('[lookbook] could not parse JSON payload', error);
    return null;
  }
}

function mount(el) {
  if (roots.has(el)) return;

  const payload = readPayload(el);
  if (!payload) return;

  const root = createRoot(el);
  roots.set(el, root);
  root.render(<Lookbook {...payload} />);
}

function unmount(el) {
  const root = roots.get(el);
  if (!root) return;

  roots.delete(el);
  // Deferred so React is never asked to unmount mid-render.
  queueMicrotask(() => root.unmount());
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
