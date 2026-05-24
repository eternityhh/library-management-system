const auditLogService = require("./auditLogService");

async function notifyHoldReady(user, book, holdId) {
  const message = `您预订的《${book.title}》已可借阅，请尽快领取。`;

  await auditLogService.record(user.id, "HOLD_READY_NOTIFICATION", "Hold", holdId, {
    channel: "IN_APP",
    message,
    bookId: book.id,
    bookTitle: book.title,
  });

  return {
    channel: "IN_APP",
    message,
  };
}

module.exports = {
  notifyHoldReady,
};
