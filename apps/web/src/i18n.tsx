import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { translate } from "./i18n.en";
import type { Language } from "./i18n.en";

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
  footer: "Управління фриланс-проєктами",
  welcome: "З ПОВЕРНЕННЯМ",
  loginTitle: "Увійдіть до Tasko.ai",
  loginDescription: "Продовжуйте роботу зі своєю командою.",
  email: "Електронна пошта",
  password: "Пароль",
  twoFactorCode: "Код двофакторного входу",
  loggingIn: "Входимо…",
  signIn: "Увійти",
  forgotPassword: "Забули пароль?",
  noAccount: "Ще не маєте облікового запису?",
  createAccount: "Зареєструватися",
  registered: "Обліковий запис створено. Увійдіть, щоб розпочати роботу.",
  registerKicker: "РОЗПОЧНІМО РОБОТУ",
  registerTitle: "Створіть обліковий запис",
  registerDescription: "Оберіть свою роль і приєднуйтеся.",
  roleQuestion: "Як ви плануєте працювати?",
  client: "Клієнт",
  clientHint: "Організовую проєкти",
  freelancer: "Фрилансер",
  freelancerHint: "Виконую завдання",
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
  recoveryKicker: "ВІДНОВЛЕННЯ ДОСТУПУ",
  recoveryTitle: "Забули пароль?",
  recoveryDescription:
    "Вкажіть пошту, і ми надішлемо посилання на новий пароль.",
  sending: "Надсилаємо…",
  sendLink: "Надіслати посилання",
  backToLogin: "Повернутися до входу",
  newPasswordKicker: "НОВИЙ ПАРОЛЬ",
  newPasswordTitle: "Встановіть новий пароль",
  newPassword: "Новий пароль",
  repeatNewPassword: "Повторіть новий пароль",
  saving: "Зберігаємо…",
  changePassword: "Змінити пароль",
  goToLogin: "Перейти до входу",
  missingResetToken: "У посиланні немає токена відновлення.",
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
  forgotPassword: "Forgot your password?",
  noAccount: "Do not have an account yet?",
  createAccount: "Register",
  registered: "Your account was created. Sign in to start working.",
  registerKicker: "LET'S GET STARTED",
  registerTitle: "Create an account",
  registerDescription: "Choose your role and join Tasko.ai.",
  roleQuestion: "How do you plan to work?",
  client: "Client",
  clientHint: "I organize projects",
  freelancer: "Freelancer",
  freelancerHint: "I complete tasks",
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
  recoveryKicker: "ACCOUNT RECOVERY",
  recoveryTitle: "Forgot your password?",
  recoveryDescription:
    "Enter your email and we will send a password reset link.",
  sending: "Sending…",
  sendLink: "Send reset link",
  backToLogin: "Back to sign in",
  newPasswordKicker: "NEW PASSWORD",
  newPasswordTitle: "Set a new password",
  newPassword: "New password",
  repeatNewPassword: "Repeat new password",
  saving: "Saving…",
  changePassword: "Change password",
  goToLogin: "Go to sign in",
  missingResetToken: "The reset token is missing from the link.",
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

export function LanguageButton() {
  const { t, toggleLanguage } = useLanguage();
  return (
    <button
      type="button"
      className="language-button"
      onClick={toggleLanguage}
      aria-label="Змінити мову / Change language"
    >
      {t("language")}
    </button>
  );
}
