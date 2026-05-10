const adminConfigService = require("../services/adminConfigService");
const { sendSuccess } = require("../lib/response");

async function getConfig(req, res, next) {
  try {
    const data = await adminConfigService.getAdminConfig();
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function updateBorrowRules(req, res, next) {
  try {
    const operatorId = req.currentUser ? req.currentUser.id : null;
    const data = await adminConfigService.updateBorrowRules(operatorId, req.body);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function updateFineRate(req, res, next) {
  try {
    const operatorId = req.currentUser ? req.currentUser.id : null;
    const data = await adminConfigService.updateFineRate(operatorId, req.body);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getConfig,
  updateBorrowRules,
  updateFineRate
};
