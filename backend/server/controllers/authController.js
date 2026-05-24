const authService = require("../services/authService");
const { sendSuccess } = require("../lib/response");

async function register(req, res, next) {
  try {
    const data = await authService.register(req.body);
    sendSuccess(res, data, "Registration successful");
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const data = await authService.login(req.body, res);
    sendSuccess(res, data, "Login successful");
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.authToken);
    sendSuccess(res, null, "Logged out successfully");
  } catch (error) {
    next(error);
  }
}



module.exports = {
  register,
  login,
  logout,
};
