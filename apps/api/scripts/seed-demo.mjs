import { randomBytes } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../dist/config/config.js';
import { createDb } from '../dist/prisma/db.js';
import { hashPassword } from '../dist/auth/password.js';

const config = loadConfig();
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(
    new URL(config.databaseUrl).hostname,
  )
) {
  throw new Error('Демонстраційні дані можна додавати лише до локальної БД.');
}

// Постійні UUID дозволяють повторювати запуск без дублювання записів.
const id = (number) =>
  `d3e00000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const users = [
  {
    id: id(1),
    name: 'Олена Коваль (демо)',
    // Прості пошти для трьох головних акаунтів — їх зручно вводити на захисті
    email: 'client@tasko.demo',
    role: 'CLIENT',
  },
  {
    id: id(2),
    name: 'Микола Шевченко (демо)',
    email: 'client2@demo.tasko.example',
    role: 'CLIENT',
  },
  {
    id: id(3),
    name: 'Андрій Мельник (демо)',
    email: 'freelancer@tasko.demo',
    role: 'FREELANCER',
  },
  {
    id: id(4),
    name: 'Ірина Бондар (демо)',
    email: 'freelancer2@demo.tasko.example',
    role: 'FREELANCER',
  },
  {
    id: id(5),
    name: 'Дмитро Савчук (демо)',
    email: 'freelancer3@demo.tasko.example',
    role: 'FREELANCER',
  },
  {
    id: id(6),
    name: 'Адміністратор (демо)',
    email: 'admin@tasko.demo',
    role: 'ADMIN',
  },
];
const [client1, client2, freelancer1, freelancer2, freelancer3, admin] = users;
// Каталог, у якому API зберігає завантажені файли (див. files.service.ts).
const storageDirectory = new URL('../storage/', import.meta.url);
const credentialsDirectory = new URL('../../../.tmp/', import.meta.url);
const credentialsFile = new URL('demo-accounts.json', credentialsDirectory);
const db = createDb(config.databaseUrl);

try {
  await db.orm.public.User.select('id').limit(1).all();
  let credentials;
  try {
    credentials = JSON.parse(await readFile(credentialsFile, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    for (const user of users) {
      if (await db.orm.public.User.where({ id: user.id }).first()) {
        throw new Error(
          'Демооблікові записи вже існують, але файл доступу відсутній. Паролі не змінено.',
        );
      }
    }
    credentials = {
      version: 1,
      createdAt: new Date().toISOString(),
      password:
        process.env.DEMO_PASSWORD || randomBytes(18).toString('base64url'),
      accounts: users,
    };
    if (credentials.password.length < 8 || credentials.password.length > 128) {
      throw new Error('DEMO_PASSWORD має містити від 8 до 128 символів.');
    }
    await mkdir(credentialsDirectory, { recursive: true });
    await writeFile(credentialsFile, JSON.stringify(credentials, null, 2), {
      flag: 'wx',
      mode: 0o600,
    });
  }
  if (
    credentials.version !== 1 ||
    typeof credentials.password !== 'string' ||
    !Number.isFinite(Date.parse(credentials.createdAt))
  ) {
    throw new Error('Некоректний файл демонстраційних облікових записів.');
  }
  // Файл доступу показує актуальні пошти акаунтів (пароль не змінюється).
  if (JSON.stringify(credentials.accounts) !== JSON.stringify(users)) {
    credentials.accounts = users;
    await writeFile(credentialsFile, JSON.stringify(credentials, null, 2), {
      mode: 0o600,
    });
  }
  const baseTime = Date.parse(credentials.createdAt);
  const date = (days) => new Date(baseTime + days * 86400000);
  const passwordHash = await hashPassword(credentials.password);
  const created = {};

  await db.transaction(async (tx) => {
    const models = tx.orm.public;
    async function add(model, data) {
      if (await models[model].where({ id: data.id }).first()) return;
      await models[model].create(data);
      created[model] = (created[model] || 0) + 1;
    }
    async function addBy(model, where, data) {
      if (await models[model].where(where).first()) return;
      await models[model].create(data);
      created[model] = (created[model] || 0) + 1;
    }

    for (const user of users) {
      const existing = await models.User.where({ email: user.email }).first();
      if (
        existing &&
        (existing.id !== user.id || existing.role !== user.role)
      ) {
        throw new Error(
          `Пошта ${user.email} вже використовується. Наявний обліковий запис не змінено.`,
        );
      }
      // Якщо демо-акаунт уже є, але зі старою поштою, — оновлюємо лише пошту.
      // Дані акаунта (проєкти, завдання, повідомлення) залишаються за ним.
      const sameAccount = await models.User.where({ id: user.id }).first();
      if (sameAccount && sameAccount.email !== user.email) {
        await models.User.where({ id: user.id }).update({
          email: user.email,
          updatedAt: new Date(),
        });
        created.UserEmail = (created.UserEmail || 0) + 1;
      }
      await add('User', {
        ...user,
        status: 'ACTIVE',
        passwordHash,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        createdAt: date(-35),
        updatedAt: date(0),
      });
    }

    const projects = [
      {
        id: id(101),
        clientId: client1.id,
        title: '[Демо] Лендінг для кав’ярні',
        description:
          'Потрібен адаптивний сайт із меню, фотографіями та формою бронювання. Проєкт відкритий для заявок.',
        status: 'PLANNING',
        deadline: date(21),
        createdAt: date(-2),
        updatedAt: date(0),
      },
      {
        id: id(102),
        clientId: client1.id,
        title: '[Демо] Інтернет-магазин крафтових виробів',
        description:
          'Каталог товарів, кошик і оформлення замовлень. Два виконавці працюють над розробкою й дизайном.',
        status: 'ACTIVE',
        deadline: date(20),
        createdAt: date(-10),
        updatedAt: date(0),
      },
      {
        id: id(103),
        clientId: client2.id,
        title: '[Демо] Макет мобільного застосунку',
        description:
          'Дизайн застосунку для запису на послуги. Є прострочене завдання для перевірки аналітики ризиків.',
        status: 'ACTIVE',
        deadline: date(14),
        createdAt: date(-7),
        updatedAt: date(0),
      },
      {
        id: id(104),
        clientId: client1.id,
        title: '[Демо] Фірмовий стиль пекарні',
        description:
          'Завершений проєкт: логотип, палітра та оформлення пакування. Клієнт залишив відгук.',
        status: 'COMPLETED',
        deadline: date(3),
        createdAt: date(-25),
        updatedAt: date(-3),
      },
      {
        id: id(105),
        clientId: client2.id,
        title: '[Демо] Каталог послуг майстерні',
        description:
          'Завершений вебкаталог із пошуком послуг і контактною формою.',
        status: 'COMPLETED',
        deadline: date(5),
        createdAt: date(-18),
        updatedAt: date(-2),
      },
    ];
    for (const project of projects) await add('Project', project);
    const [open, shop, design, brand, catalog] = projects;
    const memberships = [
      { project: shop, user: freelancer1 },
      { project: shop, user: freelancer2 },
      { project: design, user: freelancer3 },
      { project: brand, user: freelancer2 },
      { project: catalog, user: freelancer1 },
    ];
    for (const [index, member] of memberships.entries()) {
      await add('ProjectMember', {
        id: id(201 + index),
        projectId: member.project.id,
        userId: member.user.id,
        role: 'MEMBER',
        joinedAt: new Date(member.project.createdAt.getTime() + 3600000),
      });
    }

    const applications = [
      {
        project: open,
        user: freelancer1,
        status: 'PENDING',
        budget: 9000,
        days: 10,
        message:
          'Розроблю адаптивний лендінг і підключу форму бронювання за десять днів.',
      },
      {
        project: open,
        user: freelancer3,
        status: 'PENDING',
        budget: 7500,
        days: 14,
        message:
          'Підготую дизайн, верстку та зручне мобільне меню для кав’ярні.',
      },
      {
        project: shop,
        user: freelancer1,
        status: 'ACCEPTED',
        budget: 24000,
        days: 20,
        message: 'Реалізую каталог, кошик і оформлення замовлення.',
      },
      {
        project: design,
        user: freelancer3,
        status: 'ACCEPTED',
        budget: 12000,
        days: 14,
        message: 'Підготую інтерактивний прототип і основні екрани застосунку.',
      },
      {
        project: brand,
        user: freelancer2,
        status: 'ACCEPTED',
        budget: 8000,
        days: 18,
        message: 'Створю логотип і фірмовий стиль для пакування.',
      },
      {
        project: catalog,
        user: freelancer1,
        status: 'ACCEPTED',
        budget: 15000,
        days: 12,
        message: 'Розроблю каталог послуг із пошуком і контактною формою.',
      },
    ];
    for (const [index, application] of applications.entries()) {
      await add('ProjectApplication', {
        id: id(401 + index),
        projectId: application.project.id,
        freelancerId: application.user.id,
        message: application.message,
        proposedBudget: application.budget,
        proposedDays: application.days,
        status: application.status,
        createdAt: application.project.createdAt,
        updatedAt: application.project.updatedAt,
      });
    }

    const tasks = [
      {
        project: shop,
        user: freelancer1,
        title: 'Погодити структуру каталогу',
        status: 'DONE',
        priority: 'MEDIUM',
        days: 2,
      },
      {
        project: shop,
        user: freelancer1,
        title: 'Реалізувати кошик',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        days: 5,
      },
      {
        project: shop,
        user: freelancer2,
        title: 'Підготувати адаптивний дизайн',
        status: 'REVIEW',
        priority: 'HIGH',
        days: 4,
      },
      {
        project: shop,
        user: freelancer2,
        title: 'Оформити сторінку контактів',
        status: 'TODO',
        priority: 'LOW',
        days: 8,
      },
      {
        project: design,
        user: freelancer3,
        title: 'Зібрати вимоги до екранів',
        status: 'DONE',
        priority: 'MEDIUM',
        days: -1,
      },
      {
        project: design,
        user: freelancer3,
        title: 'Підготувати перший прототип',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        days: -1,
      },
      {
        project: design,
        user: freelancer3,
        title: 'Перевірити навігацію макета',
        status: 'TODO',
        priority: 'MEDIUM',
        days: 5,
      },
      {
        project: brand,
        user: freelancer2,
        title: 'Розробити логотип',
        status: 'DONE',
        priority: 'HIGH',
        days: 1,
      },
      {
        project: brand,
        user: freelancer2,
        title: 'Підготувати правила оформлення',
        status: 'DONE',
        priority: 'MEDIUM',
        days: 2,
      },
      {
        project: catalog,
        user: freelancer1,
        title: 'Створити каталог послуг',
        status: 'DONE',
        priority: 'HIGH',
        days: 2,
      },
      {
        project: catalog,
        user: freelancer1,
        title: 'Додати пошук',
        status: 'DONE',
        priority: 'MEDIUM',
        days: 3,
      },
      {
        project: catalog,
        user: freelancer1,
        title: 'Перевірити контактну форму',
        status: 'DONE',
        priority: 'MEDIUM',
        days: 4,
      },
    ];
    for (const [index, task] of tasks.entries()) {
      let updatedAt = task.project.updatedAt;
      if (task.status === 'DONE' && task.project.status !== 'COMPLETED')
        updatedAt = date(-2);
      const taskId = id(301 + index);
      await add('Task', {
        id: taskId,
        projectId: task.project.id,
        assigneeId: task.user.id,
        title: task.title,
        description: `Демонстраційне завдання: ${task.title.toLowerCase()}. Результат передати клієнту на перевірку.`,
        priority: task.priority,
        status: task.status,
        deadline: date(task.days),
        createdAt: new Date(task.project.createdAt.getTime() + 7200000),
        updatedAt,
      });
      if (task.status === 'DONE' || task.status === 'REVIEW') {
        const approved = task.status === 'DONE';
        await add('WorkSubmission', {
          id: id(601 + index),
          taskId,
          submittedBy: task.user.id,
          description: `Виконано: ${task.title}. Прошу перевірити результат.`,
          status: approved ? 'APPROVED' : 'SUBMITTED',
          submittedAt: new Date(updatedAt.getTime() - 3600000),
          reviewedAt: approved ? updatedAt : null,
          reviewerId: approved ? task.project.clientId : null,
          feedback: approved
            ? 'Результат перевірено й прийнято. Дякую за роботу!'
            : null,
        });
      }
    }

    for (const [index, project] of [shop, design, brand, catalog].entries()) {
      await add('Order', {
        id: id(501 + index),
        projectId: project.id,
        clientId: project.clientId,
        status: project.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
        createdAt: new Date(project.createdAt.getTime() + 3600000),
        updatedAt: project.updatedAt,
      });
    }
    const messages = [
      {
        project: shop,
        sender: client1,
        content:
          'Вітаю! Основний пріоритет — каталог і кошик. Дизайн погоджуємо окремо.',
      },
      {
        project: shop,
        sender: freelancer1,
        content: 'Структуру каталогу завершено. Працюю над кошиком.',
      },
      {
        project: shop,
        sender: freelancer2,
        content: 'Адаптивний дизайн готовий і переданий на перевірку.',
      },
      {
        project: design,
        sender: client2,
        content: 'Будь ласка, уточніть строк готовності першого прототипу.',
      },
      {
        project: design,
        sender: freelancer3,
        content:
          'Підготую оновлений прототип. Завдання з високим пріоритетом уже в роботі.',
      },
      {
        project: brand,
        sender: client1,
        content: 'Фірмовий стиль погоджено, результат роботи прийнято. Дякую!',
      },
    ];
    for (const [index, message] of messages.entries()) {
      await add('Message', {
        id: id(801 + index),
        projectId: message.project.id,
        senderId: message.sender.id,
        content: message.content,
        createdAt: new Date(
          message.project.updatedAt.getTime() - (6 - index) * 60000,
        ),
      });
    }
    await add('FreelancerReview', {
      id: id(701),
      projectId: brand.id,
      clientId: client1.id,
      freelancerId: freelancer2.id,
      rating: 5,
      comment:
        'Якісний дизайн і уважне ставлення до правок. Результат прийнято з першого разу.',
      createdAt: brand.updatedAt,
    });
    await add('FreelancerReview', {
      id: id(702),
      projectId: catalog.id,
      clientId: client2.id,
      freelancerId: freelancer1.id,
      rating: 4,
      comment:
        'Каталог працює, пошук і контактна форма перевірені. Виконавець регулярно повідомляв про прогрес.',
      createdAt: catalog.updatedAt,
    });

    const categories = [
      { id: id(901), name: 'Веброзробка' },
      { id: id(902), name: 'Дизайн' },
      { id: id(903), name: 'Маркетинг' },
    ];
    const skills = [
      { id: id(911), name: 'typescript' },
      { id: id(912), name: 'react' },
      { id: id(913), name: 'nestjs' },
      { id: id(914), name: 'figma' },
    ];
    for (const category of categories) await add('ProjectCategory', category);
    for (const skill of skills) await add('Skill', skill);
    for (const [index, freelancer] of [
      freelancer1,
      freelancer2,
      freelancer3,
    ].entries()) {
      await addBy(
        'FreelancerProfile',
        { userId: freelancer.id },
        {
          userId: freelancer.id,
          bio: [
            'Розробляю вебзастосунки на TypeScript.',
            'Створюю сучасні інтерфейси та дизайн-системи.',
            'Допомагаю з аналітикою і контентом.',
          ][index],
          hourlyRate: [650, 550, 450][index],
          availability: index === 2 ? 'BUSY' : 'AVAILABLE',
          updatedAt: date(0),
        },
      );
      await add('PortfolioItem', {
        id: id(921 + index),
        userId: freelancer.id,
        title: ['Інтернет-магазин', 'Мобільний дизайн', 'Аналітичний звіт'][
          index
        ],
        description: 'Демонстраційна робота для профілю.',
        url: `https://example.com/portfolio/${index + 1}`,
        createdAt: date(-20 + index),
        updatedAt: date(-5),
      });
    }
    for (const [userId, skillId] of [
      [freelancer1.id, skills[0].id],
      [freelancer1.id, skills[2].id],
      [freelancer2.id, skills[1].id],
      [freelancer2.id, skills[3].id],
    ])
      await addBy('FreelancerSkill', { userId, skillId }, { userId, skillId });
    await addBy(
      'FavoriteProject',
      { userId: freelancer3.id, projectId: design.id },
      { userId: freelancer3.id, projectId: design.id, createdAt: date(-2) },
    );
    await add('ProjectMilestone', {
      id: id(931),
      projectId: shop.id,
      title: 'Каталог товарів',
      description: 'Готовий каталог із фільтрами.',
      position: 1,
      deadline: date(7),
      amount: 12000,
      status: 'IN_PROGRESS',
      paymentStatus: 'RESERVED',
      createdAt: date(-4),
      updatedAt: date(-1),
    });
    await add('Notification', {
      id: id(941),
      userId: freelancer1.id,
      type: 'TASK_ASSIGNED',
      message: 'Вам призначено демонстраційне завдання.',
      projectId: shop.id,
      taskId: null,
      readAt: null,
      createdAt: date(-1),
    });
    await add('ActivityLog', {
      id: id(951),
      projectId: shop.id,
      actorId: client1.id,
      type: 'PROJECT_UPDATED',
      message: 'Оновлено демонстраційний проєкт.',
      createdAt: date(-1),
    });
    await add('Complaint', {
      id: id(961),
      reporterId: freelancer3.id,
      targetUserId: null,
      projectId: design.id,
      reason: 'Потрібне уточнення вимог',
      description:
        'Прошу адміністратора допомогти уточнити обсяг демонстраційного проєкту.',
      status: 'OPEN',
      adminNote: null,
      createdAt: date(-1),
      updatedAt: date(-1),
    });

    await addShowcaseData({ add, addBy, date, categories, skills });
  });
  console.log('Демонстраційні дані готові. Додано:', JSON.stringify(created));
  console.log('Дані для входу:', fileURLToPath(credentialsFile));
} finally {
  await db.close();
}

// Додаткові дані для показу: ще шість проєктів у різних статусах, завдання,
// етапи, повідомлення, файли, сповіщення, історія та скарга з рішенням.
// Як і вище, кожен запис має постійний ID, тож повторний запуск нічого не дублює.
async function addShowcaseData({ add, addBy, date, categories, skills }) {
  const [webCategory, designCategory, marketingCategory] = categories;
  const [typescript, react, nestjs, figma] = skills;
  const extraSkills = [
    { id: id(915), name: 'postgresql' },
    { id: id(916), name: 'telegram-bot' },
    { id: id(917), name: 'seo' },
  ];
  for (const skill of extraSkills) await add('Skill', skill);
  const [postgresql, telegramBot, seo] = extraSkills;

  const projects = [
    {
      id: id(1101),
      clientId: client2.id,
      title: '[Демо] CRM для студії йоги',
      description:
        'Облік клієнтів, розклад занять, абонементи й онлайн-оплата. Над проєктом працюють розробник і дизайнер.',
      status: 'ACTIVE',
      deadline: date(30),
      budgetMin: 30000,
      budgetMax: 45000,
      categoryId: webCategory.id,
      createdAt: date(-12),
      updatedAt: date(5),
      skills: [typescript, react, nestjs, postgresql],
      members: [freelancer1, freelancer3],
    },
    {
      id: id(1102),
      clientId: client1.id,
      title: '[Демо] Телеграм-бот для служби доставки',
      description:
        'Бот приймає замовлення, показує статус доставки й надсилає сповіщення клієнтам.',
      status: 'ACTIVE',
      deadline: date(16),
      budgetMin: 12000,
      budgetMax: 18000,
      categoryId: webCategory.id,
      createdAt: date(-6),
      updatedAt: date(5),
      skills: [nestjs, typescript, telegramBot],
      members: [freelancer3],
    },
    {
      id: id(1103),
      clientId: client1.id,
      title: '[Демо] Мобільний застосунок для фітнес-клубу',
      description:
        'Запис на тренування, абонементи та push-нагадування. Шукаємо виконавця з досвідом мобільного дизайну.',
      status: 'PLANNING',
      deadline: date(45),
      budgetMin: 25000,
      budgetMax: 40000,
      categoryId: designCategory.id,
      createdAt: date(4),
      updatedAt: date(5),
      skills: [figma, react],
      members: [],
    },
    {
      id: id(1104),
      clientId: client2.id,
      title: '[Демо] SEO-аудит сайту стоматології',
      description:
        'Потрібно перевірити технічний стан сайту, швидкість і структуру сторінок та скласти план покращень.',
      status: 'PLANNING',
      deadline: date(25),
      budgetMin: 5000,
      budgetMax: 8000,
      categoryId: marketingCategory.id,
      createdAt: date(5),
      updatedAt: date(5),
      skills: [seo],
      members: [],
    },
    {
      id: id(1105),
      clientId: client2.id,
      title: '[Демо] Редизайн корпоративного блогу',
      description:
        'Нова сітка статей і типографіка. Проєкт тимчасово призупинено до погодження контенту.',
      status: 'PAUSED',
      deadline: date(35),
      budgetMin: 10000,
      budgetMax: 14000,
      categoryId: designCategory.id,
      createdAt: date(-9),
      updatedAt: date(3),
      skills: [figma],
      members: [freelancer2],
    },
    {
      id: id(1106),
      clientId: client1.id,
      title: '[Демо] Лендінг онлайн-курсу з фотографії',
      description:
        'Завершений проєкт: лендінг із програмою курсу, відгуками та формою оплати.',
      status: 'COMPLETED',
      deadline: date(0),
      budgetMin: 9000,
      budgetMax: 12000,
      categoryId: designCategory.id,
      createdAt: date(-30),
      updatedAt: date(-1),
      skills: [figma, react],
      members: [freelancer2],
    },
  ];
  for (const project of projects) {
    const { skills: projectSkills, members, ...data } = project;
    await add('Project', data);
    for (const skill of projectSkills)
      await addBy(
        'ProjectSkill',
        { projectId: project.id, skillId: skill.id },
        { projectId: project.id, skillId: skill.id },
      );
    for (const [index, member] of members.entries()) {
      await addBy(
        'ProjectMember',
        { projectId: project.id, userId: member.id },
        {
          id: id(1201 + projects.indexOf(project) * 10 + index),
          projectId: project.id,
          userId: member.id,
          role: 'MEMBER',
          joinedAt: new Date(project.createdAt.getTime() + 86400000),
        },
      );
    }
  }
  const [crm, bot, fitness, seoAudit, blog, course] = projects;

  // Заявки: прийняті — для активних проєктів, очікують — для відкритих на біржі.
  const applications = [
    [
      crm,
      freelancer1,
      'ACCEPTED',
      38000,
      25,
      'Маю досвід CRM на NestJS і React, почну з бази клієнтів.',
    ],
    [
      crm,
      freelancer3,
      'ACCEPTED',
      9000,
      14,
      'Візьму на себе дизайн особистого кабінету та сповіщення.',
    ],
    [
      bot,
      freelancer3,
      'ACCEPTED',
      15000,
      14,
      'Зроблю бота з відстеженням замовлень і тестами.',
    ],
    [
      fitness,
      freelancer2,
      'PENDING',
      32000,
      30,
      'Спроєктую застосунок у Figma й підготую дизайн-систему.',
    ],
    [
      fitness,
      freelancer3,
      'PENDING',
      27000,
      35,
      'Пропоную прототип за два тижні, далі — повний дизайн.',
    ],
    [
      fitness,
      freelancer1,
      'PENDING',
      39000,
      40,
      'Можу виконати і дизайн, і розробку на React Native.',
    ],
    [
      seoAudit,
      freelancer3,
      'PENDING',
      6000,
      7,
      'Проведу технічний аудит і підготую план покращень.',
    ],
    [
      blog,
      freelancer2,
      'ACCEPTED',
      12000,
      20,
      'Оновлю сітку статей і типографіку блогу.',
    ],
    [
      course,
      freelancer2,
      'ACCEPTED',
      10500,
      14,
      'Зроблю лендінг із програмою курсу й формою оплати.',
    ],
  ];
  for (const [
    index,
    [project, user, status, budget, days, message],
  ] of applications.entries()) {
    await addBy(
      'ProjectApplication',
      { projectId: project.id, freelancerId: user.id },
      {
        id: id(1401 + index),
        projectId: project.id,
        freelancerId: user.id,
        message,
        proposedBudget: budget,
        proposedDays: days,
        status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    );
  }
  await addBy(
    'FavoriteProject',
    { userId: freelancer1.id, projectId: fitness.id },
    { userId: freelancer1.id, projectId: fitness.id, createdAt: date(5) },
  );

  // Завдання: [проєкт, виконавець, назва, статус, пріоритет, дедлайн у днях]
  const tasks = [
    [crm, freelancer1, 'Спроєктувати базу клієнтів', 'DONE', 'HIGH', -3],
    [
      crm,
      freelancer1,
      'Календар занять із фільтрами',
      'IN_PROGRESS',
      'HIGH',
      10,
    ],
    [crm, freelancer1, 'Онлайн-оплата абонементів', 'TODO', 'HIGH', 18],
    [crm, freelancer3, 'Дизайн особистого кабінету', 'REVIEW', 'MEDIUM', 8],
    [crm, freelancer3, 'Сповіщення про заняття', 'TODO', 'LOW', 22],
    [crm, null, 'Звіт відвідуваності за місяць', 'TODO', 'MEDIUM', 25],
    [bot, freelancer3, 'Описати сценарії діалогів', 'DONE', 'MEDIUM', 1],
    [bot, freelancer3, 'Підключити API замовлень', 'IN_PROGRESS', 'HIGH', 9],
    [bot, freelancer3, 'Відстеження кур’єра на карті', 'TODO', 'MEDIUM', 13],
    [
      bot,
      freelancer3,
      'Тестування на реальних замовленнях',
      'TODO',
      'HIGH',
      15,
    ],
    [blog, freelancer2, 'Аудит наявного блогу', 'DONE', 'MEDIUM', -4],
    [blog, freelancer2, 'Нова сітка статей', 'IN_PROGRESS', 'MEDIUM', 14],
    [course, freelancer2, 'Структура лендінгу', 'DONE', 'MEDIUM', -20],
    [course, freelancer2, 'Дизайн і верстка', 'DONE', 'HIGH', -10],
    [course, freelancer2, 'Підключити форму оплати', 'DONE', 'HIGH', -3],
  ];
  const submissionIds = {};
  for (const [
    index,
    [project, user, title, status, priority, days],
  ] of tasks.entries()) {
    const taskId = id(1301 + index);
    // Завершене завдання закрито не пізніше дедлайну, решта оновлювались нещодавно.
    const updatedAt = status === 'DONE' ? date(Math.min(days, 4)) : date(5);
    await add('Task', {
      id: taskId,
      projectId: project.id,
      assigneeId: user?.id ?? null,
      title,
      description: `${title}. Результат описати й передати клієнту на перевірку.`,
      priority,
      status,
      deadline: date(days),
      createdAt: new Date(project.createdAt.getTime() + 7200000),
      updatedAt,
    });
    if (user && (status === 'DONE' || status === 'REVIEW')) {
      const approved = status === 'DONE';
      submissionIds[title] = id(1601 + index);
      await add('WorkSubmission', {
        id: id(1601 + index),
        taskId,
        submittedBy: user.id,
        description: `Виконано: ${title}. Деталі та файли — у результаті роботи.`,
        status: approved ? 'APPROVED' : 'SUBMITTED',
        submittedAt: new Date(updatedAt.getTime() - 3600000),
        reviewedAt: approved ? updatedAt : null,
        reviewerId: approved ? project.clientId : null,
        feedback: approved ? 'Перевірено, усе працює. Приймаю роботу.' : null,
      });
    }
  }

  // Етапи з умовною оплатою для CRM
  const milestones = [
    [
      'MVP: клієнти й розклад',
      'База клієнтів і розклад занять.',
      15000,
      'COMPLETED',
      'PAID',
      -3,
    ],
    [
      'Оплата й особистий кабінет',
      'Абонементи, онлайн-оплата та кабінет клієнта.',
      18000,
      'IN_PROGRESS',
      'RESERVED',
      18,
    ],
    [
      'Звіти та сповіщення',
      'Звіт відвідуваності й нагадування про заняття.',
      9000,
      'PLANNED',
      'UNPAID',
      28,
    ],
  ];
  for (const [
    index,
    [title, description, amount, status, paymentStatus, days],
  ] of milestones.entries()) {
    await add('ProjectMilestone', {
      id: id(1931 + index),
      projectId: crm.id,
      title,
      description,
      position: index + 1,
      deadline: date(days),
      amount,
      status,
      paymentStatus,
      createdAt: crm.createdAt,
      updatedAt: date(4),
    });
  }

  for (const [index, [project, status]] of [
    [crm, 'IN_PROGRESS'],
    [bot, 'IN_PROGRESS'],
    [blog, 'PENDING'],
    [course, 'COMPLETED'],
  ].entries()) {
    await add('Order', {
      id: id(1501 + index),
      projectId: project.id,
      clientId: project.clientId,
      status,
      createdAt: new Date(project.createdAt.getTime() + 3600000),
      updatedAt: project.updatedAt,
    });
  }

  // Повідомлення: [проєкт, автор, текст, скільки годин тому від оновлення проєкту]
  const messages = [
    [
      crm,
      client2,
      'Доброго дня! Головне для нас — зручний розклад і оплата абонементів онлайн.',
      30,
    ],
    [
      crm,
      freelancer1,
      'Базу клієнтів готово, зараз працюю над календарем занять. Фільтри за тренером уже є.',
      20,
    ],
    [
      crm,
      freelancer3,
      'Дизайн особистого кабінету передав на перевірку. Буду радий коментарям.',
      6,
    ],
    [
      crm,
      client2,
      'Дякую! Подивлюся кабінет сьогодні ввечері й залишу відгук.',
      3,
    ],
    [bot, client1, 'Чи зможе бот показувати, де зараз кур’єр?', 26],
    [
      bot,
      freelancer3,
      'Так, це наступне завдання після підключення API замовлень.',
      24,
    ],
    [
      bot,
      client1,
      'Чудово, тоді тестуємо на реальних замовленнях наприкінці тижня.',
      2,
    ],
    [
      blog,
      client2,
      'Ставимо проєкт на паузу: чекаємо нові тексти від редакції.',
      48,
    ],
    [
      blog,
      freelancer2,
      'Зрозуміло. Аудит готовий, повернуся до сітки після вашого сигналу.',
      46,
    ],
    [
      course,
      client1,
      'Лендінг запустили, перші оплати вже пройшли. Дякую за роботу!',
      30,
    ],
  ];
  for (const [
    index,
    [project, sender, content, hoursAgo],
  ] of messages.entries()) {
    await add('Message', {
      id: id(1801 + index),
      projectId: project.id,
      senderId: sender.id,
      content,
      createdAt: new Date(project.updatedAt.getTime() - hoursAgo * 3600000),
    });
  }

  await add('FreelancerReview', {
    id: id(1701),
    projectId: course.id,
    clientId: client1.id,
    freelancerId: freelancer2.id,
    rating: 5,
    comment: 'Сучасний дизайн, усе здано вчасно. Рекомендую!',
    createdAt: course.updatedAt,
  });

  // Файли: текстові документи, які реально лежать у сховищі й скачуються
  const files = [
    [
      crm,
      client2,
      'Технічне-завдання-CRM.txt',
      'Технічне завдання: облік клієнтів, розклад, абонементи, онлайн-оплата, звіти.',
      null,
    ],
    [
      crm,
      freelancer1,
      'Схема-бази-даних.txt',
      'Таблиці: clients, trainers, classes, subscriptions, payments, visits.',
      null,
    ],
    [
      crm,
      freelancer3,
      'Макет-особистого-кабінету.txt',
      'Екрани: профіль, мої заняття, абонемент, історія оплат.',
      'Дизайн особистого кабінету',
    ],
    [
      bot,
      client1,
      'Сценарії-бота.txt',
      'Сценарії: нове замовлення, статус, скасування, звернення в підтримку.',
      null,
    ],
    [
      course,
      freelancer2,
      'Звіт-про-запуск.txt',
      'Лендінг опубліковано, форма оплати перевірена, швидкість 92/100.',
      null,
    ],
  ];
  await mkdir(storageDirectory, { recursive: true });
  for (const [
    index,
    [project, uploader, fileName, text, submissionTask],
  ] of files.entries()) {
    const fileId = id(1971 + index);
    const storagePath = `${fileId}.txt`;
    const content = Buffer.from(`${text}\n`, 'utf8');
    const path = new URL(storagePath, storageDirectory);
    try {
      await access(path);
    } catch {
      await writeFile(path, content);
    }
    await add('FileAttachment', {
      id: fileId,
      projectId: project.id,
      uploadedBy: uploader.id,
      fileName,
      storagePath,
      mimeType: 'text/plain',
      size: content.length,
      uploadedAt: new Date(project.updatedAt.getTime() - (5 - index) * 3600000),
      submissionId: submissionTask ? submissionIds[submissionTask] : null,
    });
  }

  // Непрочитані сповіщення для кожного демо-акаунта
  const notifications = [
    [
      client1,
      'NEW_APPLICATION',
      'На проєкт «Мобільний застосунок для фітнес-клубу» надійшло 3 заявки.',
      fitness,
    ],
    [
      client1,
      'NEW_MESSAGE',
      'Нове повідомлення в проєкті «Телеграм-бот для служби доставки».',
      bot,
    ],
    [
      client2,
      'SUBMISSION_CREATED',
      'Дизайн особистого кабінету передано на перевірку.',
      crm,
    ],
    [
      freelancer1,
      'TASK_ASSIGNED',
      'Вам призначено завдання «Онлайн-оплата абонементів».',
      crm,
    ],
    [
      freelancer2,
      'PROJECT_PAUSED',
      'Проєкт «Редизайн корпоративного блогу» призупинено.',
      blog,
    ],
    [
      freelancer3,
      'APPLICATION_ACCEPTED',
      'Вашу заявку на «Телеграм-бот для служби доставки» прийнято.',
      bot,
    ],
    [admin, 'NEW_COMPLAINT', 'Надійшла нова скарга щодо проєкту.', null],
  ];
  for (const [
    index,
    [user, type, message, project],
  ] of notifications.entries()) {
    await add('Notification', {
      id: id(1941 + index),
      userId: user.id,
      type,
      message,
      projectId: project?.id ?? null,
      taskId: null,
      readAt: null,
      createdAt: date(5),
    });
  }

  // Історія дій у проєкті CRM
  const activity = [
    [client2, 'PROJECT_CREATED', 'Клієнт створив проєкт.', -12],
    [client2, 'APPLICATION_ACCEPTED', 'Клієнт обрав виконавців.', -11],
    [
      freelancer1,
      'SUBMISSION_APPROVED',
      'Прийнято результат «Спроєктувати базу клієнтів».',
      -3,
    ],
    [
      freelancer3,
      'SUBMISSION_CREATED',
      'Передано на перевірку «Дизайн особистого кабінету».',
      4,
    ],
  ];
  for (const [index, [actor, type, message, days]] of activity.entries()) {
    await add('ActivityLog', {
      id: id(1951 + index),
      projectId: crm.id,
      actorId: actor.id,
      type,
      message,
      createdAt: date(days),
    });
  }

  // Скарга, яку адміністратор уже розглянув
  await add('Complaint', {
    id: id(1961),
    reporterId: client2.id,
    targetUserId: null,
    projectId: blog.id,
    reason: 'Довго немає відповіді',
    description:
      'Виконавець не відповідав два дні після постановки проєкту на паузу.',
    status: 'RESOLVED',
    adminNote: 'Зв’язалися з виконавцем, комунікацію відновлено.',
    createdAt: date(1),
    updatedAt: date(2),
  });

  // Навички й профілі для фрилансерів, яким їх бракувало
  for (const [userId, skillId] of [
    [freelancer1.id, postgresql.id],
    [freelancer3.id, telegramBot.id],
    [freelancer3.id, seo.id],
    [freelancer3.id, typescript.id],
  ])
    await addBy('FreelancerSkill', { userId, skillId }, { userId, skillId });
}
