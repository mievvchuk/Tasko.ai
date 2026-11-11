// Індекс для пошуку по довідці: заголовок, опис і текст кожної статті поточної мови.
// Потрапляє в глобальні дані сайту; його читає src/theme/SearchBar.js.
const fs = require("fs");
const path = require("path");

// Markdown → простий текст: без картинок, розмітки й адмоніцій
function plain(markdown) {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^:::\w*\s?/gm, "")
    .replace(/^\s*(?:-|\d+\.)\s+/gm, "")
    .replace(/[#*_`>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = function searchIndex(context) {
  const { currentLocale, defaultLocale } = context.i18n;
  const dir =
    currentLocale === defaultLocale
      ? path.join(context.siteDir, "docs")
      : path.join(context.siteDir, "i18n", currentLocale, "docusaurus-plugin-content-docs", "current");
  return {
    name: "search-index",
    getPathsToWatch: () => [path.join(dir, "*.md")],
    async loadContent() {
      return fs
        .readdirSync(dir)
        .filter((file) => file.endsWith(".md"))
        .map((file) => {
          const raw = fs.readFileSync(path.join(dir, file), "utf8").replace(/\r/g, "");
          const [, front = "", body = raw] = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) || [];
          const field = (name) =>
            (front.match(new RegExp(`^${name}:\\s*(.*)$`, "m"))?.[1] ?? "").trim().replace(/^"(.*)"$/, "$1");
          return {
            id: field("id") || file.replace(/\.md$/, ""),
            title: field("title"),
            description: field("description"),
            text: plain(body),
          };
        });
    },
    async contentLoaded({ content, actions }) {
      actions.setGlobalData(content);
    },
  };
};
