import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { useAuth } from "../auth";
import { HelpArticleList, HelpArticleView } from "../components/HelpArticleView";
import { articlesFor, searchArticles } from "../help";
import { useLanguage } from "../i18n";

// /help і /help/:articleId — уся довідка (інструкції) та база знань (факти, FAQ)
export function HelpPage() {
  const { tr, language } = useLanguage();
  const { user } = useAuth();
  const { articleId } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  if (!user) return null;

  const all = articlesFor(user.role);
  const article = all.find((a) => a.id === (articleId ?? all[0].id));
  if (!article) return <Navigate to="/help" replace />;

  const shown = query.trim() ? searchArticles(query, user.role, language) : all;
  const open = (id: string) => navigate(`/help/${id}`);
  const sections = [
    { key: "guide", title: tr("Довідка") },
    { key: "kb", title: tr("База знань") },
  ] as const;

  return (
    <>
      <div className="page-heading">
        <h1>{tr("Довідка та база знань")}</h1>
        <p>
          {tr(
            "Інструкції до кожного розділу Tasko.ai, пояснення статусів і відповіді на часті запитання.",
          )}
        </p>
      </div>
      <div className="help-layout">
        <nav className="data-panel padded help-nav" aria-label={tr("Статті довідки")}>
          <input
            type="search"
            aria-label={tr("Пошук у довідці")}
            placeholder={tr("Пошук у довідці")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {sections.map(({ key, title }) => {
            const items = shown.filter((a) => a.section === key);
            return (
              items.length > 0 && (
                <section key={key}>
                  <h2 className="help-heading">{title}</h2>
                  <HelpArticleList
                    articles={items}
                    current={article.id}
                    onSelect={(a) => open(a.id)}
                  />
                </section>
              )
            );
          })}
          {shown.length === 0 && (
            <p className="help-empty">
              {tr("Нічого не знайдено. Спробуйте інші слова або запитайте Аду.")}
            </p>
          )}
        </nav>
        <div className="data-panel padded">
          <HelpArticleView article={article} />
        </div>
      </div>
    </>
  );
}
