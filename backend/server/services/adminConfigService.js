const { AppError } = require("../lib/errors");
const auditLogService = require("./auditLogService");
const configService = require("./configService");

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

async function getAdminConfig() {
  const [maxBorrowDays, maxBorrowBooks, dailyFineRate] = await Promise.all([
    configService.getInt(CONFIG_KEYS.BORROW_MAX_DAYS, DEFAULT_CONFIG.borrowRules.maxBorrowDays),
    configService.getInt(CONFIG_KEYS.BORROW_MAX_BOOKS, DEFAULT_CONFIG.borrowRules.maxBorrowBooks),
    configService.getDecimal(CONFIG_KEYS.FINE_DAILY_RATE, DEFAULT_CONFIG.fineRules.dailyFineRate),
  ]);

  return {
    borrowRules: {
      maxBorrowDays,
      maxBorrowBooks,
    },
    fineRules: {
      dailyFineRate,
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

async function updateBorrowRules(operatorId, payload) {
  validateBorrowRules(payload);

  const before = await getAdminConfig();

  await Promise.all([
    configService.setValue(CONFIG_KEYS.BORROW_MAX_DAYS, payload.maxBorrowDays),
    configService.setValue(CONFIG_KEYS.BORROW_MAX_BOOKS, payload.maxBorrowBooks),
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

  await configService.setValue(CONFIG_KEYS.FINE_DAILY_RATE, payload.dailyFineRate.toFixed(2));

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
