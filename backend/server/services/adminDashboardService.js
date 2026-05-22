const prisma = require("../db/prisma");
const { AppError } = require("../lib/errors");
const { formatDateTime } = require("../utils/date");

const VALID_PERIODS = new Set(["7d", "30d", "90d"]);
const PERIOD_DAYS = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizePeriod(period) {
  const value = period || "30d";
  if (!VALID_PERIODS.has(value)) {
    throw new AppError(400, "Invalid parameters: period must be 7d, 30d, or 90d");
  }
  return value;
}

function normalizeLimit(value, defaultValue, maxValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > maxValue) {
    throw new AppError(400, `Invalid parameters: limit must be an integer between 1 and ${maxValue}`);
  }

  return limit;
}

function buildDailySeries(days) {
  const today = startOfDay();
  const series = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    series.push({
      date: formatDateKey(date),
      checkouts: 0,
      returns: 0,
    });
  }

  return series;
}

async function getOverviewStats() {
  const todayStart = startOfDay();
  const monthStart = startOfMonth();
  const now = new Date();

  const [
    totalUsers,
    students,
    librarians,
    admins,
    totalBooks,
    booksAggregate,
    activeLoans,
    overdueLoans,
    todayCheckouts,
    todayReturns,
    pendingHolds,
    readyHolds,
    unpaidFinesAggregate,
    monthRevenueAggregate,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "LIBRARIAN" } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.book.count(),
    prisma.book.aggregate({
      _sum: { availableCopies: true },
    }),
    prisma.loan.count({
      where: { status: { in: ["Borrowing", "Overdue"] } },
    }),
    prisma.loan.count({
      where: {
        OR: [
          { status: "Overdue" },
          {
            status: "Borrowing",
            returnDate: null,
            dueDate: { lt: now },
          },
        ],
      },
    }),
    prisma.loan.count({
      where: { checkoutDate: { gte: todayStart } },
    }),
    prisma.loan.count({
      where: { returnDate: { gte: todayStart } },
    }),
    prisma.hold.count({ where: { status: "WAITING" } }),
    prisma.hold.count({ where: { status: "READY" } }),
    prisma.loan.aggregate({
      where: {
        fineAmount: { gt: 0 },
        finePaid: false,
        fineForgiven: false,
      },
      _sum: { fineAmount: true },
    }),
    prisma.loan.aggregate({
      where: {
        finePaid: true,
        fineAmount: { gt: 0 },
        returnDate: { gte: monthStart },
      },
      _sum: { fineAmount: true },
    }),
  ]);

  const availableBooks = booksAggregate._sum.availableCopies || 0;
  const borrowedBooks = Math.max(activeLoans, 0);

  return {
    totalUsers,
    totalBooks,
    availableBooks,
    borrowedBooks,
    activeLoans,
    overdueLoans,
    todayCheckouts,
    todayReturns,
    pendingHolds,
    readyHolds,
    totalFinesUnpaid: Number(unpaidFinesAggregate._sum.fineAmount || 0),
    monthRevenue: Number(monthRevenueAggregate._sum.fineAmount || 0),
    usersByRole: {
      students,
      librarians,
      admins,
    },
  };
}

async function getLoanTrends(period) {
  const normalizedPeriod = normalizePeriod(period);
  const days = PERIOD_DAYS[normalizedPeriod];
  const todayStart = startOfDay();
  const rangeStart = new Date(todayStart);
  rangeStart.setDate(rangeStart.getDate() - (days - 1));

  const dailyMap = new Map(
    buildDailySeries(days).map((item) => [item.date, { ...item }]),
  );

  const loans = await prisma.loan.findMany({
    where: {
      OR: [
        { checkoutDate: { gte: rangeStart } },
        { returnDate: { gte: rangeStart } },
      ],
    },
    select: {
      checkoutDate: true,
      returnDate: true,
    },
  });

  loans.forEach((loan) => {
    if (loan.checkoutDate >= rangeStart) {
      const checkoutKey = formatDateKey(loan.checkoutDate);
      const checkoutBucket = dailyMap.get(checkoutKey);
      if (checkoutBucket) {
        checkoutBucket.checkouts += 1;
      }
    }

    if (loan.returnDate && loan.returnDate >= rangeStart) {
      const returnKey = formatDateKey(loan.returnDate);
      const returnBucket = dailyMap.get(returnKey);
      if (returnBucket) {
        returnBucket.returns += 1;
      }
    }
  });

  return {
    period: normalizedPeriod,
    daily: Array.from(dailyMap.values()),
  };
}

async function getPopularBooks(limit = 10) {
  const normalizedLimit = normalizeLimit(limit, 10, 50);

  const rows = await prisma.$queryRaw`
    SELECT
      l.bookId AS bookId,
      b.title AS title,
      b.author AS author,
      b.isbn AS isbn,
      COUNT(l.id) AS loanCount
    FROM "Loan" l
    INNER JOIN "Book" b ON b.id = l.bookId
    GROUP BY l.bookId, b.title, b.author, b.isbn
    ORDER BY loanCount DESC, b.title ASC, l.bookId ASC
    LIMIT ${normalizedLimit}
  `;

  return {
    list: rows.map((row, index) => ({
      rank: index + 1,
      bookId: row.bookId,
      title: row.title,
      author: row.author,
      isbn: row.isbn,
      loanCount: Number(row.loanCount),
    })),
  };
}

async function getRecentActivities(limit = 20) {
  const normalizedLimit = normalizeLimit(limit, 20, 100);

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: normalizedLimit,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return {
    list: logs.map((log) => ({
      id: log.id,
      operator: log.user ? log.user.name : "System",
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      createdAt: formatDateTime(log.createdAt),
    })),
  };
}

module.exports = {
  getOverviewStats,
  getLoanTrends,
  getPopularBooks,
  getRecentActivities,
};
