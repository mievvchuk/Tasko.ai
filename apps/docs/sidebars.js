// Порядок розділів у бічній панелі. Назви категорій перекладено в
// i18n/en/docusaurus-plugin-content-docs/current.json
/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
module.exports = {
  help: [
    {
      type: "category",
      label: "Початок роботи",
      collapsed: false,
      items: ["getting-started", "kb-roles", "profile-security"],
    },
    {
      type: "category",
      label: "Для клієнта",
      collapsed: false,
      items: ["create-project", "choose-freelancer"],
    },
    {
      type: "category",
      label: "Для фрілансера",
      collapsed: false,
      items: ["find-work"],
    },
    {
      type: "category",
      label: "Робота над проєктом",
      collapsed: false,
      items: [
        "project-page",
        "board",
        "submit-work",
        "milestones",
        "messages-files",
        "notifications-workload",
        "ai",
      ],
    },
    {
      type: "category",
      label: "База знань",
      collapsed: false,
      items: ["kb-statuses", "kb-rules", "complaints", "admin", "kb-faq"],
    },
  ],
};
