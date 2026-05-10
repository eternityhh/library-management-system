const prisma = require("../db/prisma");
const { AppError } = require("../lib/errors");
const auditLogService = require("./auditLogService");

const CONFIG_KEYS = {
  BORROW_MAX_DAYS: "BORROW_MAX_DAYS",
  BORROW_MAX_BOOKS: "BORROW_MAX_BOOKS",
  FINE_DAILY_RATE: "FINE_DAILY_RATE",
};

const DEFAULT_CONFIG = {
  borrowRules: {
    maxBorrowDays: 30,
    maxBorrowBooks: 5,
  },
  fineRules: {
    dailyFineRate: 1.0,
  },
};

function ensureObject(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AppError(400, "参数错误");
  }
}

function parseIntConfig(key, value, defaultValue) {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new AppError(500, "Config parse error");
  }
  return parsed;
}

function parseDecimalConfig(value, defaultValue) {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AppError(500, "Config parse error");
  }
  return parsed;
}

function toConfigMap(records) {
  return new Map(records.map((item) => [item.key, item.value]));
}

async function getAdminConfig() {
  const records = await prisma.config.findMany({
    where: {
      key: {
        in: [CONFIG_KEYS.BORROW_MAX_DAYS, CONFIG_KEYS.BORROW_MAX_BOOKS, CONFIG_KEYS.FINE_DAILY_RATE],
      },
    },
  });

  const configMap = toConfigMap(records);

  return {
    borrowRules: {
      maxBorrowDays: parseIntConfig(
        CONFIG_KEYS.BORROW_MAX_DAYS,
        configMap.get(CONFIG_KEYS.BORROW_MAX_DAYS),
        DEFAULT_CONFIG.borrowRules.maxBorrowDays,
      ),
      maxBorrowBooks: parseIntConfig(
        CONFIG_KEYS.BORROW_MAX_BOOKS,
        configMap.get(CONFIG_KEYS.BORROW_MAX_BOOKS),
        DEFAULT_CONFIG.borrowRules.maxBorrowBooks,
      ),
    },
    fineRules: {
      dailyFineRate: parseDecimalConfig(
        configMap.get(CONFIG_KEYS.FINE_DAILY_RATE),
        DEFAULT_CONFIG.fineRules.dailyFineRate,
      ),
    },
  };
}

function validateBorrowRules(payload) {
  ensureObject(payload);
  const { maxBorrowDays, maxBorrowBooks } = payload;

  if (!Number.isInteger(maxBorrowDays) || maxBorrowDays < 1 || maxBorrowDays > 365) {
    throw new AppError(400, "参数错误");
  }

  if (!Number.isInteger(maxBorrowBooks) || maxBorrowBooks < 1 || maxBorrowBooks > 50) {
    throw new AppError(400, "参数错误");
  }
}

function hasAtMostTwoDecimals(value) {
  const scaled = Math.round(value * 100);
  return Math.abs(value * 100 - scaled) < 1e-8;
}

function validateFineRate(payload) {
  ensureObject(payload);
  const { dailyFineRate } = payload;

  if (
    typeof dailyFineRate !== "number" ||
    !Number.isFinite(dailyFineRate) ||
    dailyFineRate < 0 ||
    dailyFineRate > 100 ||
    !hasAtMostTwoDecimals(dailyFineRate)
  ) {
    throw new AppError(400, "参数错误");
  }
}

function upsertConfigValue(key, value) {
  return prisma.config.upsert({
    where: { key },
    update: { value: String(value) },
    create: {
      key,
      value: String(value),
    },
  });
}

async function updateBorrowRules(operatorId, payload) {
  validateBorrowRules(payload);

  const before = await getAdminConfig();

  await prisma.$transaction([
    upsertConfigValue(CONFIG_KEYS.BORROW_MAX_DAYS, payload.maxBorrowDays),
    upsertConfigValue(CONFIG_KEYS.BORROW_MAX_BOOKS, payload.maxBorrowBooks),
  ]);

  await auditLogService.record(operatorId, "ADMIN_UPDATE_BORROW_RULES", "Config", null, {
    before: before.borrowRules,
    after: {
      maxBorrowDays: payload.maxBorrowDays,
      maxBorrowBooks: payload.maxBorrowBooks,
    },
  });

  return {
    borrowRules: {
      maxBorrowDays: payload.maxBorrowDays,
      maxBorrowBooks: payload.maxBorrowBooks,
    },
  };
}

async function updateFineRate(operatorId, payload) {
  validateFineRate(payload);

  const before = await getAdminConfig();

  await upsertConfigValue(CONFIG_KEYS.FINE_DAILY_RATE, payload.dailyFineRate.toFixed(2));

  await auditLogService.record(operatorId, "ADMIN_UPDATE_FINE_RATE", "Config", null, {
    before: before.fineRules,
    after: {
      dailyFineRate: payload.dailyFineRate,
    },
  });

  return {
    fineRules: {
      dailyFineRate: payload.dailyFineRate,
    },
  };
}

module.exports = {
  getAdminConfig,
  updateBorrowRules,
  updateFineRate,
};
