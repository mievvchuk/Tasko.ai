import { docsUrl } from "../help";
import type { HelpArticle } from "../help";
import { useLanguage } from "../i18n";

// Список статей: кожна відкривається на сайті довідки в новій вкладці
export function HelpArticleList({ articles }: { articles: HelpArticle[] }) {
  const { language, tr } = useLanguage();
  return (
    <ul className="help-list">
      {articles.map((article) => (
        <li key={article.id}>
          <a
            href={docsUrl(language, article.id)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <i className={`bi ${article.icon}`} aria-hidden="true"></i>
            <span>{article.title[language]}</span>
            <i
              className="bi bi-box-arrow-up-right"
              aria-label={tr("відкриється в новій вкладці")}
            ></i>
          </a>
        </li>
      ))}
    </ul>
  );
}
