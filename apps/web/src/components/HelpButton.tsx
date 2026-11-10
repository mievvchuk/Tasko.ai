import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { useAuth } from "../auth";
import { articlesFor, articlesForPage, docsUrl, searchArticles } from "../help";
import { useLanguage } from "../i18n";
import { HelpArticleList } from "./HelpArticleList";

// Плаваюча кнопка «?» над кнопкою Ади: підказки до поточної сторінки, пошук і перехід до повної довідки
export function HelpButton() {
  const { tr, language } = useLanguage();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) document.getElementById("help-search")?.focus();
  }, [open]);

  if (!user) return null;

  const close = () => setOpen(false);
  const onPage = articlesForPage(pathname, user.role);
  const found = query.trim()
    ? searchArticles(query, user.role, language)
    : null;
  const popular = articlesFor(user.role).filter(
    (a) => a.section === "kb" || a.id === "getting-started",
  );

  return (
    <>
      {!open && (
        <button
          type="button"
          className="help-fab"
          aria-label={tr("Відкрити довідку")}
          title={tr("Довідка")}
          aria-controls="help-drawer"
          aria-expanded={false}
          onClick={() => setOpen(true)}
        >
          <i className="bi bi-question-lg" aria-hidden="true"></i>
        </button>
      )}
      {open && (
        <>
          <div
            className="ai-drawer-backdrop"
            aria-hidden="true"
            onClick={close}
          />
          <aside
            id="help-drawer"
            className="ai-drawer"
            role="dialog"
            aria-label={tr("Довідка")}
            onKeyDown={(event) => {
              if (event.key === "Escape") close();
            }}
          >
            <header className="ai-drawer-head">
              <span className="ai-drawer-mark" aria-hidden="true">
                <i className="bi bi-question-lg"></i>
              </span>
              <div>
                <strong>{tr("Довідка")}</strong>
                <small>{tr("Підказки до цієї сторінки")}</small>
              </div>
              <a
                className="ai-drawer-action"
                href={docsUrl(language)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={tr("Відкрити сайт довідки")}
                title={tr("Відкрити сайт довідки")}
              >
                <i className="bi bi-box-arrow-up-right" aria-hidden="true"></i>
              </a>
              <button
                type="button"
                className="ai-drawer-action"
                aria-label={tr("Закрити довідку")}
                onClick={close}
              >
                <i className="bi bi-x-lg" aria-hidden="true"></i>
              </button>
            </header>
            <div className="ai-drawer-body help-drawer-body">
              <>
                <input
                  id="help-search"
                  type="search"
                  aria-label={tr("Пошук у довідці")}
                  placeholder={tr("Пошук у довідці")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {found ? (
                  found.length > 0 ? (
                    <HelpArticleList articles={found} />
                  ) : (
                    <p className="help-empty">
                      {tr(
                        "Нічого не знайдено. Спробуйте інші слова або запитайте Аду.",
                      )}
                    </p>
                  )
                ) : (
                  <>
                    {onPage.length > 0 && (
                      <section>
                        <h3 className="help-heading">
                          {tr("На цій сторінці")}
                        </h3>
                        <HelpArticleList articles={onPage} />
                      </section>
                    )}
                    <section>
                      <h3 className="help-heading">{tr("Корисне")}</h3>
                      <HelpArticleList
                        articles={popular.filter((a) => !onPage.includes(a))}
                      />
                    </section>
                    <a
                      className="help-all"
                      href={docsUrl(language)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {tr("Уся довідка та база знань")}
                      <i
                        className="bi bi-box-arrow-up-right"
                        aria-hidden="true"
                      ></i>
                    </a>
                  </>
                )}
              </>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
