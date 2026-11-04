import { trNow } from "../i18n.en.ts";
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
      aria-label={trNow("Таблиця відповіді агента")}
      tabIndex={0}
    >
      <table>{children}</table>
    </div>
  ),
};

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
// Запобіжник, якщо модель усе ж написала технічний ID: «(ID …)» прибираємо, голі UUID теж
// (UUID у посиланнях [Назва](/projects/…) лишаються — перед ними стоїть «/»).
export function hideBareIds(text: string) {
  return text
    .replace(new RegExp(`\\s*\\((?:ID|id)[:\\s]*${uuid}\\)`, "gi"), "")
    .replace(new RegExp(`\\s*\\(${uuid}\\)`, "gi"), "")
    .replace(new RegExp(`(?<![/\\w-])(?:ID[:\\s]*)?${uuid}(?![\\w-])`, "gi"), "");
}

export default function MarkdownAnswer({ children }: { children: string }) {
  return (
    <div className="ai-answer">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={components}
        skipHtml
        disallowedElements={["img"]}
      >
        {hideBareIds(children)}
      </Markdown>
    </div>
  );
}
