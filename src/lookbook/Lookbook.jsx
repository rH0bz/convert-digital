/*
 * The renderer. Everything it draws comes from the payload that
 * snippets/lookbook.liquid serialized — there are no fetches here, so the
 * section is fully server-rendered as far as SEO and first paint go, and React
 * only takes over the markup.
 *
 * Prices arrive pre-formatted as strings, because the currency format of the
 * shop lives in Liquid and is not available to JavaScript.
 *
 * This file no longer draws an entry itself: each entry names a template and
 * the component for it comes from ./templates. Per-entry templates are why the
 * container width is set inside each template rather than here — a Full width
 * look has to escape the container its neighbours sit in.
 */

import { resolveTemplate } from './templates/index.jsx';

export default function Lookbook({
  heading,
  headingSize = 'h1',
  subHeading,
  description,
  entries = [],
  showSubHeading = true,
  showDescription = true,
  masonryRowHeight = 120,
  productCtaLabel,
}) {
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
    </div>
  );
}
