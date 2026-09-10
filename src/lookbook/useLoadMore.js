/*
 * State for "Load more looks".
 *
 * Starts from the entries Liquid rendered and appends batches fetched through
 * the Storefront API (see storefront.js). The pager is only created on the
 * first click, so a visitor who never asks for more causes no API request.
 *
 * status is one of:
 *   'idle'     the button is ready
 *   'loading'  a batch is on its way
 *   'error'    the last attempt failed; the button is offered again as a retry
 *   'done'     nothing left to load, or Load more is not offered at all
 */

import { useRef, useState } from 'react';
import { createLookbookPager } from './storefront.js';

export default function useLoadMore(initialEntries, config) {
  const [entries, setEntries] = useState(initialEntries);
  const [status, setStatus] = useState(config ? 'idle' : 'done');
  const pager = useRef(null);

  async function requestMore() {
    pager.current ??= createLookbookPager(
      config,
      initialEntries.map((entry) => entry.id),
    );
    setStatus('loading');

    try {
      const { entries: more, hasMore } = await pager.current.next();
      setEntries((current) => [...current, ...more]);
      setStatus(hasMore ? 'idle' : 'done');
    } catch (error) {
      console.error('[lookbook] could not load more looks', error);
      setStatus('error');
    }
  }

  return { entries, status, requestMore };
}
