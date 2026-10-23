import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  a: ({ href, children }) => {
    if (!href) return <span>{children}</span>;
    const external = /^https?:\/\//i.test(href) || href.startsWith("//");
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {children}
      </a>
    );
  },
  table: ({ children }) => (
    <div
      className="ai-table-scroll"
      role="region"
      aria-label="Таблиця відповіді агента"
      tabIndex={0}
    >
      <table>{children}</table>
    </div>
  ),
};

export default function MarkdownAnswer({ children }: { children: string }) {
  return (
    <div className="ai-answer">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={components}
        skipHtml
        disallowedElements={["img"]}
      >
        {children}
      </Markdown>
    </div>
  );
}
