import { memo, type ReactNode } from "react";
import { parseMessage, type Block, type Inline } from "@/features/messaging/markdown";

// Renders the safe markdown subset as React elements only: no HTML strings, so markup inside a
// message is displayed as literal text. Links open in a new tab without referrer or opener access.
export const MessageBody = memo(function MessageBody({ body }: { body: string }) {
  return <div className="flex flex-col gap-space-xs break-words type-body-md text-on-surface">{parseMessage(body).map(renderBlock)}</div>;
});

function renderBlock(block: Block, key: number): ReactNode {
  switch (block.type) {
    case "paragraph":
      return <p key={key}>{block.children.map(renderInline)}</p>;
    case "code":
      return (
        <figure key={key} className="overflow-hidden rounded-md border border-glass-line bg-surface-container-lowest">
          {block.lang ? <figcaption className="border-b border-glass-line px-space-sm py-space-2xs type-label-xs uppercase text-secondary">{block.lang}</figcaption> : null}
          {/* dir=ltr: code keeps LTR reading order even in RTL locales. */}
          <pre dir="ltr" className="overflow-x-auto p-space-sm type-code-sm text-on-surface">
            <code>{block.text}</code>
          </pre>
        </figure>
      );
    case "quote":
      return (
        <blockquote key={key} className="border-s-2 border-secondary ps-space-sm text-on-surface-variant">
          {block.children.map(renderBlock)}
        </blockquote>
      );
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List key={key} className={block.ordered ? "list-decimal ps-space-lg" : "list-disc ps-space-lg"}>
          {block.items.map((item, i) => (
            <li key={i}>{item.map(renderInline)}</li>
          ))}
        </List>
      );
    }
  }
}

function renderInline(node: Inline, key: number): ReactNode {
  switch (node.type) {
    case "text":
      return node.text;
    case "break":
      return <br key={key} />;
    case "strong":
      return <strong key={key} className="font-semibold">{node.children.map(renderInline)}</strong>;
    case "em":
      return <em key={key}>{node.children.map(renderInline)}</em>;
    case "code":
      return (
        <code key={key} dir="ltr" className="rounded-sm bg-surface-container-high px-space-2xs type-code-sm text-secondary">
          {node.text}
        </code>
      );
    case "link":
      return (
        <a key={key} href={node.href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline underline-offset-2 hover:text-primary-fixed">
          {node.children.map(renderInline)}
        </a>
      );
  }
}
