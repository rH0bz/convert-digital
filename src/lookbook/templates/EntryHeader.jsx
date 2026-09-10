/*
 * The title / sub heading / description block of a look.
 *
 * Shared by every template so the text side of an entry stays identical across
 * layouts — only the product arrangement and the container width are what a
 * template actually changes.
 */

import RichText from '../RichText.jsx';

export default function EntryHeader({ entry, showSubHeading, showDescription }) {
  const { title, subHeading, descriptionTree, descriptionHtml } = entry;

  return (
    <header className="lookbook__entry-header">
      {title && <h3 className="lookbook__entry-title h2">{title}</h3>}

      {showSubHeading && subHeading && (
        <p className="lookbook__entry-subheading">{subHeading}</p>
      )}

      {showDescription && (
        <RichText
          tree={descriptionTree}
          html={descriptionHtml}
          className="lookbook__entry-description rte"
        />
      )}
    </header>
  );
}
