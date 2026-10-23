import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
    email: 'client1@demo.tasko.example',
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
    email: 'freelancer1@demo.tasko.example',
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
    email: 'admin@demo.tasko.example',
    role: 'ADMIN',
  },
];
const [client1, client2, freelancer1, freelancer2, freelancer3] = users;
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
  });
  console.log('Демонстраційні дані готові. Додано:', JSON.stringify(created));
  console.log('Дані для входу:', fileURLToPath(credentialsFile));
} finally {
  await db.close();
}
