/*
 * The renderer.
 *
 * Liquid writes the section's settings and the ids of the looks to show into
 * the page (snippets/lookbook.liquid). The looks themselves are loaded through
 * the Storefront API as soon as this mounts, and more with the Show more button
 * — see useLookbookEntries.js and storefront.js.
 *
 * Each entry names a template, and the component for it comes from
 * ./templates. Per-entry templates are why the container width is set inside
 * each template rather than here — a Full width look has to escape the
 * container its neighbours sit in.
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
  source,
  labels: escapedLabels = {},
}) {
  const { entries, status, loadMore } = useLookbookEntries(source);
  // Shopify's `t` filter HTML-escapes the labels; see translations.js.
  const labels = useMemo(() => unescapeTranslations(escapedLabels), [escapedLabels]);

  // Everything loaded and nothing the token could read: draw nothing rather than an empty heading.
  if (status === 'done' && entries.length === 0) {
    return null;
  }

  /*
   * The section's own heading block, distinct from the per-entry header that
   * EntryHeader draws. Shown as soon as any one of the three has content, and
   * straight away — it comes from Liquid, so it does not wait for the API.
   */
  const hasHeader = heading || subHeading || description;
  const canLoadMore = status === 'idle' || status === 'loading-more' || status === 'error-more';

  return (
    <div className="lookbook">
      {hasHeader && (
        /*
         * `page-width` keeps the header in the theme container even when a look
         * below it runs full width, so headings line up down the page.
         *
         * Deliberately NOT using Dawn's `title-wrapper-with-link`: that class
         * sets `margin: 3rem 0 2rem` at the same specificity as `page-width`'s
         * `margin: 0 auto` but later in base.css, so it won the cascade and
         * zeroed the auto margins — the header kept its max-width but sat
         * flush against the viewport edge while the looks below stayed centred.
         */
        <div className="lookbook__header page-width">
          {heading && (
            /*
              An inline_richtext setting, so the merchant can bold or italicise
              part of it. Rendered as text it would show the tags literally.
            */
            <h2
              className={`lookbook__heading title inline-richtext ${headingSize}`}
              dangerouslySetInnerHTML={{ __html: heading }}
            />
          )}

          {subHeading && <p className="lookbook__sub-heading">{subHeading}</p>}

          {description && (
            /*
              A `richtext` setting, so this is already HTML from Liquid rather
              than the document tree a metaobject rich text field returns —
              RichText is for the latter and would not help here. Authored by
              staff in the theme editor, not by shoppers.
            */
            <div
              className="lookbook__description rte"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          )}
        </div>
      )}

      {status === 'loading' && (
        <p className="lookbook__status page-width" role="status">
          {labels.loading}
        </p>
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
