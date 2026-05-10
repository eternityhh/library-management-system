const prisma = require("../db/prisma");
const { formatDateTime } = require("../utils/date");
const { AppError } = require("../lib/errors");
const bcrypt = require("bcrypt"); // 记得确认项目 package.json 里有没有 bcrypt，没有需 npm install bcrypt
const auditLogService = require("./auditLogService");
const ALLOWED_ROLES = ["STUDENT", "LIBRARIAN", "ADMIN"];

function parsePagination(query) {
  const page = Number(query.page || 1);
  const size = Number(query.size || 10);

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1) {
    throw new AppError(400, "参数错误");
  }

  return { page, size };
}

// DTO 转换：按照设计文档返回规范的 LibrarianDTO 格式
const toLibrarianDTO = (user) => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    staffId: user.studentId,
    role: user.role,
    createdAt: formatDateTime(user.createdAt),
  };
};

const toUserSummaryDTO = (user) => {
  const dto = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: formatDateTime(user.createdAt),
  };

  if (user.role === "STUDENT") {
    dto.studentId = user.studentId;
  }

  if (user.role === "LIBRARIAN") {
    dto.staffId = user.studentId;
  }

  return dto;
};

async function createLibrarian(operatorId, payload) {
  const { name, email, password, staffId } = payload;

  // 1. 基础校验
  if (!name || !email || !password || !staffId) {
    throw new AppError(400, "参数缺失/格式错误");
  }

  // 2. 校验邮箱唯一性
  const existingEmail = await prisma.user.findUnique({
    where: { email },
  });
  if (existingEmail) {
    throw new AppError(400, "该 email 已被注册");
  }

  // 3. 校验工号唯一性 (注意：查的是 studentId 字段)
  const existingStaff = await prisma.user.findFirst({
    where: { studentId: staffId },
  });
  if (existingStaff) {
    throw new AppError(400, "该 staffId 已存在");
  }

  // 4. 密码加密
  const passwordHash = await bcrypt.hash(password, 10);

  // 5. 存入数据库
  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      studentId: staffId,
      role: "LIBRARIAN",
    },
  });

  // 6. 记录审计日志
  await auditLogService.record(operatorId, "ADMIN_CREATE_LIBRARIAN", "User", newUser.id, {
    name,
    email,
    staffId
  });

  return toLibrarianDTO(newUser);
}

async function listLibrarians(query) {
  const { page, size } = parsePagination(query || {});
  const keyword = typeof query?.keyword === "string" ? query.keyword.trim() : "";

  const where = {
    role: "LIBRARIAN",
    ...(keyword
      ? {
        OR: [
          { name: { contains: keyword } },
          { email: { contains: keyword } },
          { studentId: { contains: keyword } },
        ],
      }
      : {}),
  };

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip: (page - 1) * size,
      take: size,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    total,
    page,
    size,
    list: users.map(toLibrarianDTO),
  };
}

async function getLibrarianDetail(librarianId) {
  const librarian = await prisma.user.findUnique({
    where: { id: librarianId },
  });

  if (!librarian || librarian.role !== "LIBRARIAN") {
    throw new AppError(404, "目标资源不存在");
  }

  return toLibrarianDTO(librarian);
}

async function updateLibrarian(operatorId, librarianId, payload) {
  const { name, email, staffId } = payload;

  // 1. 查找是否存在且为 LIBRARIAN 角色
  const librarian = await prisma.user.findUnique({
    where: { id: librarianId },
  });

  if (!librarian || librarian.role !== "LIBRARIAN") {
    throw new AppError(404, "目标资源不存在");
  }

  // 2. 如果修改了 email，检查新 email 是否冲突
  if (email && email !== librarian.email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      throw new AppError(400, "新 email 已被使用");
    }
  }

  // 3. 如果修改了 staffId，检查新 staffId 是否冲突 (排除自身)
  if (staffId && staffId !== librarian.studentId) {
    const existingStaff = await prisma.user.findFirst({
      where: {
        studentId: staffId,
        NOT: { id: librarianId },
      },
    });
    if (existingStaff) {
      throw new AppError(400, "新 staffId 已被使用");
    }
  }

  // 4. 执行更新 (按照 userService.js 的高级解构写法)
  const updatedUser = await prisma.user.update({
    where: { id: librarianId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(staffId !== undefined ? { studentId: staffId } : {}),
    },
  });

  // 5. 基于更新前后结果计算实际变更，避免未传字段在审计日志中变成 undefined
  const auditDetail = {};

  if (librarian.name !== updatedUser.name) {
    auditDetail.oldName = librarian.name;
    auditDetail.newName = updatedUser.name;
  }

  if (librarian.email !== updatedUser.email) {
    auditDetail.oldEmail = librarian.email;
    auditDetail.newEmail = updatedUser.email;
  }

  if (librarian.studentId !== updatedUser.studentId) {
    auditDetail.oldStaffId = librarian.studentId;
    auditDetail.newStaffId = updatedUser.studentId;
  }

  await auditLogService.record(
    operatorId,
    "ADMIN_UPDATE_LIBRARIAN",
    "User",
    librarianId,
    auditDetail
  );
  return toLibrarianDTO(updatedUser);
}

async function deleteLibrarian(operatorId, librarianId) {
  const librarian = await prisma.user.findUnique({
    where: { id: librarianId },
  });

  if (!librarian || librarian.role !== "LIBRARIAN") {
    throw new AppError(404, "目标资源不存在");
  }

  const detail = {
    name: librarian.name,
    email: librarian.email,
    staffId: librarian.studentId,
  };

  await prisma.$transaction(async (tx) => {
    await tx.user.delete({
      where: { id: librarianId },
    });

    await tx.auditLog.create({
      data: {
        userId: operatorId,
        action: "ADMIN_DELETE_LIBRARIAN",
        entity: "User",
        entityId: librarianId,
        detail: JSON.stringify(detail),
      },
    });
  });

  return null;
}

async function listUsers(query) {
  const { page, size } = parsePagination(query || {});
  const keyword = typeof query?.keyword === "string" ? query.keyword.trim() : "";
  const role = typeof query?.role === "string" ? query.role.trim() : "";

  if (role && !ALLOWED_ROLES.includes(role)) {
    throw new AppError(400, "参数错误");
  }

  const where = {
    ...(role ? { role } : {}),
    ...(keyword
      ? {
        OR: [
          { name: { contains: keyword } },
          { email: { contains: keyword } },
          { studentId: { contains: keyword } },
        ],
      }
      : {}),
  };

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip: (page - 1) * size,
      take: size,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    total,
    page,
    size,
    list: users.map(toUserSummaryDTO),
  };
}

async function deleteUser(operatorId, targetUserId) {
  if (!operatorId || !targetUserId) {
    throw new AppError(400, "参数错误");
  }

  if (operatorId === targetUserId) {
    throw new AppError(400, "禁止删除自己");
  }

  const operator = await prisma.user.findUnique({
    where: { id: operatorId },
  });

  if (!operator) {
    throw new AppError(404, "操作人不存在");
  }

  if (operator.role !== "ADMIN") {
    throw new AppError(403, "无权限执行此操作");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    throw new AppError(404, "用户不存在");
  }

  if (targetUser.role === "LIBRARIAN") {
    throw new AppError(400, "馆员账号请在馆员管理中删除");
  }

  if (targetUser.role === "ADMIN") {
    const adminCount = await prisma.user.count({
      where: { role: "ADMIN" },
    });

    if (adminCount <= 1) {
      throw new AppError(400, "系统至少保留一个管理员");
    }
  }

  await prisma.user.delete({
    where: { id: targetUserId },
  });

  return null;
}

async function updateUserRole(operatorId, targetUserId, role) {
  if (!operatorId || !targetUserId || !role) {
    throw new AppError(400, "参数错误");
  }

  if (!ALLOWED_ROLES.includes(role)) {
    throw new AppError(400, "参数错误");
  }

  if (operatorId === targetUserId) {
    throw new AppError(400, "禁止修改自己的角色");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    throw new AppError(404, "用户不存在");
  }

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { role },
  });

  // 记录审计日志
  await auditLogService.record(operatorId, "ADMIN_UPDATE_USER_ROLE", "User", targetUserId, {
    oldRole: targetUser.role,
    newRole: role,
    userName: targetUser.name,
    userEmail: targetUser.email
  });

  return toUserSummaryDTO(updatedUser);
}

function generateRandomPassword(length = 8) {
  const normalizedLength = Math.max(8, Math.min(32, Number(length) || 8));
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const allChars = letters + numbers;

  const randomChar = (source) => source.charAt(Math.floor(Math.random() * source.length));

  const chars = [randomChar(letters), randomChar(numbers)];
  for (let i = chars.length; i < normalizedLength; i++) {
    chars.push(randomChar(allChars));
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

function validatePassword(password) {
  if (!password || password.length < 8 || password.length > 32) {
    throw new AppError(400, "密码长度必须在8-32之间");
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new AppError(400, "密码必须至少包含字母和数字");
  }
}

async function resetUserPassword(operatorId, targetUserId, payload) {
  if (!operatorId || !targetUserId) {
    throw new AppError(400, "参数错误");
  }

  const operator = await prisma.user.findUnique({
    where: { id: operatorId },
  });

  if (!operator) {
    throw new AppError(404, "操作人不存在");
  }

  if (operator.role !== "ADMIN") {
    throw new AppError(403, "无权限执行此操作");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    throw new AppError(404, "用户不存在");
  }

  let newPassword;
  let tempPassword = null;

  if (payload.newPassword) {
    validatePassword(payload.newPassword);
    newPassword = payload.newPassword;
  } else {
    newPassword = generateRandomPassword();
    tempPassword = newPassword;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: targetUserId },
    data: { passwordHash },
  });

  // 记录审计日志
  await auditLogService.record(operatorId, "ADMIN_RESET_PASSWORD", "User", targetUserId, {
    userName: targetUser.name,
    userEmail: targetUser.email,
    isTempPassword: !!tempPassword
  });

  return {
    userId: targetUser.id,
    tempPassword,
  };
}

module.exports = {
  createLibrarian,
  listLibrarians,
  getLibrarianDetail,
  updateLibrarian,
  deleteLibrarian,
  listUsers,
  deleteUser,
  updateUserRole,
  resetUserPassword,
};
