const prisma = require("../db/prisma");
const { AppError } = require("../lib/errors");
const { toUserProfile } = require("./authService");
const auditLogService = require("./auditLogService");

async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  return toUserProfile(user);
}

async function updateCurrentUser(userId, payload) {
  const { name, studentId } = payload || {};

  if (name === undefined && studentId === undefined) {
    throw new AppError(400, "Invalid parameters");
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    throw new AppError(404, "User not found");
  }

  if (studentId) {
    const existingStudent = await prisma.user.findFirst({
      where: {
        studentId,
        NOT: { id: userId },
      },
    });

    if (existingStudent) {
      throw new AppError(400, "This student ID is already in use");
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(studentId !== undefined ? { studentId } : {}),
    },
  });

  const auditDetail = {};
  if (existingUser.name !== user.name) {
    auditDetail.oldName = existingUser.name;
    auditDetail.newName = user.name;
  }
  if (existingUser.studentId !== user.studentId) {
    auditDetail.oldStudentId = existingUser.studentId;
    auditDetail.newStudentId = user.studentId;
  }

  await auditLogService.record(
    userId,
    "USER_UPDATE_PROFILE",
    "User",
    userId,
    Object.keys(auditDetail).length ? auditDetail : null,
  );

  return toUserProfile(user);
}

module.exports = {
  getCurrentUser,
  updateCurrentUser,
};
