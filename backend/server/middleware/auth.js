const prisma = require("../db/prisma");
const { AppError } = require("../lib/errors");
const { verifyToken } = require("../lib/token");

async function requireAuth(req, res, next) {
  try {
    let token = "";

    const authorization = req.headers.authorization || "";
    const [type, headerToken] = authorization.split(" ");

    if (type === "Bearer" && headerToken) {
      token = headerToken;
    } else if (req.headers.cookie) {
      const cookies = req.headers.cookie.split(";").reduce((acc, c) => {
        const [key, val] = c.trim().split("=");
        acc[key] = val;
        return acc;
      }, {});
      token = cookies["token"] || "";
    }

    if (!token) {
      throw new AppError(401, "Not logged in or invalid token");
    }

    const payload = verifyToken(token);
    if (!payload?.userId) {
      throw new AppError(401, "Not logged in or invalid token");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new AppError(401, "Not logged in or invalid token");
    }

    req.authToken = token;
    req.currentUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requireAuth,
};
