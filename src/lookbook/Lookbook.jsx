/*
 * Draws a lookbook: the section header, each look with its template, and the
 * Show more button. Mounted by index.jsx once the first looks have loaded.
 */

import { useMemo } from 'react';
import { resolveTemplate } from './templates/index.jsx';
import { unescapeTranslations } from './translations.js';
import useLookbookEntries from './useLookbookEntries.js';

export default function Lookbook({
  heading,
  headingSize = 'h1',
  subHeading,
  description,
  showSubHeading = true,
  showDescription = true,
  masonryRowHeight = 120,
  productCtaLabel,
  loader,
  firstBatch,
  labels: escapedLabels = {},
}) {
  const { entries, status, loadMore } = useLookbookEntries(loader, firstBatch);
  // Shopify's t filter HTML-escapes the labels; undo that for display.
  const labels = useMemo(() => unescapeTranslations(escapedLabels), [escapedLabels]);

  // Nothing could be loaded: render nothing rather than an empty heading.
  if (status === 'done' && entries.length === 0) {
    return null;
  }

  const hasHeader = heading || subHeading || description;
  const canLoadMore = status === 'idle' || status === 'loading-more' || status === 'error-more';

  return (
    <div className="lookbook">
      {hasHeader && (
        // Not Dawn's title-wrapper-with-link: its margins break the centring (docs/gotchas.md).
        <div className="lookbook__header page-width">
          {heading && (
            // A rich text setting, so it's rendered as HTML.
            <h2
              className={`lookbook__heading title inline-richtext ${headingSize}`}
              dangerouslySetInnerHTML={{ __html: heading }}
            />
          )}

          {subHeading && <p className="lookbook__sub-heading">{subHeading}</p>}

          {description && (
            // Already HTML, written in the theme editor.
            <div
              className="lookbook__description rte"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          )}
        </div>
      )}

      {status === 'error' && (
        <p className="lookbook__status page-width" role="alert">
          {labels.loadError}
        </p>
      )}

      {entries.map((entry) => {
        const Template = resolveTemplate(entry.template);

        return (
          <Template
            key={entry.id}
            entry={entry}
            showSubHeading={showSubHeading}
            showDescription={showDescription}
            masonryRowHeight={masonryRowHeight}
            productCtaLabel={productCtaLabel}
          />
        );
      })}

      {canLoadMore && (
        <div className="lookbook__load-more page-width">
          <button
            type="button"
            className="button button--secondary"
            onClick={loadMore}
            disabled={status === 'loading-more'}
            aria-busy={status === 'loading-more'}
          >
            {status === 'loading-more' ? labels.loading : labels.loadMore}
          </button>

          {status === 'error-more' && (
            <p className="lookbook__load-more-error" role="alert">
              {labels.loadMoreError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
