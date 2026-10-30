// Переклад інтерфейсу за українським текстом (як у gettext): ключ — текст
// із tr("…"), {0}, {1} — місця для значень. Повноту перевіряє test/i18n.test.mjs.

export type Language = "uk" | "en";

// Поточна мова для коду поза React (api.ts, format.ts). LanguageProvider
// записує її в <html lang> одразу при перемиканні, ще до перемальовування.
export function uiLanguage(): Language {
  return globalThis.document?.documentElement.lang === "en" ? "en" : "uk";
}

export function uiLocale() {
  return uiLanguage() === "en" ? "en-GB" : "uk-UA";
}

// Якщо перекладу немає, лишається український текст
export function translate(
  language: Language,
  text: string,
  args: (string | number)[] = [],
) {
  const result = language === "en" ? (enText[text] ?? text) : text;
  return result.replace(/\{(\d+)\}/g, (match, index: string) =>
    index in args ? String(args[Number(index)]) : match,
  );
}

export function trNow(text: string, ...args: (string | number)[]) {
  return translate(uiLanguage(), text, args);
}

export const enText: Record<string, string> = {
  // Загальне, помилки, сеанс
  "Запит скасовано.": "Request cancelled.",
  "Не вдалося виконати дію. Спробуйте ще раз.":
    "Couldn't complete the action. Try again.",
  "Сервер недоступний або не відповідає. Перевірте з’єднання та спробуйте ще раз.":
    "The server is unavailable or not responding. Check your connection and try again.",
  "Сервер повернув некоректну відповідь. Спробуйте пізніше.":
    "The server returned an invalid response. Try again later.",
  "Не вдалося виконати запит. Спробуйте пізніше.":
    "Couldn't complete the request. Try again later.",
  "Перевірте введені дані та спробуйте ще раз.":
    "Check the entered data and try again.",
  "Потрібно увійти до облікового запису.": "You need to sign in.",
  "У вас немає доступу до цієї дії.": "You don't have access to this action.",
  "Перевіряємо ваш сеанс…": "Checking your session…",
  "Не вдалося відновити сеанс": "Couldn't restore the session",
  "Спробувати ще раз": "Try again",
  "Повернутися до входу": "Back to sign in",
  "Сторінку не знайдено": "Page not found",
  "Перевірте адресу або поверніться до робочого простору.":
    "Check the address or go back to your workspace.",
  "На головну": "Go to dashboard",
  "Доступ до сховища браузера обмежено. Закрийте цю вкладку, щоб завершити сеанс.":
    "Browser storage access is restricted. Close this tab to end the session.",
  "Сеанс завершено або обліковий запис недоступний. Увійдіть ще раз.":
    "The session has ended or the account is unavailable. Sign in again.",
  "Сервер не повернув дані для входу.":
    "The server didn't return sign-in data.",
  "Дозвольте збереження даних для цього сайту в налаштуваннях браузера.":
    "Allow this site to store data in your browser settings.",
  "Не вдалося завантажити дані": "Couldn't load data",
  "Завантажуємо дані…": "Loading data…",
  "Не визначено": "Not set",
  "Невідомий браузер": "Unknown browser",
  "{0} на {1}": "{0} on {1}",
  "…": "…",
  Оновити: "Refresh",
  "Оновити дані": "Refresh data",
  "Зберігаємо…": "Saving…",
  Зберегти: "Save",
  Скасувати: "Cancel",
  Видалити: "Delete",
  Знайти: "Search",
  Пошук: "Search",
  Назва: "Title",
  Опис: "Description",
  Статус: "Status",
  "Статус:": "Status:",
  Роль: "Role",
  Пароль: "Password",
  Пошта: "Email",
  "Електронна пошта": "Email",
  "Ім'я": "Name",
  з: "of",
  із: "of",
  Із: "Of",
  грн: "UAH",
  "{0} грн": "{0} UAH",
  "{0}–{1} грн": "{0}–{1} UAH",
  КБ: "KB",
  днів: "days",
  "{0} днів": "{0} days",
  "Не вказано": "Not specified",
  "не вказано": "not specified",
  "Необов’язково": "Optional",
  "← Назад": "← Back",
  "← Повернутися": "← Back",
  "← До проєкту": "← Back to project",
  "До проєкту": "To project",
  Сторінка: "Page",
  "Сторінка {0}": "Page {0}",
  "· Показано:": "· Shown:",
  "← Попередня": "← Previous",
  "Наступна →": "Next →",
  "Сторінки списку": "List pages",

  // Меню, тема
  Сповіщення: "Notifications",
  Скарги: "Complaints",
  Тема: "Theme",
  "Тема сайту": "Site theme",
  Світла: "Light",
  Темна: "Dark",
  Системна: "System",

  // Ада (AI-помічниця)
  Ада: "Ada",
  "аналізує дані": "is analysing data",
  "Напишіть запитання.": "Write a question.",
  "Можна прикріпити до {0} файлів.": "You can attach up to {0} files.",
  "Кожен файл має бути до 5 МБ.": "Each file must be up to 5 MB.",
  "Привіт! Я": "Hi! I'm",
  "Запитайте про проєкти, завдання чи дедлайни.":
    "Ask about projects, tasks or deadlines.",
  "Ваше запитання": "Your question",
  "Прикріплені файли": "Attached files",
  "Поза темою системи": "Off topic",
  "Форматуємо відповідь…": "Formatting the answer…",
  "Спробуйте запитати": "Try asking",
  "Запитання до Ади": "Question for Ada",
  "Файли до запитання": "Files for the question",
  обрізано: "truncated",
  "Прибрати файл {0}": "Remove file {0}",
  "Напишіть повідомлення…": "Write a message…",
  "Прикріпити файл": "Attach file",
  "Прикріпити файл: TXT, PDF або DOCX, до 5 МБ, не більше 3":
    "Attach a file: TXT, PDF or DOCX, up to 5 MB, no more than 3",
  "Enter — надіслати, Shift+Enter — новий рядок":
    "Enter to send, Shift+Enter for a new line",
  "Скасувати запит": "Cancel request",
  "Надіслати запит": "Send request",
  "Читаємо файл…": "Reading the file…",
  "Я зараз на сторінці завдання з ID {0}.": "I'm on the task page with ID {0}.",
  "Я зараз на сторінці проєкту з ID {0}.":
    "I'm on the project page with ID {0}.",
  "Відкрити помічницю {0}": "Open assistant {0}",
  "AI-помічниця {0}": "AI assistant {0}",
  "Бачить поточну сторінку": "Sees the current page",
  "Питання про Tasko.ai": "Questions about Tasko.ai",
  "Почати нову розмову": "Start a new chat",
  "Відкрити на всю сторінку": "Open full page",
  "Закрити панель помічниці": "Close assistant panel",
  "Підключаємося до агента…": "Connecting to the agent…",
  "AI-провайдер ще не підключений. Зверніться до адміністратора.":
    "The AI provider isn't connected yet. Contact the administrator.",
  "AI-помічниця Tasko.ai: дедлайни, завдання, етапи, заявки й завантаження команди.":
    "Tasko.ai AI assistant: deadlines, tasks, milestones, applications and team workload.",
  "Нова розмова": "New chat",
  "Бачу лише дані, доступні вам, і пам'ятаю цю розмову. Вона ж відкривається кнопкою «":
    "I only see data available to you and remember this chat. It also opens with the “",
  "» на будь-якій сторінці.": "” button on any page.",
  "Вибраний проєкт": "Selected project",
  "Запитати про всі доступні проєкти": "Ask about all available projects",
  "Проєкт з ID {0}.": "Project with ID {0}.",
  "Дані проєкту": "Project data",
  "Таблиця відповіді агента": "Agent answer table",
  "Список проєктів": "Project list",
  "Підсумок проєкту": "Project summary",
  Дедлайни: "Deadlines",
  "Завантаження команди": "Team workload",
  "Загальна статистика": "Overall statistics",
  "Деталі завдання": "Task details",
  "Етапи проєкту": "Project milestones",
  "Повідомлення проєкту": "Project messages",
  "Біржа проєктів": "Project marketplace",
  "Підсумуй стан моїх проєктів": "Summarise the state of my projects",
  "Які завдання прострочені або під ризиком?":
    "Which tasks are overdue or at risk?",
  "Чи є нові заявки на мої проєкти?":
    "Are there new applications for my projects?",
  "Хто з команди найбільш завантажений?": "Who on the team is the busiest?",
  "Що мені зробити першим сьогодні?": "What should I do first today?",
  "Які мої найближчі дедлайни?": "What are my nearest deadlines?",
  "Знайди відкриті проєкти на біржі": "Find open projects on the marketplace",
  "Які в мене непрочитані сповіщення?": "What unread notifications do I have?",
  "Покажи загальну статистику": "Show overall statistics",
  "Які проєкти мають прострочені завдання?":
    "Which projects have overdue tasks?",
  "Хто з виконавців найбільш завантажений?": "Which freelancer is the busiest?",
  "Які завдання чекають на перевірку?": "Which tasks are waiting for review?",
  "Думаю над запитанням": "Thinking about the question",
  "Переглядаю ваші проєкти": "Looking through your projects",
  "Перевіряю завдання й дедлайни": "Checking tasks and deadlines",
  "Зіставляю дані": "Matching the data",
  "Формую відповідь": "Writing the answer",

  // Файли, команда, відгуки
  "Робочий процес": "Workflow",
  "Файл має бути непорожнім і не перевищувати 10 МБ.":
    "The file must not be empty and must not exceed 10 MB.",
  "Файл для завантаження": "File to upload",
  "PDF, PNG, JPG, DOCX, ZIP або TXT (UTF-8), до 10 МБ.":
    "PDF, PNG, JPG, DOCX, ZIP or TXT (UTF-8), up to 10 MB.",
  "Завантажуємо…": "Uploading…",
  "Завантажити файл": "Upload file",
  "Отримуємо файл…": "Getting the file…",
  "Фрилансера додано до команди.": "Freelancer added to the team.",
  "Основного виконавця обрано через заявку. За потреби додайте інших фрилансерів для окремих завдань: вони отримають доступ до даних цього проєкту.":
    "The main freelancer was chosen through an application. Add other freelancers for separate tasks if needed: they'll get access to this project's data.",
  "Додатковий виконавець": "Additional freelancer",
  "Оберіть фрилансера": "Choose a freelancer",
  "Додаємо…": "Adding…",
  "Додати до команди": "Add to team",
  "На цій сторінці немає інших активних фрилансерів.":
    "There are no other active freelancers on this page.",
  "Відгук збережено": "Review saved",
  "Залишити відгук": "Leave a review",
  "Відгук про": "Review of",
  Оцінка: "Rating",
  "5 — Відмінно": "5 — Excellent",
  "4 — Добре": "4 — Good",
  "3 — Задовільно": "3 — Fair",
  "2 — Погано": "2 — Poor",
  "1 — Дуже погано": "1 — Very poor",
  Коментар: "Comment",

  // Профіль фрилансера
  "Профіль збережено.": "Profile saved.",
  "Завантажуємо профіль…": "Loading profile…",
  "Профіль фрилансера": "Freelancer profile",
  "Ці дані бачить клієнт під час вибору виконавця.":
    "Clients see this when choosing a freelancer.",
  "Про себе": "About me",
  "Ставка за годину, грн": "Hourly rate, UAH",
  "Ставка за годину": "Hourly rate",
  Доступність: "Availability",
  Доступний: "Available",
  Зайнятий: "Busy",
  Недоступний: "Unavailable",
  "Навички через кому": "Skills, comma-separated",
  Навички: "Skills",
  "Зберегти профіль": "Save profile",
  Портфоліо: "Portfolio",
  "HTTPS-посилання": "HTTPS link",
  "Додати роботу": "Add work",
  "Профіль виконавця та відгуки клієнтів.":
    "Freelancer profile and client reviews.",
  "Фрилансер ще не додав опис.":
    "The freelancer hasn't added a description yet.",
  "Середній рейтинг із 5": "Average rating out of 5",
  "Завершено проєктів": "Completed projects",
  "Середній строк у днях": "Average time in days",
  Відгуків: "Reviews",
  "Активних завдань": "Active tasks",
  "Виконано вчасно": "Completed on time",
  "Робіт у портфоліо ще немає.": "No portfolio work yet.",
  "Відгуки клієнтів": "Client reviews",
  "Клієнт не додав коментар.": "The client didn't add a comment.",
  "Завершений проєкт": "Completed project",
  "Відгуків ще немає": "No reviews yet",
  "Перший відгук з’явиться після завершення проєкту.":
    "The first review will appear after a project is completed.",

  // Безпека й профіль
  "Нові паролі не збігаються.": "The new passwords don't match.",
  "Сеанс завершено.": "Session ended.",
  Безпека: "Security",
  "Зміна пароля": "Change password",
  "Після зміни інші активні сеанси завершаться.":
    "Other active sessions will end after the change.",
  "Поточний пароль": "Current password",
  "Новий пароль": "New password",
  "Повторіть новий пароль": "Repeat the new password",
  "Змінити пароль": "Change password",
  "Двофакторний вхід": "Two-factor sign-in",
  Увімкнено: "On",
  Вимкнено: "Off",
  "· код із Google Authenticator або іншого TOTP-застосунку":
    "· code from Google Authenticator or another TOTP app",
  "Увімкнути 2FA": "Turn on 2FA",
  "QR-код для налаштування 2FA": "QR code for 2FA setup",
  "Відскануйте QR-код або введіть секрет вручну:":
    "Scan the QR code or enter the secret manually:",
  "Код із застосунку": "Code from the app",
  "Підтвердити 2FA": "Confirm 2FA",
  "Вимкнути 2FA": "Turn off 2FA",
  "Активні сеанси": "Active sessions",
  "Пристрої, на яких зараз виконано вхід.": "Devices currently signed in.",
  "Поточний сеанс": "Current session",
  "Інший пристрій": "Other device",
  "IP невідомий": "IP unknown",
  Завершити: "End",
  "Оберіть фото PNG, JPG або WEBP розміром до 2 МБ.":
    "Choose a PNG, JPG or WEBP photo up to 2 MB.",
  "Фото профілю оновлено.": "Profile photo updated.",
  "Ім'я збережено.": "Name saved.",
  "Мій профіль": "My profile",
  "Фото, особисті дані, профіль виконавця та безпека облікового запису.":
    "Photo, personal details, freelancer profile and account security.",
  "Змінити фото": "Change photo",
  "Додати фото": "Add photo",
  "Фото профілю видалено.": "Profile photo removed.",
  "PNG, JPG або WEBP, до 2 МБ": "PNG, JPG or WEBP, up to 2 MB",
  "Змінити ім'я": "Change name",
  "У Tasko.ai з": "On Tasko.ai since",
  "Як мій профіль бачать клієнти": "How clients see my profile",

  // Проєкти й таблиці
  Проєкт: "Project",
  Проєкти: "Projects",
  "Виберіть проєкт": "Select a project",
  "Обраний проєкт": "Selected project",
  "На цій сторінці немає доступних проєктів.":
    "There are no available projects on this page.",
  "Гортайте таблицю вбік, щоб побачити всі стовпці.":
    "Scroll the table sideways to see all columns.",
  "Таблиця проєктів": "Projects table",
  Завдання: "Tasks",
  Дедлайн: "Deadline",
  "Опис проєкту": "Project description",
  "Опис не додано.": "No description added.",
  "Виконання проєкту ": "Project progress ",
  "Пошук за назвою": "Search by title",
  "Введіть частину назви": "Enter part of the title",
  Виконавець: "Assignee",
  "Усі виконавці": "All assignees",
  "Учасник недоступний": "Member unavailable",
  "Лише прострочені": "Overdue only",
  "Завдань не знайдено": "No tasks found",
  "Змініть фільтри або створіть завдання.":
    "Change the filters or create a task.",
  "Таблиця завдань": "Tasks table",
  Пріоритет: "Priority",
  "Не призначено": "Unassigned",
  "Доступні вам проєкти, їхній стан і прогрес виконання.":
    "Projects available to you, their status and progress.",
  "Від нових до раніше створених": "Newest first",
  "Статус проєкту": "Project status",
  "Завантажуємо проєкти…": "Loading projects…",
  "Проєктів не знайдено": "No projects found",
  "Тут відображатимуться проєкти, до яких вас додасть клієнт.":
    "Projects a client adds you to will appear here.",
  "На цій сторінці немає доступних проєктів із вибраним статусом.":
    "There are no projects with the selected status on this page.",
  "Скинути фільтр": "Reset filter",
  "Сторінки проєктів": "Project pages",
  "Оберіть проєкт, щоб переглянути та організувати роботу команди.":
    "Choose a project to view and organise the team's work.",

  // Адміністрування
  "Доступ заборонено": "Access denied",
  "Ця сторінка доступна лише адміністратору.":
    "This page is available to administrators only.",
  "Панель адміністратора": "Admin dashboard",
  "Статистика всієї платформи, облікові записи та скарги.":
    "Platform-wide statistics, accounts and complaints.",
  Користувачі: "Users",
  "Пошук користувача": "Search users",
  "Ім'я або email": "Name or email",
  "Усі ролі": "All roles",
  "Стан облікового запису": "Account status",
  "Усі стани": "All statuses",
  "За цими умовами користувачів не знайдено.": "No users match these filters.",
  "На цій сторінці користувачів не знайдено.": "No users on this page.",
  "заблоковано: {0}": "blocked: {0}",
  "активні: {0}": "active: {0}",
  "завершено: {0}": "completed: {0}",
  Прострочені: "Overdue",
  "завдань після дедлайну": "tasks past deadline",
  "Нові за останні 6 місяців": "New in the last 6 months",
  "Користувачі за ролями": "Users by role",
  "Проєкти за статусами": "Projects by status",
  "Завдання за статусами": "Tasks by status",
  "Експорт звіту": "Report export",
  "Завантажити звіт:": "Download report:",
  "Готуємо…": "Preparing…",
  "Рішення адміністратора": "Administrator's decision",
  "Модерація скарг": "Complaint moderation",
  "Рішення не блокує користувача автоматично.":
    "A decision doesn't block the user automatically.",
  "Автор:": "Author:",
  "· Ціль:": "· Target:",
  "Коментар рішення": "Decision comment",
  Відхилити: "Reject",
  " (ви)": " (you)",
  "Зареєстровано:": "Registered:",
  "Роль користувача": "User role",
  "Стан користувача": "User status",
  "Зберегти користувача": "Save user",
  "Змінити власну роль або заблокувати себе не можна.":
    "You can't change your own role or block yourself.",
  Активний: "Active",
  Заблокований: "Blocked",

  // Скарги
  "Опишіть проблему для адміністратора. Вкажіть UUID користувача або проєкту.":
    "Describe the problem for the administrator. Specify the user or project UUID.",
  "UUID користувача": "User UUID",
  "UUID проєкту": "Project UUID",
  Причина: "Reason",
  "Надіслати скаргу": "Send complaint",
  "Відповідь адміністратора:": "Administrator's reply:",
  "Очікує розгляду": "Awaiting review",

  // Головна панель
  "Головна панель": "Dashboard",
  "Ваші проєкти, завдання та терміни виконання — перед очима.":
    "Your projects, tasks and deadlines at a glance.",
  "Ви керуєте власними проєктами": "You manage your own projects",
  "Ви виконуєте проєкти, на які вас обрав клієнт":
    "You work on projects clients chose you for",
  "Ви контролюєте роботу сервісу": "You oversee the service",
  "Опублікуйте проєкт, перегляньте заявки та оберіть виконавця.":
    "Publish a project, review applications and choose a freelancer.",
  "Знайдіть відкритий проєкт на біржі та залиште свою пропозицію.":
    "Find an open project on the marketplace and make your offer.",
  "Переглядайте проєкти, користувачів і аналітичний звіт.":
    "Review projects, users and the analytics report.",
  "Опублікувати проєкт": "Publish a project",
  "Перейти на біржу": "Go to marketplace",
  "Завантажуємо огляд…": "Loading overview…",
  Статистика: "Statistics",
  "Активні проєкти": "Active projects",
  "доступних проєктів": "available projects",
  "Усі завдання": "All tasks",
  "Завершено:": "Completed:",
  "У процесі": "In progress",
  "Завдання у виконанні": "Tasks in progress",
  "Найближчий дедлайн": "Nearest deadline",
  "Прострочених завдань:": "Overdue tasks:",
  "Останні активні проєкти, до яких ви маєте доступ":
    "Recent active projects you have access to",
  "Усі проєкти": "All projects",
  "Активних проєктів поки немає": "No active projects yet",
  "Проєкти у плануванні та з іншими статусами доступні в загальному списку.":
    "Projects in planning or other statuses are in the full list.",
  "Переглянути проєкти →": "View projects →",
  "Завдання за статусом": "Tasks by status",
  "Розподіл усіх доступних завдань": "Breakdown of all available tasks",
  "Завдань поки немає": "No tasks yet",
  "Статистика з'явиться після створення завдань у доступних проєктах.":
    "Statistics will appear once tasks are created in your projects.",
  "Дедлайни завдань": "Task deadlines",
  "Першими показано найраніші, включно з простроченими":
    "Earliest first, including overdue",
  Прострочено: "Overdue",
  "Дедлайнів немає": "No deadlines",
  "Немає незавершених завдань із визначеним терміном.":
    "No unfinished tasks with a set deadline.",

  // Файли проєкту
  "Файли проєкту": "Project files",
  "Проєкт закрито. Файли доступні для завантаження.":
    "The project is closed. Files are available for download.",
  "На цій сторінці файлів немає.": "No files on this page.",
  " · Прикріплено до результату роботи": " · Attached to a work result",

  // Біржа
  "Відкриті проєкти": "Open projects",
  "Оберіть проєкт, запропонуйте бюджет і строк виконання. Після вибору клієнтом проєкт з’явиться у вашому робочому просторі.":
    "Pick a project and propose a budget and timeline. Once the client chooses you, the project will appear in your workspace.",
  "Назва або опис": "Title or description",
  "Лише обране": "Favourites only",
  "Клієнт не додав опис.": "The client didn't add a description.",
  "Видалити з обраного": "Remove from favourites",
  "Додати в обране": "Add to favourites",
  "★ В обраному": "★ In favourites",
  "☆ До обраного": "☆ Add to favourites",
  Опубліковано: "Published",
  Бюджет: "Budget",
  Категорія: "Category",
  "Без категорії": "No category",
  "Статус заявки:": "Application status:",
  "Супровідне повідомлення": "Cover message",
  "Коротко опишіть досвід і спосіб виконання":
    "Briefly describe your experience and approach",
  "Бюджет, грн": "Budget, UAH",
  "Строк, днів": "Timeline, days",
  "Надсилаємо…": "Sending…",
  "Надіслати заявку": "Send application",
  "Залишити заявку": "Apply",
  "Відкритих проєктів поки немає": "No open projects yet",
  "Нові пропозиції клієнтів з’являться на цій сторінці.":
    "New client offers will appear on this page.",

  // Повідомлення й сповіщення
  Повідомлення: "Messages",
  "Обговорення доступні лише учасникам відповідного проєкту.":
    "Discussions are only available to members of the project.",
  "Напишіть повідомлення.": "Write a message.",
  "Клієнт проєкту": "Project client",
  "Користувач ": "User ",
  "Оновити повідомлення": "Refresh messages",
  "На цій сторінці повідомлень немає.": "No messages on this page.",
  "Перша сторінка містить найновіші повідомлення. Наступні сторінки — раніші.":
    "The first page has the newest messages. Later pages have older ones.",
  "Проєкт закрито. Обговорення доступне для читання.":
    "The project is closed. The discussion is read-only.",
  "Нове повідомлення": "New message",
  "Надіслати повідомлення": "Send message",
  "Події ваших проєктів і завдань.": "Events in your projects and tasks.",
  "Прочитати всі": "Mark all as read",
  "Позначити прочитаним": "Mark as read",
  "Сповіщень немає": "No notifications",

  // Замовлення, історія
  Замовлення: "Orders",
  "Створити замовлення": "Create order",
  "Замовлення проєкту": "Project orders",
  "На цій сторінці замовлень немає.": "No orders on this page.",
  "Створено:": "Created:",
  "· Оновлено:": "· Updated:",
  "Розпочати замовлення": "Start order",
  "Завершити замовлення": "Complete order",
  "Скасувати це замовлення? Повернути його в роботу буде неможливо.":
    "Cancel this order? It can't be returned to work.",
  "Скасувати замовлення": "Cancel order",
  "Історія активності": "Activity history",
  Система: "System",
  "Подій ще немає": "No events yet",

  // Заявки
  Заявки: "Applications",
  "Заявки фрилансерів": "Freelancer applications",
  "Порівняйте пропозиції, досвід, рейтинг і середній строк виконання.":
    "Compare offers, experience, rating and average delivery time.",
  "AI аналізує…": "AI is analysing…",
  "Порівняти заявки через AI": "Compare applications with AI",
  "Переглянути профіль": "View profile",
  "AI-оцінка:": "AI score:",
  "Запропонований бюджет": "Proposed budget",
  Строк: "Timeline",
  Рейтинг: "Rating",
  "Ще немає": "None yet",
  "Середній строк": "Average time",
  "Ще немає даних": "No data yet",
  "Заявка надіслана": "Application sent",
  "Обираємо…": "Choosing…",
  "Обрати виконавця": "Choose freelancer",
  "Заявок ще немає": "No applications yet",
  "Фрилансери побачать проєкт на біржі та зможуть відгукнутися.":
    "Freelancers will see the project on the marketplace and can apply.",

  // Дошка, деталі проєкту
  "Дошка завдань": "Task board",
  "Затисніть картку мишею й перетягніть між «До виконання» і «У процесі».":
    "Drag a card between “To do” and “In progress”.",
  "Статус завдання змінює призначений виконавець.":
    "The task status is changed by the assignee.",
  Порожньо: "Empty",
  "Без опису": "No description",
  "Статус {0}": "Status {0}",
  "Завантажуємо проєкт…": "Loading project…",
  "← До списку проєктів": "← Back to projects",
  "Робочі проєкти": "Work projects",
  "Мої проєкти": "My projects",
  "Редагувати проєкт": "Edit project",
  "Створити завдання": "Create task",
  "Розділи проєкту": "Project sections",
  Файли: "Files",
  Етапи: "Milestones",
  Історія: "History",
  "Аналіз AI": "AI analysis",
  "AI-планування": "AI planning",
  "Огляд проєкту": "Project overview",
  Фрилансери: "Freelancers",
  Виконано: "Done",
  завдань: "tasks",
  "Прогрес проєкту": "Project progress",
  "Завдання проєкту": "Project tasks",
  "Усі статуси": "All statuses",
  "Усі пріоритети": "All priorities",
  "На цій сторінці немає завдань із вибраними фільтрами.":
    "No tasks with the selected filters on this page.",
  "Сторінки завдань": "Task pages",
  "· У проєкті:": "· In project:",
  "Учасники проєкту": "Project members",
  "Користувач недоступний": "User unavailable",
  Учасник: "Member",
  "Виконавця ще не обрано. Перейдіть до заявок фрилансерів.":
    "No freelancer chosen yet. Go to freelancer applications.",

  // Форма проєкту
  "Редагування недоступне": "Editing unavailable",
  "Завершений або скасований проєкт не можна змінювати.":
    "A completed or cancelled project can't be changed.",
  "Створювати проєкти може клієнт, а редагувати — власник або адміністратор.":
    "Clients can create projects; the owner or an administrator can edit them.",
  "Повернутися до проєктів": "Back to projects",
  "Назва має містити щонайменше 2 символи.":
    "The title must be at least 2 characters.",
  "Перевірте дату дедлайну.": "Check the deadline date.",
  "Дедлайн проєкту має бути в майбутньому.":
    "The project deadline must be in the future.",
  "Максимальний бюджет не може бути меншим за мінімальний.":
    "The maximum budget can't be less than the minimum.",
  "Створити проєкт": "Create project",
  "Назва обов’язкова. Дедлайн указується за місцевим часом.":
    "Title is required. The deadline is in local time.",
  "Назва проєкту": "Project title",
  "Новий дедлайн має бути в майбутньому.":
    "The new deadline must be in the future.",
  "Бюджет від, грн": "Budget from, UAH",
  "Бюджет до, грн": "Budget to, UAH",
  "Потрібні навички": "Required skills",
  "Новий проєкт матиме статус «Пошук виконавця» і буде доступний фрилансерам.":
    "The new project will have the “Looking for a freelancer” status and be visible to freelancers.",
  "Після закриття редагування буде недоступне. Для завершення всі завдання та замовлення мають бути закриті.":
    "After closing, editing won't be available. To complete, all tasks and orders must be closed.",
  "Зберегти проєкт": "Save project",

  // Етапи
  "Етап додано.": "Milestone added.",
  "Етапи та умовна оплата": "Milestones and conditional payment",
  "Суми й статуси тут є обліковими та не виконують реальний платіж.":
    "Amounts and statuses here are for record-keeping and don't make real payments.",
  "Назва етапу": "Milestone title",
  "Сума, грн": "Amount, UAH",
  "Додати етап": "Add milestone",
  "Умовна оплата": "Conditional payment",
  Сума: "Amount",
  Почати: "Start",
  "Передати на перевірку": "Submit for review",
  Прийняти: "Accept",
  Повернути: "Return",
  "Оплата {0}": "Payment {0}",
  "Не зарезервовано": "Not reserved",
  "Умовно зарезервовано": "Conditionally reserved",
  "Позначити оплаченим": "Mark as paid",
  "Позначено оплаченим": "Marked as paid",
  "Етапів ще немає": "No milestones yet",
  Заплановано: "Planned",

  // AI-план
  "Назва завдання": "Task title",
  "Опис роботи": "Work description",
  "Критерії приймання — по одному на рядок":
    "Acceptance criteria — one per line",
  "Прибрати завдання": "Remove task",
  Етап: "Milestone",
  "Опис етапу": "Milestone description",
  "Критерії приймання етапу — по одному на рядок":
    "Milestone acceptance criteria — one per line",
  "Додати завдання": "Add task",
  "Прибрати етап": "Remove milestone",
  "AI-план проєкту": "AI project plan",
  "Планування доступне власнику проєкту та адміністратору.":
    "Planning is available to the project owner and administrators.",
  "Проєкт закрито. Додавати план уже не можна.":
    "The project is closed. A plan can no longer be added.",
  "Від опису до конкретних кроків": "From description to concrete steps",
  "AI використає назву й опис цього проєкту та запропонує етапи, завдання і критерії приймання. Перевірте та відредагуйте чернетку перед додаванням.":
    "AI will use this project's title and description to propose milestones, tasks and acceptance criteria. Review and edit the draft before adding it.",
  "Завдання створюються без виконавців і дедлайнів, етапи — з сумою 0 грн. Призначити виконавців і строки завдань можна у формах їх редагування після збереження.":
    "Tasks are created without assignees or deadlines, milestones with a 0 UAH amount. You can set assignees and deadlines in their edit forms after saving.",
  "Побажання до плану (необов’язково)": "Plan preferences (optional)",
  "Наприклад: спершу прототип, потім розробка й тестування. Зосередитися на MVP.":
    "For example: prototype first, then development and testing. Focus on the MVP.",
  "AI готує чернетку. Це може тривати до 30 секунд.":
    "AI is preparing a draft. This can take up to 30 seconds.",
  "Додаємо підтверджений план…": "Adding the confirmed plan…",
  "Чернетка для перевірки": "Draft for review",
  "Етапів:": "Milestones:",
  "Завдань:": "Tasks:",
  "Статус збереження невідомий. Повторіть підтвердження — повторний запит не створить дублікати. Редагування цієї чернетки заблоковано до отримання результату.":
    "The save status is unknown. Confirm again — a repeated request won't create duplicates. Editing this draft is locked until there's a result.",
  "Після підтвердження буде створено всі етапи та завдання цієї чернетки.":
    "After confirmation, all milestones and tasks in this draft will be created.",
  "План додано до проєкту": "Plan added to the project",
  "Етапи та завдання збережено разом із критеріями приймання в описах.":
    "Milestones and tasks were saved with acceptance criteria in their descriptions.",
  "Відкрити Kanban": "Open Kanban",
  "Переглянути етапи": "View milestones",
  "Складаємо план…": "Drafting a plan…",
  "Згенерувати інший план": "Generate another plan",
  "Запропонувати план": "Suggest a plan",
  "Повторити підтвердження": "Confirm again",
  "Підтвердити й додати до проєкту": "Confirm and add to project",

  // Завдання
  "Редагувати завдання": "Edit task",
  "Почати виконання": "Start work",
  "Повернути до плану": "Back to planned",
  "Виконання й передавання результатів доступні після активації проєкту клієнтом.":
    "Work and result submission are available once the client activates the project.",
  "Передати результат роботи": "Submit work result",
  "Результати та перевірки": "Results and reviews",
  "Результатів на цій сторінці ще немає.": "No results on this page yet.",
  "Перевірте права та поточний стан проєкту й завдання.":
    "Check your permissions and the current state of the project and task.",
  "Дедлайн завдання не може бути пізнішим за дедлайн проєкту.":
    "The task deadline can't be later than the project deadline.",
  "Опис завдання": "Task description",
  "Виконавця спочатку потрібно додати до учасників проєкту. Під час виконання змінити виконавця не можна.":
    "The assignee must first be added to the project members. The assignee can't be changed during work.",
  "Дедлайн завдання": "Task deadline",
  "Час місцевий. Дедлайн не може бути пізнішим за дедлайн проєкту.":
    "Local time. The deadline can't be later than the project deadline.",
  "Зберегти завдання": "Save task",
  "Відгук перевірки": "Review feedback",
  "Опишіть результат роботи.": "Describe the work result.",
  "За потреби спочатку завантажте файли (до 10). Після передавання завдання перейде на перевірку.":
    "Upload files first if needed (up to 10). After submission the task goes to review.",
  "Не додавати до результату": "Don't add to the result",
  "Опис результату": "Result description",
  "Передаємо…": "Submitting…",
  "Додайте відгук до рішення.": "Add feedback to the decision.",
  Рішення: "Decision",
  "Прийняти роботу": "Accept work",
  "Повернути на доопрацювання": "Return for rework",
  Відгук: "Feedback",
  "Зберегти рішення": "Save decision",

  // Завантаженість
  "Завантаженість виконавців": "Freelancer workload",
  "Незавершені завдання, пріоритети та строки у доступних вам проєктах.":
    "Unfinished tasks, priorities and deadlines in projects available to you.",
  Виконавці: "Freelancers",
  "Незавершені завдання": "Unfinished tasks",
  "Високий пріоритет": "High priority",
  "Показники враховують лише доступні вам дані. Вони не розкривають роботу фрилансера у чужих приватних проєктах.":
    "Figures only count data available to you. They don't reveal a freelancer's work in other private projects.",
  "Виконавців поки немає": "No freelancers yet",
  "Додайте команду до проєкту, щоб переглядати розподіл роботи.":
    "Add a team to a project to see how work is distributed.",
  "Переглянути проєкти": "View projects",
  "Незавершені:": "Unfinished:",
  "· Прострочені:": "· Overdue:",
  "· Високий пріоритет:": "· High priority:",
  "Перший дедлайн:": "First deadline:",
  "Завдання {0}": "Tasks {0}",
  Увага: "Attention",
  "Незавершених завдань немає.": "No unfinished tasks.",
  "Без ризику": "No risk",
  "Дедлайн наближається": "Deadline approaching",

  // Статуси, ролі, пріоритети (types.ts)
  "Очікує рішення": "Pending",
  Прийнято: "Accepted",
  Відхилено: "Rejected",
  Вирішено: "Resolved",
  "Очікує початку": "Not started",
  "У роботі": "In progress",
  Скасовано: "Cancelled",
  Призупинено: "Paused",
  Завершено: "Completed",
  "Пошук виконавця": "Looking for a freelancer",
  "До виконання": "To do",
  "На перевірці": "In review",
  Клієнт: "Client",
  Фрилансер: "Freelancer",
  Адміністратор: "Administrator",
  Низький: "Low",
  Середній: "Medium",
  Високий: "High",
  "Очікує перевірки": "Awaiting review",
  "Повернуто на доопрацювання": "Returned for rework",
};
