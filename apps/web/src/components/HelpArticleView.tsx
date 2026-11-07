import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router";
import type { HelpArticle } from "../help";
import { useLanguage } from "../i18n";

// Внутрішні посилання статей (/projects/new, /help/…) ведуть через роутер, без перезавантаження
function components(onNavigate?: () => void): Components {
  return {
    a: ({ href, children }) =>
      href?.startsWith("/") ? (
        <Link to={href} onClick={onNavigate}>
          {children}
        </Link>
      ) : (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      ),
    table: ({ children }) => (
      <div className="ai-table-scroll">
        <table>{children}</table>
      </div>
    ),
  };
}

export function HelpArticleView({
  article,
  onNavigate,
}: {
  article: HelpArticle;
  onNavigate?: () => void;
}) {
  const { language } = useLanguage();
  return (
    <article className="help-article ai-answer">
      <h2>
        <i className={`bi ${article.icon}`} aria-hidden="true"></i>
        {article.title[language]}
      </h2>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={components(onNavigate)}
        skipHtml
      >
        {article.body[language]}
      </Markdown>
    </article>
  );
}

export function HelpArticleList({
  articles,
  current,
  onSelect,
}: {
  articles: HelpArticle[];
  current?: string;
  onSelect: (article: HelpArticle) => void;
}) {
  const { language } = useLanguage();
  return (
    <ul className="help-list">
      {articles.map((article) => (
        <li key={article.id}>
          <button
            type="button"
            aria-current={article.id === current ? "page" : undefined}
            onClick={() => onSelect(article)}
          >
            <i className={`bi ${article.icon}`} aria-hidden="true"></i>
            <span>{article.title[language]}</span>
            <i className="bi bi-chevron-right" aria-hidden="true"></i>
          </button>
        </li>
      ))}
    </ul>
  );
}
