const adminAnnouncementService = require("../services/adminAnnouncementService");
const { sendSuccess } = require("../lib/response");

async function createAnnouncement(req, res, next) {
  try {
    const operatorId = req.currentUser ? req.currentUser.id : null;
    const data = await adminAnnouncementService.createAnnouncement(operatorId, req.body || {});
    sendSuccess(res, data, "公告创建成功");
  } catch (error) {
    next(error);
  }
}

async function updateAnnouncement(req, res, next) {
  try {
    const operatorId = req.currentUser ? req.currentUser.id : null;
    const data = await adminAnnouncementService.updateAnnouncement(
      operatorId,
      req.params.id,
      req.body || {},
    );
    sendSuccess(res, data, "公告更新成功");
  } catch (error) {
    next(error);
  }
}

async function deleteAnnouncement(req, res, next) {
  try {
    const operatorId = req.currentUser ? req.currentUser.id : null;
    await adminAnnouncementService.deleteAnnouncement(operatorId, req.params.id);
    sendSuccess(res, null, "公告删除成功");
  } catch (error) {
    next(error);
  }
}

async function publishAnnouncement(req, res, next) {
  try {
    const operatorId = req.currentUser ? req.currentUser.id : null;
    const data = await adminAnnouncementService.publishAnnouncement(operatorId, req.params.id);
    sendSuccess(res, data, "公告发布成功");
  } catch (error) {
    next(error);
  }
}

async function unpublishAnnouncement(req, res, next) {
  try {
    const operatorId = req.currentUser ? req.currentUser.id : null;
    const data = await adminAnnouncementService.unpublishAnnouncement(operatorId, req.params.id);
    sendSuccess(res, data, "公告下架成功");
  } catch (error) {
    next(error);
  }
}

async function listAnnouncements(req, res, next) {
  try {
    const data = await adminAnnouncementService.listAnnouncements(req.query || {});
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  unpublishAnnouncement,
  listAnnouncements,
};
