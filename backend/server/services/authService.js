const bcrypt = require("bcrypt");

const prisma = require("../db/prisma");
const { AppError } = require("../lib/errors");
const { issueToken, revokeToken } = require("../lib/token");
const { formatDateTime } = require("../utils/date");

function toUserProfile(user) {
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    studentId: user.studentId,
    role: user.role,
    createdAt: formatDateTime(user.createdAt),
  };
}

async function register(payload) {
  const { name, email, password, studentId } = payload || {};

  if (!name || !email || !password) {
    throw new AppError(400, "Invalid parameters");
  }

  const existingEmailUser = await prisma.user.findUnique({
    where: { email },
  });
  if (existingEmailUser) {
    throw new AppError(400, "This email has already been registered");
  }

  if (studentId) {
    const existingStudent = await prisma.user.findFirst({
      where: { studentId },
    });
    if (existingStudent) {
      throw new AppError(400, "This student ID is already in use");
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      studentId: studentId || null,
      role: "STUDENT",
    },
  });

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

async function login(payload, res) {
  const { userName, password } = payload || {};

  if (!userName || !password) {
    throw new AppError(400, "Invalid parameters");
  }

  const user = await prisma.user.findUnique({
    where: { email: userName },
  });

  if (!user) {
    throw new AppError(401, "Invalid username or password");
  }

  const passwordMatched = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatched) {
    throw new AppError(401, "Invalid username or password");
  }

  const token = issueToken({
    userId: user.id,
    role: user.role,
  });

  if (res) {
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });
  }

  return {
    token,
    userId: user.id,
    userName: user.email,
    role: user.role,
  };
}

async function logout(token) {
  if (!token) {
    throw new AppError(401, "Not logged in or invalid token");
  }

  revokeToken(token);
}



module.exports = {
  register,
  login,
  logout,
  toUserProfile,
};
