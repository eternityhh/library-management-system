const prisma = require("../db/prisma");
const { AppError } = require("../lib/errors");
const { formatDateTime } = require("../utils/date");
const notificationService = require("./notificationService");
const auditLogService = require("./auditLogService");

const HOLD_STATUS_FILTERS = ["WAITING", "READY", "CANCELLED"];
const CANCELLABLE_HOLD_STATUSES = ["WAITING", "READY"];

function toHoldRecord(hold) {
  return {
    id: hold.id,
    status: hold.status,
    createdAt: formatDateTime(hold.createdAt),
    updatedAt: formatDateTime(hold.updatedAt),
    readyAt: hold.readyAt ? formatDateTime(hold.readyAt) : null,
    bookId: hold.bookId,
    bookTitle: hold.book?.title || "This book is no longer available",
    bookAuthor: hold.book?.author || "-",
    isbn: hold.book?.isbn || "-",
    genre: hold.book?.genre || "-",
    language: hold.book?.language || "-",
    shelfLocation: hold.book?.shelfLocation || "-",
    availableCopies: hold.book?.availableCopies ?? 0,
    userId: hold.userId,
    userName: hold.user?.name || "Unknown user",
    userEmail: hold.user?.email || "-",
    studentId: hold.user?.studentId || null,
  };
}

function normalizePagination(page = 1, size = 10) {
  const pageNum = Number(page);
  const pageSize = Number(size);

  if (!Number.isInteger(pageNum) || pageNum < 1 || !Number.isInteger(pageSize) || pageSize < 1) {
    throw new AppError(400, "Invalid pagination parameters");
  }

  return {
    page: pageNum,
    size: pageSize,
    skip: (pageNum - 1) * pageSize,
  };
}

function validateHoldStatusFilter(status) {
  if (!status) {
    return;
  }

  if (!HOLD_STATUS_FILTERS.includes(status)) {
    throw new AppError(400, `Invalid hold status. Allowed values: ${HOLD_STATUS_FILTERS.join(", ")}`);
  }
}

async function findHoldWithRelations(holdId) {
  return prisma.hold.findUnique({
    where: { id: holdId },
    include: {
      book: true,
      user: true,
    },
  });
}

async function createHold(userId, bookId) {
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) {
    throw new AppError(404, "Book not found");
  }

  if (book.availableCopies > 0) {
    throw new AppError(400, "This book is currently available; please borrow it directly, or you have already reserved it");
  }

  const currentLoan = await prisma.loan.findFirst({
    where: {
      userId,
      bookId,
      status: "Borrowing",
    },
  });
  if (currentLoan) {
    throw new AppError(400, "You are currently borrowing this book and cannot reserve it before returning it");
  }

  const existingHold = await prisma.hold.findFirst({
    where: {
      userId,
      bookId,
      status: { in: ["WAITING", "READY"] },
    },
  });
  if (existingHold) {
    throw new AppError(400, "This book is currently available; please borrow it directly, or you have already reserved it");
  }

  const newHold = await prisma.$transaction(async (tx) => {
    const record = await tx.hold.create({
      data: {
        userId,
        bookId,
        status: "WAITING",
      },
      include: {
        book: true,
        user: true,
      },
    });

    await auditLogService.recordWithClient(tx, userId, "CREATE_HOLD", "Hold", record.id, {
      bookId,
      status: record.status,
    });

    return record;
  });

  return toHoldRecord(newHold);
}

async function getHolds(userId, status, page = 1, size = 10) {
  validateHoldStatusFilter(status);
  const pagination = normalizePagination(page, size);
  const where = { userId };

  if (status) {
    where.status = status;
  }

  const [total, holds] = await Promise.all([
    prisma.hold.count({ where }),
    prisma.hold.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        book: true,
        user: true,
      },
      skip: pagination.skip,
      take: pagination.size,
    }),
  ]);

  return {
    total,
    page: pagination.page,
    size: pagination.size,
    list: holds.map(toHoldRecord),
  };
}

async function getLibrarianHolds(query = {}) {
  const status = typeof query.status === "string" ? query.status.trim() : "";
  const keyword = typeof query.keyword === "string" ? query.keyword.trim() : "";

  validateHoldStatusFilter(status);
  const pagination = normalizePagination(query.page || 1, query.size || 50);
  const where = {};

  if (status) {
    where.status = status;
  }

  if (keyword) {
    where.OR = [
      {
        id: {
          contains: keyword,
        },
      },
      {
        user: {
          name: {
            contains: keyword,
          },
        },
      },
      {
        user: {
          email: {
            contains: keyword,
          },
        },
      },
      {
        user: {
          studentId: {
            contains: keyword,
          },
        },
      },
      {
        book: {
          title: {
            contains: keyword,
          },
        },
      },
      {
        book: {
          isbn: {
            contains: keyword,
          },
        },
      },
    ];
  }

  const [total, holds] = await Promise.all([
    prisma.hold.count({ where }),
    prisma.hold.findMany({
      where,
      include: {
        book: true,
        user: true,
      },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.size,
    }),
  ]);

  return {
    total,
    page: pagination.page,
    size: pagination.size,
    list: holds.map(toHoldRecord),
  };
}

async function markHoldReady(holdId, librarianId) {
  const hold = await findHoldWithRelations(holdId);

  if (!hold) {
    throw new AppError(404, "Reservation record not found");
  }

  if (hold.status !== "WAITING") {
    throw new AppError(400, "Only WAITING reservations can be marked READY");
  }

  if (!hold.book || hold.book.availableCopies <= 0) {
    throw new AppError(400, "No available copies for this reservation");
  }

  const readyAt = new Date();
  const nextAvailableCopies = hold.book.availableCopies - 1;

  const updatedHold = await prisma.$transaction(async (tx) => {
    await tx.book.update({
      where: { id: hold.bookId },
      data: {
        availableCopies: nextAvailableCopies,
        available: nextAvailableCopies > 0,
      },
    });

    const record = await tx.hold.update({
      where: { id: holdId },
      data: {
        status: "READY",
        readyAt,
      },
      include: {
        book: true,
        user: true,
      },
    });

    await auditLogService.recordWithClient(tx, librarianId, "MARK_HOLD_READY", "Hold", holdId, {
      bookId: hold.bookId,
      userId: hold.userId,
      readyAt: readyAt.toISOString(),
    });

    return record;
  });

  const notification = await notificationService.notifyHoldReady(
    updatedHold.user,
    updatedHold.book,
    updatedHold.id,
  );

  return {
    ...toHoldRecord(updatedHold),
    notification,
  };
}

async function performHoldCancellation(hold, actorUserId, action) {
  const shouldReleaseInventory = hold.status === "READY" && Boolean(hold.book);

  const updatedHold = await prisma.$transaction(async (tx) => {
    if (shouldReleaseInventory) {
      const nextAvailableCopies = hold.book.availableCopies + 1;

      await tx.book.update({
        where: { id: hold.bookId },
        data: {
          availableCopies: nextAvailableCopies,
          available: true,
        },
      });
    }

    const record = await tx.hold.update({
      where: { id: hold.id },
      data: {
        status: "CANCELLED",
      },
      include: {
        book: true,
        user: true,
      },
    });

    await auditLogService.recordWithClient(tx, actorUserId, action, "Hold", hold.id, {
      bookId: hold.bookId,
      userId: hold.userId,
      previousStatus: hold.status,
      inventoryReleased: shouldReleaseInventory,
    });

    return record;
  });

  return {
    ...toHoldRecord(updatedHold),
    inventoryReleased: shouldReleaseInventory,
  };
}

async function cancelHold(userId, holdId) {
  const hold = await findHoldWithRelations(holdId);

  if (!hold || hold.userId !== userId) {
    throw new AppError(404, "Reservation record not found or does not belong to the current user");
  }

  if (hold.status === "CANCELLED") {
    throw new AppError(400, "This reservation has already been cancelled");
  }

  if (!CANCELLABLE_HOLD_STATUSES.includes(hold.status)) {
    throw new AppError(400, "Only WAITING or READY reservations can be cancelled");
  }

  return performHoldCancellation(hold, userId, "CANCEL_HOLD");
}

async function cancelLibrarianHold(holdId, librarianId) {
  const hold = await findHoldWithRelations(holdId);

  if (!hold) {
    throw new AppError(404, "Reservation record not found");
  }

  if (hold.status === "CANCELLED") {
    throw new AppError(400, "This reservation has already been cancelled");
  }

  if (!CANCELLABLE_HOLD_STATUSES.includes(hold.status)) {
    throw new AppError(400, "Only WAITING or READY reservations can be cancelled");
  }

  return performHoldCancellation(hold, librarianId, "LIBRARIAN_CANCEL_HOLD");
}

module.exports = {
  createHold,
  getHolds,
  getLibrarianHolds,
  markHoldReady,
  cancelHold,
  cancelLibrarianHold,
};
