// Поле пошуку в навбарі сайту довідки (тема classic за замовчуванням його не має).
// Статті беруться з індексу плагіна plugins/search-index.js для поточної мови.
import React, { useId, useState } from "react";
import Link from "@docusaurus/Link";
import { translate } from "@docusaurus/Translate";
import { usePluginData } from "@docusaurus/useGlobalData";
import { searchDocs } from "../search.mjs";

export default function SearchBar() {
  const docs = usePluginData("search-index");
  const [query, setQuery] = useState("");
  const resultsId = useId();
  const results = query.trim() ? searchDocs(docs, query).slice(0, 8) : null;
  const label = translate({ id: "help.search.label", message: "Пошук у довідці" });

  return (
    <div className="help-search" onKeyDown={(event) => event.key === "Escape" && setQuery("")}>
      <input
        type="search"
        className="help-search__input"
        aria-label={label}
        placeholder={label}
        aria-controls={resultsId}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {results && (
        <div id={resultsId} className="help-search__results" role="region" aria-live="polite" aria-label={label}>
          {results.length > 0 ? (
            <ul>
              {results.map((doc) => (
                <li key={doc.id}>
                  <Link to={`/${doc.id}`} onClick={() => setQuery("")}>
                    <strong>{doc.title}</strong>
                    <span>{doc.snippet}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="help-search__empty">
              {translate({ id: "help.search.empty", message: "Нічого не знайдено. Спробуйте інші слова." })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
