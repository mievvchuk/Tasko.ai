import { docsUrl } from "../help";
import type { HelpArticle } from "../help";
import { useLanguage } from "../i18n";

// Список підказок: клік розгортає коротку відповідь, а внизу — перехід до повної статті
export function HelpArticleList({ articles }: { articles: HelpArticle[] }) {
  const { language, tr } = useLanguage();
  return (
    <ul className="help-list">
      {articles.map((article) => (
        <li key={article.id}>
          <details>
            <summary>
              <i className={`bi ${article.icon}`} aria-hidden="true"></i>
              <span>{article.title[language]}</span>
              <i
                className="bi bi-chevron-down help-chevron"
                aria-hidden="true"
              ></i>
            </summary>
            <div className="help-answer">
              <p>{article.summary[language]}</p>
              <a
                href={docsUrl(language, article.id)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {tr("Перейти до повної довідки")}
                <i
                  className="bi bi-arrow-up-right"
                  aria-label={tr("відкриється в новій вкладці")}
                ></i>
              </a>
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
