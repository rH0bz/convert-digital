/*
 * Loads a lookbook's looks through the Storefront API: the first batch as soon
 * as the section mounts, then one batch per Show more click (see storefront.js
 * for what a batch is).
 *
 * status is one of:
 *   'loading'       the first batch is on its way
 *   'error'         the first batch failed, so there is nothing to show
 *   'idle'          looks are shown and more can be loaded
 *   'loading-more'  a further batch is on its way
 *   'error-more'    a further batch failed; Show more is offered again
 *   'done'          every look is shown
 *
 * `source` comes straight from the parsed payload, so it keeps one identity for
 * the life of the section and the first batch is requested exactly once.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createLookbookLoader } from './storefront.js';

export default function useLookbookEntries(source) {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState('loading');
  const loader = useRef(null);

  const load = useCallback(
    async (isFirstBatch) => {
      loader.current ??= createLookbookLoader(source);
      setStatus(isFirstBatch ? 'loading' : 'loading-more');

      try {
        const batch = await loader.current.next();
        setEntries((current) => [...current, ...batch.entries]);
        setStatus(batch.hasMore ? 'idle' : 'done');
      } catch (error) {
        console.error('[lookbook] could not load looks from the Storefront API', error);
        setStatus(isFirstBatch ? 'error' : 'error-more');
      }
    },
    [source],
  );

  useEffect(() => {
    load(true);
  }, [load]);

  return { entries, status, loadMore: () => load(false) };
}
