const auditLogService = require("../services/auditLogService");
const { sendSuccess } = require("../lib/response");

async function listAuditLogs(req, res, next) {
  try {
    const {
      page = 1,
      size = 10,
      operatorId,
      operator,
      action,
      entity,
      from,
      to
    } = req.query;
    
    const query = {
      page: Number(page),
      size: Number(size),
      operatorId,
      operator,
      action,
      entity,
      from,
      to
    };
    
    const data = await auditLogService.list(query);
    
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listAuditLogs
};
