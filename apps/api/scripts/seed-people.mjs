// Наповнює сайт через його HTTP API: клієнти з проєктами й етапами, фрілансери з фото,
// профілями, портфоліо з обкладинками та заявками на відкриті проєкти.
// Запуск на продакшн — GitHub Actions «Seed site content» (.github/workflows/seed-site.yml).
// Локально: SEED_PASSWORD=... API_URL=http://localhost:3000 node scripts/seed-people.mjs
// Повторний запуск безпечний: наявні акаунти лише входять, проєкти й заявки не дублюються.
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const api = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const accountsFile = new URL(
  '../../../.tmp/seed-people-accounts.json',
  import.meta.url,
);

// Спільний пароль акаунтів: із секрету SEED_PASSWORD, інакше з минулого локального запуску
let password = process.env.SEED_PASSWORD;
if (!password) {
  if (process.env.CI) throw new Error('Задайте секрет SEED_PASSWORD.');
  try {
    password = JSON.parse(await readFile(accountsFile, 'utf8')).password;
  } catch {
    password = randomBytes(12).toString('base64url');
  }
}
const adminEmail = process.env.SEED_ADMIN_EMAIL;
const adminPassword = process.env.SEED_ADMIN_PASSWORD;

const day = (date) => new Date(`${date}T23:59:59`).toISOString();

const clients = [
  {
    name: 'Наталія Гончаренко',
    email: 'n.honcharenko@posmishka-clinic.com.ua',
    photo: 'natalia-honcharenko',
    projects: [
      {
        title: 'Сайт для стоматологічної клініки «Посмішка»',
        description:
          'Багатосторінковий сайт клініки: послуги з цінами, лікарі, онлайн-запис на прийом, відгуки пацієнтів і блог. Важлива швидкість на мобільних і базове SEO.',
        deadline: day('2027-02-20'),
        budgetMin: 20000,
        budgetMax: 35000,
        category: 'Веброзробка',
        skills: ['react', 'typescript', 'seo'],
        milestones: [
          [
            'Структура та дизайн',
            'Карта сайту, макети головної, послуг і сторінки лікаря.',
            '2026-12-10',
            7000,
          ],
          [
            'Верстка та онлайн-запис',
            'Адаптивна верстка, форма запису з вибором лікаря й часу.',
            '2027-01-25',
            15000,
          ],
          [
            'Блог, SEO та запуск',
            'Блог, мета-теги, карта сайту, підключення домену.',
            '2027-02-15',
            6000,
          ],
        ],
      },
    ],
  },
  {
    name: 'Віктор Литвиненко',
    email: 'viktor@kvity-lytvynenko.com.ua',
    photo: 'viktor-lytvynenko',
    projects: [
      {
        title: 'CRM для служби доставки квітів',
        description:
          'Внутрішня система для флористів і кур’єрів: замовлення, статуси доставки, база клієнтів, звіт за день. Бекенд NestJS + PostgreSQL, інтерфейс на React.',
        deadline: day('2027-04-01'),
        budgetMin: 45000,
        budgetMax: 80000,
        category: 'Веброзробка',
        skills: ['nestjs', 'postgresql', 'react', 'typescript'],
        milestones: [
          [
            'Модель даних і API замовлень',
            'Таблиці замовлень, клієнтів, кур’єрів; CRUD-ендпоінти.',
            '2026-12-20',
            15000,
          ],
          [
            'Інтерфейс флориста',
            'Список замовлень, фільтри, зміна статусів.',
            '2027-02-10',
            20000,
          ],
          [
            'Кабінет кур’єра та звіти',
            'Маршрут на день, підтвердження доставки, щоденний звіт.',
            '2027-03-25',
            18000,
          ],
        ],
      },
      {
        title: 'Telegram-бот для замовлення букетів',
        description:
          'Бот із каталогом букетів, кошиком, вибором часу доставки та сповіщенням менеджера про нове замовлення.',
        deadline: day('2027-01-30'),
        budgetMin: 9000,
        budgetMax: 15000,
        category: 'Веброзробка',
        skills: ['telegram-bot', 'nestjs'],
        milestones: [
          [
            'Каталог і кошик',
            'Категорії букетів, фото, додавання в кошик.',
            '2026-12-15',
            6000,
          ],
          [
            'Оформлення та сповіщення',
            'Адреса, час доставки, повідомлення менеджеру.',
            '2027-01-25',
            6000,
          ],
        ],
      },
    ],
  },
  {
    name: 'Оксана Дячук',
    email: 'oksana@khlibna-khata.com.ua',
    photo: 'oksana-diachuk',
    projects: [
      {
        title: 'Фірмовий стиль для пекарні «Хлібна хата»',
        description:
          'Логотип, кольорова палітра, шрифти, дизайн упаковки та вивіски. Потрібен короткий брендбук у PDF і вихідники у Figma.',
        deadline: day('2027-01-15'),
        budgetMin: 8000,
        budgetMax: 14000,
        category: 'Дизайн',
        skills: ['figma'],
        milestones: [
          [
            'Логотип',
            'Три концепції, доопрацювання обраної.',
            '2026-11-30',
            5000,
          ],
          [
            'Упаковка та вивіска',
            'Пакети, коробки для тортів, макет вивіски.',
            '2027-01-10',
            6000,
          ],
        ],
      },
    ],
  },
  {
    name: 'Артем Кравець',
    email: 'a.kravets@velomarket.com.ua',
    photo: 'artem-kravets',
    projects: [
      {
        title: 'SEO для інтернет-магазину велосипедів',
        description:
          'Технічний аудит, оптимізація категорій і карток товарів, семантика під регіони України, щомісячний звіт за трафіком.',
        deadline: day('2027-03-15'),
        budgetMin: 12000,
        budgetMax: 20000,
        category: 'Маркетинг',
        skills: ['seo'],
        milestones: [
          [
            'Аудит і семантика',
            'Помилки індексації, швидкість, ключові запити.',
            '2026-12-05',
            5000,
          ],
          [
            'Оптимізація каталогу',
            'Мета-теги й тексти для 30 категорій.',
            '2027-02-01',
            9000,
          ],
          [
            'Звіт і рекомендації',
            'Результати за 2 місяці та план далі.',
            '2027-03-10',
            3000,
          ],
        ],
      },
    ],
  },
  {
    name: 'Ірина Савчук',
    email: 'iryna@balance-pilates.com.ua',
    photo: 'iryna-savchuk',
    projects: [
      {
        title: 'Мобільний застосунок для студії пілатесу «Баланс»',
        description:
          'Застосунок для клієнтів студії: розклад занять, запис і скасування, абонементи з онлайн-оплатою, push-нагадування за годину до тренування. Потрібні iOS і Android, бекенд можна на NestJS.',
        deadline: day('2027-05-15'),
        budgetMin: 60000,
        budgetMax: 95000,
        category: 'Веброзробка',
        skills: ['react', 'typescript', 'nestjs'],
        milestones: [
          [
            'Дизайн і прототип',
            'Сценарії запису, макети основних екранів, клікабельний прототип.',
            '2027-01-20',
            15000,
          ],
          [
            'Розклад, запис і абонементи',
            'Інтеграція з розкладом студії, оплата абонементів.',
            '2027-03-31',
            45000,
          ],
          [
            'Нагадування й публікація',
            'Push-сповіщення, тестування, публікація в App Store та Google Play.',
            '2027-05-10',
            20000,
          ],
        ],
      },
    ],
  },
  {
    name: 'Олег Мартинюк',
    email: 'o.martyniuk@trans-logist.com.ua',
    photo: 'oleh-martyniuk',
    projects: [
      {
        title: 'Панель моніторингу автопарку',
        description:
          'Вебпанель для диспетчерів: 40 вантажівок на карті, пробіг і витрата пального, графік техобслуговування, звіти для бухгалтерії в Excel. Дані надходять із GPS-трекерів через API постачальника.',
        deadline: day('2027-04-20'),
        budgetMin: 50000,
        budgetMax: 85000,
        category: 'Веброзробка',
        skills: ['react', 'nestjs', 'postgresql', 'typescript'],
        milestones: [
          [
            'Інтеграція з GPS-трекерами',
            'Отримання координат і пробігу, збереження історії.',
            '2027-01-15',
            25000,
          ],
          [
            'Карта й дашборд',
            'Машини на карті, фільтри, графіки витрат.',
            '2027-03-01',
            30000,
          ],
          [
            'Техобслуговування та звіти',
            'Нагадування про ТО, експорт звітів у Excel.',
            '2027-04-15',
            15000,
          ],
        ],
      },
    ],
  },
  {
    name: 'Тетяна Кравчук',
    email: 't.kravchuk@speakup-school.com.ua',
    photo: 'tetiana-kravchuk',
    projects: [
      {
        title: 'Платформа онлайн-курсів для школи англійської SpeakUp',
        description:
          'Особистий кабінет студента з відеоуроками, домашніми завданнями й прогресом; кабінет викладача для перевірки робіт; оплата курсів карткою. Зараз усе в Google Classroom — хочемо своє.',
        deadline: day('2027-06-01'),
        budgetMin: 70000,
        budgetMax: 120000,
        category: 'Веброзробка',
        skills: ['react', 'typescript', 'nestjs', 'postgresql'],
        milestones: [
          [
            'Кабінет студента',
            'Курси, уроки з відео, домашні завдання.',
            '2027-02-15',
            40000,
          ],
          [
            'Кабінет викладача',
            'Перевірка завдань, оцінки, коментарі.',
            '2027-04-01',
            30000,
          ],
          [
            'Оплати й запуск',
            'Оплата курсів, промокоди, перенесення студентів.',
            '2027-05-25',
            25000,
          ],
        ],
      },
      {
        title: 'Контент-план і SEO для блогу школи',
        description:
          'Семантичне ядро для запитів про вивчення англійської, контент-план на 3 місяці і 12 статей, оптимізованих під пошук.',
        deadline: day('2027-03-01'),
        budgetMin: 10000,
        budgetMax: 18000,
        category: 'Маркетинг',
        skills: ['seo'],
        milestones: [
          [
            'Семантика й контент-план',
            'Ключові запити, теми статей, графік публікацій.',
            '2026-12-20',
            5000,
          ],
          [
            'Статті',
            '12 статей з оптимізацією та внутрішньою перелінковкою.',
            '2027-02-25',
            10000,
          ],
        ],
      },
    ],
  },
  {
    name: 'Сергій Білоус',
    email: 'serhii@patelnia-restaurant.com.ua',
    photo: 'serhii-bilous',
    projects: [
      {
        title: 'Telegram-бот доставки для ресторану «Пательня»',
        description:
          'Бот з меню, кошиком, оплатою онлайн і відстеженням статусу замовлення. Замовлення мають падати в нашу POS-систему, кур’єр отримує адресу в окремому чаті.',
        deadline: day('2027-02-10'),
        budgetMin: 15000,
        budgetMax: 25000,
        category: 'Веброзробка',
        skills: ['telegram-bot', 'nestjs', 'postgresql'],
        milestones: [
          [
            'Меню й кошик',
            'Категорії страв, фото, модифікатори, кошик.',
            '2026-12-25',
            9000,
          ],
          [
            'Оплата, POS і кур’єри',
            'Онлайн-оплата, передача в POS, чат кур’єрів.',
            '2027-02-05',
            12000,
          ],
        ],
      },
      {
        title: 'Оновлення фірмового стилю та меню ресторану',
        description:
          'Освіжити логотип, підібрати палітру й шрифти, зверстати друковане меню на 16 сторінок і шаблони для Instagram.',
        deadline: day('2027-01-31'),
        budgetMin: 12000,
        budgetMax: 20000,
        category: 'Дизайн',
        skills: ['figma'],
        milestones: [
          [
            'Логотип і палітра',
            'Дві концепції оновленого логотипа, кольори, шрифти.',
            '2026-12-15',
            7000,
          ],
          [
            'Меню та соцмережі',
            'Макет меню до друку, 10 шаблонів постів і сторіз.',
            '2027-01-25',
            9000,
          ],
        ],
      },
    ],
  },
];

// Обкладинки портфоліо лежать у seed-assets/covers/<cover>.jpg
const freelancers = [
  {
    name: 'Максим Ткаченко',
    email: 'maksym@tkachenko.dev',
    photo: 'maksym-tkachenko',
    bio: 'Fullstack-розробник, 5 років досвіду. Пишу на TypeScript: React на фронтенді, NestJS і PostgreSQL на бекенді. Люблю чистий код і зрозумілі дедлайни.',
    hourlyRate: 650,
    availability: 'AVAILABLE',
    skills: ['react', 'typescript', 'nestjs', 'postgresql'],
    portfolio: [
      [
        'Система бронювання для коворкінгу',
        'React + NestJS, онлайн-оплата і календар місць. 300+ бронювань на тиждень.',
        'web-6',
        'React, NestJS, Stripe',
      ],
      [
        'Панель аналітики для логістичної компанії',
        'Графіки доставок, KPI водіїв і звіти в PDF.',
        'dash-2',
        'React, PostgreSQL, Charts',
      ],
      [
        'API для мобільного застосунку фітнес-клубу',
        'Розклад, абонементи, push-сповіщення.',
        'code-3',
        'NestJS, PostgreSQL',
      ],
    ],
  },
  {
    name: 'Софія Романенко',
    email: 'sofia@romanenko.design',
    photo: 'sofia-romanenko',
    bio: 'UI/UX-дизайнерка. Роблю інтерфейси вебсайтів і застосунків, фірмові стилі та дизайн-системи у Figma. Працюю від досліджень до готових макетів.',
    hourlyRate: 500,
    availability: 'AVAILABLE',
    skills: ['figma'],
    portfolio: [
      [
        'Редизайн застосунку для доставки їжі',
        'Нові сценарії замовлення, конверсія +18%.',
        'mobile-1',
        'UX, Figma, прототип',
      ],
      [
        'Брендинг кав’ярні «Мелена»',
        'Логотип, упаковка, меню.',
        'brand-2',
        'Брендинг, айдентика',
      ],
      [
        'Дизайн-система для банківського кабінету',
        '120 компонентів, світла й темна теми.',
        'web-5',
        'Design system, Figma',
      ],
    ],
  },
  {
    name: 'Денис Олійник',
    email: 'denys@oliinyk-bots.dev',
    photo: 'denys-oliinyk',
    bio: 'Backend-розробник і автор Telegram-ботів. Інтеграції з платіжками, CRM та Google Sheets. Більше 40 запущених ботів для малого бізнесу.',
    hourlyRate: 550,
    availability: 'BUSY',
    skills: ['telegram-bot', 'nestjs', 'postgresql', 'typescript'],
    portfolio: [
      [
        'Бот запису до салону краси',
        'Запис, нагадування, оплата передплати.',
        'mobile-2',
        'Telegram, NestJS',
      ],
      [
        'Бот для замовлень піцерії',
        'Меню, кошик, інтеграція з POS.',
        'code-1',
        'Telegram, PostgreSQL, POS',
      ],
    ],
  },
  {
    name: 'Юлія Мороз',
    email: 'yulia@moroz-seo.com.ua',
    photo: 'yulia-moroz',
    bio: 'SEO-спеціалістка та контент-маркетологиня. Аудити, семантика, контент-плани, аналітика. Вивожу сайти малого бізнесу в топ за локальними запитами.',
    hourlyRate: 400,
    availability: 'AVAILABLE',
    skills: ['seo'],
    portfolio: [
      [
        'Просування мережі автомийок',
        'Трафік з пошуку ×3 за пів року.',
        'dash-3',
        'SEO, локальний пошук',
      ],
      [
        'Блог для онлайн-школи',
        '25 статей, 12 у топ-10 Google.',
        'mkt-3',
        'Контент, SEO',
      ],
    ],
  },
  {
    name: 'Ігор Бойко',
    email: 'ihor@boiko.dev',
    photo: 'ihor-boiko',
    bio: 'Frontend-розробник. React, TypeScript, адаптивна верстка, анімації. Перетворюю макети Figma на швидкі та доступні інтерфейси.',
    hourlyRate: 450,
    availability: 'AVAILABLE',
    skills: ['react', 'typescript', 'figma'],
    portfolio: [
      [
        'Лендинг для музичного фестивалю',
        'Анімації, продаж квитків, 98 балів Lighthouse.',
        'web-1',
        'React, анімації',
      ],
      [
        'Особистий кабінет страхової компанії',
        'Форми, валідація, доступність WCAG AA.',
        'web-3',
        'React, TypeScript, a11y',
      ],
    ],
  },
  {
    name: 'Анастасія Левченко',
    email: 'anastasia.levchenko@devhub.in.ua',
    photo: 'anastasia-levchenko',
    bio: 'Junior веброзробниця: завершила курс Fullstack, маю кілька власних проєктів. Відповідальна, швидко вчуся, ціна нижча за ринкову.',
    hourlyRate: 250,
    availability: 'AVAILABLE',
    skills: ['react', 'typescript', 'seo'],
    portfolio: [
      [
        'Сайт-візитка для фотографа',
        'Галерея, форма зв’язку, адаптив.',
        'web-2',
        'React, адаптив',
      ],
    ],
  },
  {
    name: 'Богдан Шевчук',
    email: 'bohdan@shevchuk.app',
    photo: 'bohdan-shevchuk',
    bio: 'Мобільний розробник: React Native і TypeScript. 12 застосунків у App Store і Google Play — від доставки їжі до фітнес-трекерів. Беру проєкт від прототипу до публікації.',
    hourlyRate: 700,
    availability: 'AVAILABLE',
    skills: ['react', 'typescript'],
    portfolio: [
      [
        'Застосунок для мережі кав’ярень',
        'Замовлення наперед, бонусна програма, 25 тис. завантажень.',
        'mobile-3',
        'React Native, push',
      ],
      [
        'Фітнес-трекер із планом тренувань',
        'Інтеграція з Apple Health і Google Fit.',
        'mobile-4',
        'React Native, HealthKit',
      ],
    ],
  },
  {
    name: 'Катерина Лисенко',
    email: 'kateryna@lysenko.studio',
    photo: 'kateryna-lysenko',
    bio: 'Графічна дизайнерка, спеціалізуюся на брендингу для кафе, пекарень і локальних брендів. Логотипи, упаковка, меню, вивіски. 8 років досвіду.',
    hourlyRate: 450,
    availability: 'AVAILABLE',
    skills: ['figma'],
    portfolio: [
      [
        'Айдентика для крафтової пекарні',
        'Логотип, паперові пакети, коробки для тортів.',
        'brand-1',
        'Брендинг, упаковка',
      ],
      [
        'Меню й вивіска для бістро',
        'Друковане меню, лайтбокс, наліпки на вітрину.',
        'brand-3',
        'Поліграфія',
      ],
      [
        'Фірмовий стиль квіткового магазину',
        'Палітра, шрифти, шаблони для Instagram.',
        'brand-4',
        'Айдентика, SMM-шаблони',
      ],
    ],
  },
  {
    name: 'Роман Коваль',
    email: 'roman@koval-ops.dev',
    photo: 'roman-koval',
    bio: 'Backend і DevOps. NestJS, PostgreSQL, Docker, CI/CD. Налаштовую інфраструктуру, щоб релізи були нудними, а сервер не падав у п’ятницю ввечері.',
    hourlyRate: 750,
    availability: 'BUSY',
    skills: ['nestjs', 'postgresql', 'typescript'],
    portfolio: [
      [
        'Міграція інтернет-магазину в хмару',
        'Docker, автоматичні бекапи, час відповіді −60%.',
        'code-2',
        'Docker, CI/CD, PostgreSQL',
      ],
      [
        'API платіжного шлюзу для маркетплейсу',
        'Розщеплення платежів між продавцями, 99,9% аптайму.',
        'code-5',
        'NestJS, черги',
      ],
    ],
  },
  {
    name: 'Дарина Захарченко',
    email: 'daryna@zakharchenko-smm.com.ua',
    photo: 'daryna-zakharchenko',
    bio: 'Маркетологиня: SMM, таргетована реклама і SEO для малого бізнесу. Будую стратегію, контент-план і звітую цифрами, а не відчуттями.',
    hourlyRate: 420,
    availability: 'AVAILABLE',
    skills: ['seo'],
    portfolio: [
      [
        'Запуск Instagram для студії йоги',
        '0 → 6 тис. підписників за 5 місяців, 40 записів на місяць.',
        'mkt-1',
        'SMM, таргет',
      ],
      [
        'Рекламна кампанія для онлайн-магазину одягу',
        'ROAS 4,2 у Meta Ads.',
        'mkt-2',
        'Meta Ads, аналітика',
      ],
    ],
  },
  {
    name: 'Андрій Петрук',
    email: 'andrii@petruk.dev',
    photo: 'andrii-petruk',
    bio: 'Fullstack-розробник із досвідом у фінтеху та e-commerce. Проєктую архітектуру, пишу код і веду невелику команду. Працюю з клієнтами з України та ЄС.',
    hourlyRate: 900,
    availability: 'AVAILABLE',
    skills: ['react', 'nestjs', 'postgresql', 'typescript'],
    portfolio: [
      [
        'Інтернет-магазин електроніки',
        'Каталог на 15 тис. товарів, фільтри, інтеграція з 1С.',
        'shop-1',
        'React, NestJS, 1С',
      ],
      [
        'CRM для агенції нерухомості',
        'Об’єкти, угоди, календар показів.',
        'dash-1',
        'React, PostgreSQL',
      ],
      [
        'Кабінет інвестора для фінтех-стартапу',
        'Портфель, графіки дохідності, KYC.',
        'dash-4',
        'TypeScript, графіки',
      ],
    ],
  },
  {
    name: 'Марія Гнатюк',
    email: 'mariia@hnatiuk.design',
    photo: 'mariia-hnatiuk',
    bio: 'UX-дослідниця і продуктова дизайнерка. Проводжу інтерв’ю з користувачами, юзабіліті-тести й перетворюю висновки на зрозумілі інтерфейси.',
    hourlyRate: 550,
    availability: 'UNAVAILABLE',
    skills: ['figma'],
    portfolio: [
      [
        'Дослідження й редизайн кабінету клієнта банку',
        '15 інтерв’ю, кількість звернень у підтримку −30%.',
        'web-4',
        'UX research, Figma',
      ],
      [
        'Онбординг для застосунку медитацій',
        'A/B-тест трьох варіантів, утримання +12%.',
        'mobile-1',
        'UX, A/B-тести',
      ],
    ],
  },
  {
    name: 'Владислав Руденко',
    email: 'vlad@rudenko-bots.dev',
    photo: 'vladyslav-rudenko',
    bio: 'Розробляю Telegram-ботів і автоматизації для бізнесу: замовлення, запис, розсилки, інтеграції з CRM і Google Sheets. Швидко, з документацією та підтримкою.',
    hourlyRate: 400,
    availability: 'AVAILABLE',
    skills: ['telegram-bot', 'postgresql'],
    portfolio: [
      [
        'Бот-магазин для виробника меду',
        'Каталог, оплата, відправка Новою поштою.',
        'shop-3',
        'Telegram, Нова пошта API',
      ],
      [
        'Бот підтримки для інтернет-провайдера',
        'Статус заявок, перевірка балансу, 70% звернень без оператора.',
        'code-4',
        'Telegram, CRM',
      ],
    ],
  },
  {
    name: 'Олена Яковенко',
    email: 'olena@yakovenko-copy.com.ua',
    photo: 'olena-yakovenko',
    bio: 'Копірайтерка й SEO-авторка. Пишу тексти для сайтів, блогів і розсилок українською та англійською. Тексти, які читають до кінця і які знаходить Google.',
    hourlyRate: 350,
    availability: 'AVAILABLE',
    skills: ['seo'],
    portfolio: [
      [
        'Тексти для сайту стоматологічної клініки',
        '20 сторінок послуг, +45% записів з сайту.',
        'mkt-4',
        'Копірайтинг, SEO',
      ],
      [
        'Email-розсилки для онлайн-магазину косметики',
        'Серія листів, відкриття 38%.',
        'shop-2',
        'Email-маркетинг',
      ],
    ],
  },
];

async function call(path, { token, method = 'GET', body, form } = {}) {
  for (;;) {
    const response = await fetch(`${api}/${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: form || (body ? JSON.stringify(body) : undefined),
    });
    if (response.status === 429) {
      const wait = Number(response.headers.get('retry-after') || 60);
      console.log(`  ліміт запитів, чекаю ${wait} с…`);
      await new Promise((resolve) => setTimeout(resolve, wait * 1000 + 1000));
      continue;
    }
    const data = await response.json().catch(() => null);
    return { status: response.status, data };
  }
}
const list = (data) => data?.items || data?.data || data || [];

async function signIn(person, role) {
  const created = await call('auth/register', {
    method: 'POST',
    body: { name: person.name, email: person.email, password, role },
  });
  if (created.status >= 300 && created.status !== 409)
    throw new Error(`${person.email}: ${JSON.stringify(created.data)}`);
  const login = await call('auth/login', {
    method: 'POST',
    body: { email: person.email, password },
  });
  if (!login.data?.accessToken)
    throw new Error(
      `${person.email}: не вдалося увійти (${login.status}). Пароль інший?`,
    );
  return login.data.accessToken;
}

// Фото з Unsplash (див. seed-assets/README.md) вантажимо як звичайний користувач
async function upload(path, token, file) {
  const form = new FormData();
  const bytes = await readFile(new URL(`seed-assets/${file}`, import.meta.url));
  form.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'photo.jpg');
  const result = await call(path, { token, method: 'POST', form });
  if (result.status >= 300)
    console.log(`  фото не додано: ${JSON.stringify(result.data)}`);
}

async function setAvatar(token, photo) {
  const me = await call('auth/me', { token });
  if (!me.data?.avatarUrl)
    await upload('profile/avatar', token, `avatars/${photo}.jpg`);
}

// Нові проєкти чекають модерації; з даними адміна схвалюємо свої, щоб вони з'явились на біржі
async function approveSeededProjects() {
  if (!adminEmail || !adminPassword) {
    console.log('SEED_ADMIN_EMAIL не задано — проєкти лишаються на модерації.');
    return;
  }
  const login = await call('auth/login', {
    method: 'POST',
    body: { email: adminEmail, password: adminPassword },
  });
  const token = login.data?.accessToken;
  if (!token) throw new Error(`Адмін не увійшов (${login.status}).`);
  const titles = new Set(
    clients.flatMap((client) => client.projects.map((p) => p.title)),
  );
  const queue = list((await call('admin/moderation/projects', { token })).data);
  for (const project of queue.filter((item) => titles.has(item.title))) {
    const result = await call(`admin/moderation/projects/${project.id}`, {
      token,
      method: 'POST',
      body: { decision: 'APPROVE' },
    });
    console.log(
      result.status < 300
        ? `  схвалено: ${project.title}`
        : `  не схвалено «${project.title}»: ${result.data?.message}`,
    );
  }
}

// --- Наповнення ---
async function main() {
  console.log(`API: ${api}`);
  for (const client of clients) {
    console.log(`Клієнт: ${client.name}`);
    const token = await signIn(client, 'CLIENT');
    await setAvatar(token, client.photo);
    const mine = list(
      (await call('projects?mine=true&limit=50', { token })).data,
    );
    for (const project of client.projects) {
      if (mine.some((item) => item.title === project.title)) continue;
      const { milestones, category, skills, ...fields } = project;
      const created = await call('projects', {
        token,
        method: 'POST',
        body: {
          ...fields,
          // Назви: API знайде наявні категорію й навички або створить нові
          categoryName: category,
          skillNames: skills,
        },
      });
      if (created.status >= 300) {
        console.log(
          `  проєкт «${project.title}» не створено: ${JSON.stringify(created.data)}`,
        );
        continue;
      }
      for (const [
        index,
        [title, description, deadline, amount],
      ] of milestones.entries())
        await call(`projects/${created.data.id}/milestones`, {
          token,
          method: 'POST',
          body: {
            title,
            description,
            deadline: day(deadline),
            amount,
            position: index + 1,
          },
        });
      console.log(`  + ${project.title}`);
    }
  }

  console.log('Модерація');
  await approveSeededProjects();

  for (const [index, freelancer] of freelancers.entries()) {
    console.log(`Фрілансер: ${freelancer.name}`);
    const token = await signIn(freelancer, 'FREELANCER');
    await setAvatar(token, freelancer.photo);
    await call('profile/freelancer', {
      token,
      method: 'PATCH',
      body: {
        bio: freelancer.bio,
        hourlyRate: freelancer.hourlyRate,
        availability: freelancer.availability,
        skills: freelancer.skills,
      },
    });
    let portfolio = (await call('profile/portfolio', { token })).data || [];
    if (!portfolio.length) {
      for (const [title, description, cover, tags] of freelancer.portfolio) {
        const item = await call('profile/portfolio', {
          token,
          method: 'POST',
          body: { title, description, tags },
        });
        if (item.status < 300)
          await upload(
            `profile/portfolio/${item.data.id}/image`,
            token,
            `covers/${cover}.jpg`,
          );
      }
      portfolio = (await call('profile/portfolio', { token })).data || [];
    }

    // Подає заявки на відкриті проєкти, де збігається хоч одна навичка
    const open = list(
      (await call('marketplace/projects?limit=50', { token })).data,
    );
    const matching = open.filter((project) =>
      project.skills?.some((skill) => freelancer.skills.includes(skill.name)),
    );
    for (const project of matching.slice(0, 3)) {
      const min = project.budgetMin ?? 5000;
      const max = project.budgetMax ?? min * 2;
      const share = [0.35, 0.6, 0.85, 0.5, 0.25, 0.1, 0.7][index % 7];
      const proposedBudget = Math.max(
        1,
        Math.round((min + (max - min) * share) / 500) * 500,
      );
      const proposedDays = [21, 30, 14, 45, 28, 35, 40][index % 7];
      const result = await call(`projects/${project.id}/applications`, {
        token,
        method: 'POST',
        body: {
          message: `Доброго дня! ${freelancer.bio.split('.')[0]}. Задача «${project.title}» мені близька — схожі роботи є в портфоліо. Орієнтовний строк ${proposedDays} днів, можу почати найближчим часом. Давайте обговоримо деталі.`,
          proposedBudget,
          proposedDays,
          portfolioItemId: portfolio[0]?.id,
        },
      });
      if (result.status < 300) console.log(`  заявка → ${project.title}`);
      else if (result.status !== 409)
        console.log(
          `  заявка на «${project.title}» не пройшла: ${result.data?.message}`,
        );
    }
  }

  // Локально зберігаємо пошти й пароль, щоб повторний запуск входив у ті самі акаунти
  if (!process.env.CI) {
    await mkdir(new URL('.', accountsFile), { recursive: true });
    await writeFile(
      accountsFile,
      JSON.stringify(
        {
          api,
          password,
          accounts: [...clients, ...freelancers].map(({ name, email }) => ({
            name,
            email,
          })),
        },
        null,
        2,
      ),
    );
  }
  console.log(
    `Готово: ${clients.length} клієнтів, ${freelancers.length} фрілансерів.`,
  );
}

await main();
