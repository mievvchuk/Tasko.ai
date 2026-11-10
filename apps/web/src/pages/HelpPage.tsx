import { useEffect } from "react";
import { useParams } from "react-router";
import { docsUrl, helpArticles } from "../help";
import { useLanguage } from "../i18n";

// /help і /help/:articleId лишились для старих посилань: переводимо на сайт довідки
export function HelpPage() {
  const { tr, language } = useLanguage();
  const { articleId } = useParams();
  const known = helpArticles.some((article) => article.id === articleId);
  const url = docsUrl(language, known ? articleId : undefined);
  useEffect(() => window.location.replace(url), [url]);
  return (
    <section className="account-panel">
      <h1>{tr("Довідка")}</h1>
      <p>
        <a href={url}>{tr("Відкрити сайт довідки")}</a>
      </p>
    </section>
  );
}
