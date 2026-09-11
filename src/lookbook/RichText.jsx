/*
 * Renders a Shopify rich text field. The API returns it as a document tree
 * (root > paragraph > text, and so on), not as HTML.
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
      // Keep the level between 1 and 6 so the tag is always valid.
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
      // Unknown node type: still show its content.
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
