const prisma = require("../db/prisma");
const { AppError } = require("../lib/errors");

async function getConfigMap(keys) {
  if (!Array.isArray(keys) || keys.length === 0) {
    return {};
  }

  const records = await prisma.config.findMany({
    where: {
      key: {
        in: keys,
      },
    },
  });

  return records.reduce((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});
}

async function getInt(key, defaultValue) {
  const configMap = await getConfigMap([key]);
  const raw = configMap[key];

  if (raw === null || raw === undefined) {
    return defaultValue;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new AppError(500, "Config parse error");
  }

  return parsed;
}

async function getDecimal(key, defaultValue) {
  const configMap = await getConfigMap([key]);
  const raw = configMap[key];

  if (raw === null || raw === undefined) {
    return defaultValue;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new AppError(500, "Config parse error");
  }

  return parsed;
}

async function setValue(key, value) {
  const normalizedValue = String(value);

  const row = await prisma.config.upsert({
    where: { key },
    update: { value: normalizedValue },
    create: {
      key,
      value: normalizedValue,
    },
    select: {
      key: true,
      value: true,
    },
  });

  return row;
}

module.exports = {
  getConfigMap,
  getInt,
  getDecimal,
  setValue,
};
