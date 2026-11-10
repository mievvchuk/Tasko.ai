// Сайт довідки Tasko.ai на Docusaurus. Статті — у docs/ (українською) та
// i18n/en/docusaurus-plugin-content-docs/current/ (англійською).
// Адреса застосунку, на яку ведуть посилання зі статей, — APP_URL.
const { themes } = require("prism-react-renderer");

const appUrl = process.env.APP_URL || "https://taskoai.pp.ua";

/** @type {import('@docusaurus/types').Config} */
module.exports = {
  // Назва сайту (у заголовку вкладки) не перекладається через i18n, тому нейтральна для обох мов
  title: "Tasko.ai",
  tagline: "Довідка · Help",
  favicon: "img/favicon.svg",
  url: process.env.DOCS_URL || "https://tasko-ai-docs.onrender.com",
  baseUrl: "/",
  onBrokenLinks: "throw",
  markdown: { hooks: { onBrokenMarkdownLinks: "throw" } },
  customFields: { appUrl },

  i18n: {
    defaultLocale: "uk",
    locales: ["uk", "en"],
    localeConfigs: {
      uk: { label: "Українська", htmlLang: "uk-UA" },
      en: { label: "English", htmlLang: "en-GB" },
    },
  },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          // Довідка — увесь сайт: статті відкриваються з кореня (/getting-started)
          routeBasePath: "/",
          sidebarPath: require.resolve("./sidebars.js"),
          showLastUpdateTime: false,
        },
        blog: false,
        theme: { customCss: require.resolve("./src/css/custom.css") },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: { respectPrefersColorScheme: true },
      docs: { sidebar: { hideable: true, autoCollapseCategories: false } },
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      navbar: {
        title: "Tasko.ai",
        logo: { alt: "Tasko.ai", src: "img/logo.svg" },
        items: [
          { type: "docSidebar", sidebarId: "help", position: "left", label: "Довідка" },
          { to: "/kb-faq", position: "left", label: "Часті запитання" },
          { type: "localeDropdown", position: "right" },
          { href: appUrl, position: "right", label: "Відкрити Tasko.ai" },
        ],
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "Почати",
            items: [
              { label: "Перші кроки", to: "/getting-started" },
              { label: "Ролі на платформі", to: "/kb-roles" },
            ],
          },
          {
            title: "Довідка",
            items: [
              { label: "Статуси", to: "/kb-statuses" },
              { label: "Правила платформи", to: "/kb-rules" },
            ],
          },
          {
            title: "Tasko.ai",
            items: [{ label: "Відкрити застосунок", href: appUrl }],
          },
        ],
        copyright: `Tasko.ai · ${new Date().getFullYear()}`,
      },
      prism: { theme: themes.github, darkTheme: themes.dracula },
    }),
};
