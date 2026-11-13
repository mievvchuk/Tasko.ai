// Наповнює сайт через його HTTP API: клієнти з проєктами й етапами, фрілансери з профілями,
// портфоліо та заявками на відкриті проєкти. Фото профілів генеруються тут же (PNG-силует).
// Запуск: API_URL=https://tasko-ai-api-w83l.onrender.com node scripts/seed-people.mjs
// Повторний запуск безпечний: наявні акаунти лише входять, проєкти й заявки не дублюються.
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const api = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const accountsFile = new URL(
  '../../../.tmp/seed-people-accounts.json',
  import.meta.url,
);

let password;
try {
  password = JSON.parse(await readFile(accountsFile, 'utf8')).password;
} catch {
  password = process.env.SEED_PASSWORD || randomBytes(12).toString('base64url');
}

const day = (date) => new Date(`${date}T23:59:59`).toISOString();

const clients = [
  {
    name: 'Наталія Гончаренко',
    email: 'natalia.honcharenko@tasko.ai',
    color: [214, 120, 96],
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
    email: 'viktor.lytvynenko@tasko.ai',
    color: [86, 132, 190],
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
    email: 'oksana.diachuk@tasko.ai',
    color: [150, 110, 180],
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
    email: 'artem.kravets@tasko.ai',
    color: [90, 160, 120],
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
];

const freelancers = [
  {
    name: 'Максим Ткаченко',
    email: 'maksym.tkachenko@tasko.ai',
    color: [70, 110, 160],
    bio: 'Fullstack-розробник, 5 років досвіду. Пишу на TypeScript: React на фронтенді, NestJS і PostgreSQL на бекенді. Люблю чистий код і зрозумілі дедлайни.',
    hourlyRate: 650,
    availability: 'AVAILABLE',
    skills: ['react', 'typescript', 'nestjs', 'postgresql'],
    portfolio: [
      [
        'Система бронювання для коворкінгу',
        'React + NestJS, онлайн-оплата і календар місць.',
      ],
      ['Панель аналітики для логістики', 'Графіки доставок і звіти в PDF.'],
    ],
  },
  {
    name: 'Софія Романенко',
    email: 'sofia.romanenko@tasko.ai',
    color: [200, 100, 140],
    bio: 'UI/UX-дизайнерка. Роблю інтерфейси вебсайтів і застосунків, фірмові стилі та дизайн-системи у Figma. Працюю від досліджень до готових макетів.',
    hourlyRate: 500,
    availability: 'AVAILABLE',
    skills: ['figma'],
    portfolio: [
      [
        'Редизайн застосунку для доставки їжі',
        'Нові сценарії замовлення, конверсія +18%.',
      ],
      ['Брендинг кав’ярні «Мелена»', 'Логотип, упаковка, меню.'],
    ],
  },
  {
    name: 'Денис Олійник',
    email: 'denys.oliinyk@tasko.ai',
    color: [120, 130, 90],
    bio: 'Backend-розробник і автор Telegram-ботів. Інтеграції з платіжками, CRM та Google Sheets. Більше 40 запущених ботів для малого бізнесу.',
    hourlyRate: 550,
    availability: 'BUSY',
    skills: ['telegram-bot', 'nestjs', 'postgresql', 'typescript'],
    portfolio: [
      ['Бот запису до салону краси', 'Запис, нагадування, оплата передплати.'],
      ['Бот для замовлень піцерії', 'Меню, кошик, інтеграція з POS.'],
    ],
  },
  {
    name: 'Юлія Мороз',
    email: 'yulia.moroz@tasko.ai',
    color: [210, 150, 70],
    bio: 'SEO-спеціалістка та контент-маркетологиня. Аудити, семантика, контент-плани, аналітика. Вивожу сайти малого бізнесу в топ за локальними запитами.',
    hourlyRate: 400,
    availability: 'AVAILABLE',
    skills: ['seo'],
    portfolio: [
      ['Просування мережі автомийок', 'Трафік з пошуку ×3 за пів року.'],
      ['Блог для онлайн-школи', '25 статей, 12 у топ-10 Google.'],
    ],
  },
  {
    name: 'Ігор Бойко',
    email: 'ihor.boiko@tasko.ai',
    color: [100, 90, 150],
    bio: 'Frontend-розробник. React, TypeScript, адаптивна верстка, анімації. Перетворюю макети Figma на швидкі та доступні інтерфейси.',
    hourlyRate: 450,
    availability: 'AVAILABLE',
    skills: ['react', 'typescript', 'figma'],
    portfolio: [
      ['Лендинг для фестивалю', 'Анімації, квитки, 98 балів Lighthouse.'],
      ['Особистий кабінет страхової', 'Форми, валідація, доступність.'],
    ],
  },
  {
    name: 'Анастасія Левченко',
    email: 'anastasia.levchenko@tasko.ai',
    color: [80, 150, 160],
    bio: 'Початківиця у веброзробці: завершила курс Fullstack, маю кілька власних проєктів. Відповідальна, швидко вчуся, ціна нижча за ринкову.',
    hourlyRate: 250,
    availability: 'AVAILABLE',
    skills: ['react', 'typescript', 'seo'],
    portfolio: [
      ['Сайт-візитка для фотографа', 'Галерея, форма зв’язку, адаптив.'],
    ],
  },
];

// --- HTTP ---
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

// --- Фото профілю: PNG 256×256 з силуетом людини ---
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length);
  head.write(type, 4, 'latin1');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])));
  return Buffer.concat([head, data, tail]);
};
function avatarPng([r, g, b], size = 256) {
  const light = [r, g, b].map((v) => Math.round(v + (255 - v) * 0.75));
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const head = (x - 128) ** 2 + (y - 100) ** 2 < 46 ** 2;
      const body = (x - 128) ** 2 / 88 ** 2 + (y - 250) ** 2 / 90 ** 2 < 1;
      const shade = 1 - y / size / 4;
      const color =
        head || body ? light : [r, g, b].map((v) => Math.round(v * shade));
      row.set(color, 1 + x * 3);
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function setAvatar(token, color) {
  const me = await call('auth/me', { token });
  if (me.data?.avatarUrl) return;
  const form = new FormData();
  form.append(
    'file',
    new Blob([avatarPng(color)], { type: 'image/png' }),
    'avatar.png',
  );
  const result = await call('profile/avatar', { token, method: 'POST', form });
  if (result.status >= 300)
    console.log(`  фото не додано: ${JSON.stringify(result.data)}`);
}

// --- Наповнення ---
async function main() {
  console.log(`API: ${api}`);
  let categories, skillIds;
  for (const client of clients) {
    console.log(`Клієнт: ${client.name}`);
    const token = await signIn(client, 'CLIENT');
    // Довідники доступні лише після входу
    categories ??= (await call('project-categories', { token })).data || [];
    skillIds ??= Object.fromEntries(
      ((await call('skills', { token })).data || []).map((s) => [s.name, s.id]),
    );
    await setAvatar(token, client.color);
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
          categoryId: categories.find((item) => item.name === category)?.id,
          skillIds: skills.map((name) => skillIds[name]).filter(Boolean),
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

  for (const [index, freelancer] of freelancers.entries()) {
    console.log(`Фрілансер: ${freelancer.name}`);
    const token = await signIn(freelancer, 'FREELANCER');
    await setAvatar(token, freelancer.color);
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
      for (const [n, [title, description]] of freelancer.portfolio.entries())
        await call('profile/portfolio', {
          token,
          method: 'POST',
          body: {
            title,
            description,
            url: `https://example.com/portfolio/${freelancer.email.split('@')[0]}/${n + 1}`,
          },
        });
      portfolio = (await call('profile/portfolio', { token })).data || [];
    }

    // Подає заявки на відкриті проєкти, де збігається хоч одна навичка
    const open = list(
      (await call('marketplace/projects?limit=50', { token })).data,
    );
    const matching = open.filter((project) =>
      project.skills?.some((skill) => freelancer.skills.includes(skill.name)),
    );
    for (const project of matching.slice(0, 4)) {
      const min = project.budgetMin ?? 5000;
      const max = project.budgetMax ?? min * 2;
      const share = [0.35, 0.6, 0.85, 0.5, 0.25, 0.1][index];
      const proposedBudget = Math.max(
        1,
        Math.round((min + (max - min) * share) / 500) * 500,
      );
      const proposedDays = [21, 30, 14, 45, 28, 35][index];
      const result = await call(`projects/${project.id}/applications`, {
        token,
        method: 'POST',
        body: {
          message: `Доброго дня! Маю досвід у подібних задачах (${freelancer.skills.join(', ')}). Готовий(-а) обговорити деталі та почати найближчим часом. Орієнтовно ${proposedDays} днів.`,
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
  console.log(`Готово. Пошти й спільний пароль: ${accountsFile.pathname}`);
}

await main();
