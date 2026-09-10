/*
 * The renderer.
 *
 * The first looks come from the JSON payload that snippets/lookbook.liquid
 * writes into the page, so their data arrives with the HTML and React draws
 * them once lookbook.js has loaded. When the payload offers Load more, further
 * looks are fetched through the Storefront API and appended after them (see
 * useLoadMore.js and storefront.js).
 *
 * Each entry names a template, and the component for it comes from
 * ./templates. Per-entry templates are why the container width is set inside
 * each template rather than here — a Full width look has to escape the
 * container its neighbours sit in.
 */

import { resolveTemplate } from './templates/index.jsx';
import useLoadMore from './useLoadMore.js';

export default function Lookbook({
  heading,
  headingSize = 'h1',
  subHeading,
  description,
  entries: initialEntries = [],
  showSubHeading = true,
  showDescription = true,
  masonryRowHeight = 120,
  productCtaLabel,
  loadMore = null,
}) {
  const { entries, status, requestMore } = useLoadMore(initialEntries, loadMore);

  if (!entries.length) {
    return null;
  }

  /*
   * The section's own heading block, distinct from the per-entry header that
   * EntryHeader draws. Shown as soon as any one of the three has content.
   */
  const hasHeader = heading || subHeading || description;

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

      {loadMore && status !== 'done' && (
        <div className="lookbook__load-more page-width">
          <button
            type="button"
            className="button button--secondary"
            onClick={requestMore}
            disabled={status === 'loading'}
            aria-busy={status === 'loading'}
          >
            {status === 'loading' ? loadMore.loadingLabel : loadMore.label}
          </button>

          {status === 'error' && (
            <p className="lookbook__load-more-error" role="alert">
              {loadMore.errorMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
