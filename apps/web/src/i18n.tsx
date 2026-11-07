import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { translate } from "./i18n.en";
import type { Language } from "./i18n.en";
import { IconMenu } from "./components/IconMenu";

const uk = {
  language: "EN",
  login: "Вхід",
  register: "Реєстрація",
  workspace: "ВАШ РОБОЧИЙ ПРОСТІР",
  introTitle: "Менше хаосу. Більше зробленого.",
  introText:
    "Проєкти, команда та результати роботи в одному зрозумілому просторі.",
  plan: "Плануйте",
  work: "Виконуйте",
  approve: "Приймайте",
  footer: "Управління фріланс-проєктами",
  welcome: "З ПОВЕРНЕННЯМ",
  loginTitle: "Увійдіть до Tasko.ai",
  loginDescription: "Продовжуйте роботу зі своєю командою.",
  email: "Електронна пошта",
  password: "Пароль",
  twoFactorCode: "Код двофакторного входу",
  loggingIn: "Входимо…",
  signIn: "Увійти",
  noAccount: "Ще не маєте облікового запису?",
  createAccount: "Зареєструватися",
  registered: "Обліковий запис створено. Увійдіть, щоб розпочати роботу.",
  registerKicker: "РОЗПОЧНІМО РОБОТУ",
  registerTitle: "Створіть обліковий запис",
  registerDescription: "Кілька полів — і ви в робочому просторі.",
  client: "Клієнт",
  freelancer: "Фрілансер",
  admin: "Адміністратор",
  name: "Ім’я",
  namePlaceholder: "Як до вас звертатися?",
  repeatPassword: "Повторіть пароль",
  passwordHint: "Від 8 до 128 символів.",
  creating: "Створюємо…",
  createAccountButton: "Створити обліковий запис",
  hasAccount: "Уже маєте обліковий запис?",
  workspaceCaption: "РОБОЧИЙ ПРОСТІР",
  main: "Головна",
  projects: "Проєкти",
  myProjects: "Мої проєкти",
  workProjects: "Робочі проєкти",
  findWork: "Знайти роботу",
  tasks: "Завдання",
  workload: "Завантаженість",
  messages: "Повідомлення",
  administration: "Адміністрування",
  profile: "Профіль",
  logout: "Вийти з облікового запису",
  accountMenu: "Меню облікового запису",
  myProfile: "Мій профіль",
  myWorkspace: "Мій робочий простір",
  openNavigation: "Відкрити навігацію",
  closeNavigation: "Закрити навігацію",
  closeMenu: "Закрити меню",
  navigation: "Головна навігація",
  skipContent: "Перейти до вмісту",
  nameTooShort: "Ім’я має містити щонайменше 2 символи.",
  passwordsMismatch: "Паролі не збігаються.",
  enterPassword: "Введіть пароль",
  enterPasswordAgain: "Введіть пароль ще раз",
  showPassword: "Показати пароль",
  hidePassword: "Приховати пароль",
} as const;

const en: Record<keyof typeof uk, string> = {
  language: "UA",
  login: "Sign in",
  register: "Register",
  workspace: "YOUR WORKSPACE",
  introTitle: "Less chaos. More done.",
  introText: "Projects, team and work results in one clear workspace.",
  plan: "Plan",
  work: "Work",
  approve: "Approve",
  footer: "Freelance project management",
  welcome: "WELCOME BACK",
  loginTitle: "Sign in to Tasko.ai",
  loginDescription: "Continue working with your team.",
  email: "Email",
  password: "Password",
  twoFactorCode: "Two-factor authentication code",
  loggingIn: "Signing in…",
  signIn: "Sign in",
  noAccount: "Do not have an account yet?",
  createAccount: "Register",
  registered: "Your account was created. Sign in to start working.",
  registerKicker: "LET'S GET STARTED",
  registerTitle: "Create an account",
  registerDescription: "A few fields and you are in your workspace.",
  client: "Client",
  freelancer: "Freelancer",
  admin: "Administrator",
  name: "Name",
  namePlaceholder: "How should we address you?",
  repeatPassword: "Repeat password",
  passwordHint: "From 8 to 128 characters.",
  creating: "Creating…",
  createAccountButton: "Create account",
  hasAccount: "Already have an account?",
  workspaceCaption: "WORKSPACE",
  main: "Dashboard",
  projects: "Projects",
  myProjects: "My projects",
  workProjects: "Work projects",
  findWork: "Find work",
  tasks: "Tasks",
  workload: "Workload",
  messages: "Messages",
  administration: "Administration",
  profile: "Profile",
  logout: "Sign out",
  accountMenu: "Account menu",
  myProfile: "My profile",
  myWorkspace: "My workspace",
  openNavigation: "Open navigation",
  closeNavigation: "Close navigation",
  closeMenu: "Close menu",
  navigation: "Main navigation",
  skipContent: "Skip to content",
  nameTooShort: "The name must contain at least 2 characters.",
  passwordsMismatch: "Passwords do not match.",
  enterPassword: "Enter password",
  enterPasswordAgain: "Enter password again",
  showPassword: "Show password",
  hidePassword: "Hide password",
};

type TranslationKey = keyof typeof uk;

interface LanguageContextValue {
  language: Language;
  t: (key: TranslationKey) => string;
  // Переклад за українським текстом (як у gettext): tr("Сторінка {0}", page)
  tr: (text: string, ...args: (string | number)[]) => string;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return localStorage.getItem("tasko.language") === "en" ? "en" : "uk";
    } catch {
      return "uk";
    }
  });

  // Мову в <html lang> ставимо ще під час рендеру: з неї читають trNow() і
  // formatDate() у дочірніх компонентах, які малюються одразу після цього
  document.documentElement.lang = language;
  useEffect(() => {
    try {
      localStorage.setItem("tasko.language", language);
    } catch {
      // Мова працює і без збереження, якщо сховище браузера недоступне.
    }
  }, [language]);

  const dictionary = language === "uk" ? uk : en;
  return (
    <LanguageContext.Provider
      value={{
        language,
        t: (key) => dictionary[key],
        tr: (text, ...args) => translate(language, text, args),
        toggleLanguage: () =>
          setLanguage((current) => (current === "uk" ? "en" : "uk")),
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("LanguageProvider is missing.");
  return context;
}

// Глобус зі списком мов; назви мов — кожна своєю мовою
export function LanguageButton() {
  const { language, toggleLanguage } = useLanguage();
  return (
    <IconMenu
      icon="bi-globe2"
      label="Мова / Language"
      value={language}
      options={[
        { value: "uk", label: "Українська" },
        { value: "en", label: "English" },
      ]}
      onChange={(value) => {
        if (value !== language) toggleLanguage();
      }}
    />
  );
}
