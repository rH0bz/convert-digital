/*
 * Renders a Shopify rich text field.
 *
 * Rich text metaobject fields are not HTML — they are a document tree that
 * looks like this:
 *
 *   { type: 'root', children: [
 *     { type: 'paragraph', children: [
 *       { type: 'text', value: 'Discreption', bold: false, italic: false } ] } ] }
 *
 * The Storefront API returns that tree as the field's value, serialised as
 * JSON; storefront.js parses it and it is walked here. That also means the
 * markup is fully under our control — a paragraph can become whatever the
 * design needs, rather than whatever Shopify would have emitted.
 */

function Nodes({ nodes }) {
  if (!nodes?.length) return null;
  return nodes.map((node, index) => <Node key={index} node={node} />);
}

function Node({ node }) {
  const children = <Nodes nodes={node.children} />;

  switch (node.type) {
    case 'root':
      return children;

    case 'paragraph':
      return <p>{children}</p>;

    case 'heading': {
      // Clamped so a level outside 1-6 cannot produce an invalid tag name.
      const level = Math.min(Math.max(node.level ?? 2, 1), 6);
      const Tag = `h${level}`;
      return <Tag>{children}</Tag>;
    }

    case 'list':
      return node.listType === 'ordered' ? <ol>{children}</ol> : <ul>{children}</ul>;

    case 'list-item':
      return <li>{children}</li>;

    case 'link':
      return (
        <a
          href={node.url}
          title={node.title || undefined}
          target={node.target || undefined}
          rel={node.target === '_blank' ? 'noopener noreferrer' : undefined}
        >
          {children}
        </a>
      );

    case 'text': {
      let content = node.value;
      if (node.bold) content = <strong>{content}</strong>;
      if (node.italic) content = <em>{content}</em>;
      return content;
    }

    default:
      // Unknown node type: render its children rather than dropping the content.
      return children;
  }
}

export default function RichText({ tree, className }) {
  if (!tree) return null;

  return (
    <div className={className}>
      <Node node={tree} />
    </div>
  );
}
