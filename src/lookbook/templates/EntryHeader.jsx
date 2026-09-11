// A look's title, sub heading and description. Shared by every template.

import RichText from '../RichText.jsx';

export default function EntryHeader({ entry, showSubHeading, showDescription }) {
  const { title, subHeading, descriptionTree } = entry;

  return (
    <header className="lookbook__entry-header">
      {title && <h3 className="lookbook__entry-title h2">{title}</h3>}

      {showSubHeading && subHeading && (
        <p className="lookbook__entry-subheading">{subHeading}</p>
      )}

      {showDescription && (
        <RichText tree={descriptionTree} className="lookbook__entry-description rte" />
      )}
    </header>
  );
}
