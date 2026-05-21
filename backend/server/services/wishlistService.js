const prisma = require("../db/prisma");
const { AppError } = require("../lib/errors");
const { formatDateTime } = require("../utils/date");
const auditLogService = require("./auditLogService");

async function addToWishlist(userId, bookId) {
  // Check whether the book exists and is visible.
  const book = await prisma.book.findUnique({
    where: { id: bookId },
  });

  if (!book) {
    throw new AppError(404, "Book not found");
  }

  // Check whether the wishlist entry already exists.
  const existingWishlist = await prisma.wishlist.findFirst({
    where: {
      userId,
      bookId,
    },
  });

  if (existingWishlist) {
    throw new AppError(400, "This book is already in the wishlist");
  }

  const wishlist = await prisma.$transaction(async (tx) => {
    const record = await tx.wishlist.create({
      data: {
        userId,
        bookId,
      },
      include: {
        book: true,
      },
    });

    await auditLogService.recordWithClient(tx, userId, "WISHLIST_ADD", "Wishlist", record.id, {
      bookId: record.bookId,
      bookTitle: record.book.title,
    });

    return record;
  });

  return {
    id: wishlist.id,
    bookId: wishlist.bookId,
    bookTitle: wishlist.book.title,
    createdAt: formatDateTime(wishlist.createdAt),
  };
}

async function getWishlist(userId, page = 1, size = 10) {
  const skip = (page - 1) * size;
  
  const [wishlistItems, totalCount] = await Promise.all([
    prisma.wishlist.findMany({
      where: {
        userId,
      },
      include: {
        book: true,
      },
      orderBy: {
        createdAt: "desc", // Sort by added time in descending order.
      },
      skip,
      take: size,
    }),
    prisma.wishlist.count({
      where: {
        userId,
      },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / size);
  
  return {
    total: totalCount,
    page,
    size,
    totalPages,
    list: wishlistItems.map((item) => ({
      id: item.id,
      bookId: item.bookId,
      bookTitle: item.book.title,
      bookAuthor: item.book.author,
      available: item.book.available,
      availableCopies: item.book.availableCopies,
      createdAt: formatDateTime(item.createdAt),
    })),
  };
}

async function removeFromWishlist(userId, wishlistId) {
  await prisma.$transaction(async (tx) => {
    const wishlist = await tx.wishlist.findUnique({
      where: { id: wishlistId },
      include: {
        book: true,
      },
    });

    if (!wishlist || wishlist.userId !== userId) {
      throw new AppError(404, "Wishlist record not found or does not belong to the current user");
    }

    await tx.wishlist.delete({
      where: { id: wishlistId },
    });

    await auditLogService.recordWithClient(tx, userId, "WISHLIST_REMOVE", "Wishlist", wishlistId, {
      bookId: wishlist.bookId,
      bookTitle: wishlist.book?.title || null,
    });
  });
}

module.exports = {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
};
