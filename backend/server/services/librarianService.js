const prisma = require("../db/prisma");
const { AppError } = require("../lib/errors");
const { formatDateTime } = require("../utils/date");

// Valid genre and language values from Prisma schema
const VALID_GENRES = ["Technology", "Fiction", "Science", "History", "Management"];
const VALID_LANGUAGES = ["Chinese", "English", "Others"];
const ACTIVE_LOAN_STATUSES = ["Borrowing", "Overdue"];

function buildIsbnSearchConditions(keyword) {
  const compactKeyword = keyword.replace(/[\s-]/g, "");
  const conditions = [{ isbn: { contains: keyword } }];

  if (compactKeyword && compactKeyword !== keyword) {
    conditions.push({ isbn: { contains: compactKeyword } });
  }

  return conditions;
}

function normalizeBarcodeValue(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  const withoutPrefix = raw.replace(/^(isbn|book|bookid|book-id)\s*[:#-]\s*/i, "").trim();

  return {
    raw,
    normalized: withoutPrefix,
    compact: withoutPrefix.replace(/[\s-]/g, ""),
  };
}

async function syncOverdueLoans() {
  await prisma.loan.updateMany({
    where: {
      status: "Borrowing",
      returnDate: null,
      dueDate: { lt: new Date() },
    },
    data: {
      status: "Overdue",
    },
  });
}

/**
 * Add a new book (L1.1)
 */
async function addBook(payload, userId) {
  const { title, author, isbn, genre, cover, description, language, shelfLocation, availableCopies } = payload || {};

  // Validate required fields
  if (!title || !author || !isbn || !genre || !language) {
    throw new AppError(400, "Missing required fields: title, author, isbn, genre, language are required");
  }

  // Validate genre
  if (!VALID_GENRES.includes(genre)) {
    throw new AppError(400, `Invalid genre. Must be one of: ${VALID_GENRES.join(", ")}`);
  }

  // Validate language
  if (!VALID_LANGUAGES.includes(language)) {
    throw new AppError(400, `Invalid language. Must be one of: ${VALID_LANGUAGES.join(", ")}`);
  }

  // Check ISBN uniqueness
  const existingBook = await prisma.book.findUnique({
    where: { isbn },
  });
  if (existingBook) {
    throw new AppError(400, "A book with this ISBN already exists");
  }

  // Create the book
  const book = await prisma.book.create({
    data: {
      title,
      author,
      isbn,
      genre,
      cover: cover || null,
      description: description || null,
      language,
      shelfLocation: shelfLocation || null,
      availableCopies: availableCopies !== undefined ? Number(availableCopies) : 1,
      available: availableCopies === undefined || Number(availableCopies) > 0,
    },
  });

  // Log the action
  await prisma.auditLog.create({
    data: {
      userId,
      action: "CREATE_BOOK",
      entity: "Book",
      entityId: book.id,
      detail: `Created book: ${book.title}`,
    },
  });

  return toBookDetail(book);
}

/**
 * Edit an existing book (L1.2)
 */
async function editBook(bookId, payload, userId) {
  // Check if book exists
  const existingBook = await prisma.book.findUnique({
    where: { id: bookId },
  });
  if (!existingBook) {
    throw new AppError(404, "Book not found");
  }

  const { title, author, isbn, genre, cover, description, language, shelfLocation, availableCopies } = payload || {};

  // Validate genre if provided
  if (genre && !VALID_GENRES.includes(genre)) {
    throw new AppError(400, `Invalid genre. Must be one of: ${VALID_GENRES.join(", ")}`);
  }

  // Validate language if provided
  if (language && !VALID_LANGUAGES.includes(language)) {
    throw new AppError(400, `Invalid language. Must be one of: ${VALID_LANGUAGES.join(", ")}`);
  }

  // Check ISBN uniqueness if changing ISBN
  if (isbn && isbn !== existingBook.isbn) {
    const isbnExists = await prisma.book.findUnique({
      where: { isbn },
    });
    if (isbnExists) {
      throw new AppError(400, "A book with this ISBN already exists");
    }
  }

  // Build update data with only provided fields
  const updateData = {};
  if (title !== undefined) updateData.title = title;
  if (author !== undefined) updateData.author = author;
  if (isbn !== undefined) updateData.isbn = isbn;
  if (genre !== undefined) updateData.genre = genre;
  if (cover !== undefined) updateData.cover = cover;
  if (description !== undefined) updateData.description = description;
  if (language !== undefined) updateData.language = language;
  if (shelfLocation !== undefined) updateData.shelfLocation = shelfLocation;
  if (availableCopies !== undefined) {
    updateData.availableCopies = Number(availableCopies);
    updateData.available = Number(availableCopies) > 0;
  }

  // Update the book
  const updatedBook = await prisma.book.update({
    where: { id: bookId },
    data: updateData,
  });

  // Log the action
  await prisma.auditLog.create({
    data: {
      userId,
      action: "UPDATE_BOOK",
      entity: "Book",
      entityId: bookId,
      detail: `Updated book: ${updatedBook.title}`,
    },
  });

  return toBookDetail(updatedBook);
}

/**
 * View all books with status (L1.3)
 */
async function viewBooks(query) {
  const page = Number(query.page || 1);
  const size = Number(query.size || 10);

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1) {
    throw new AppError(400, "Invalid pagination parameters");
  }

  const skip = (page - 1) * size;

  // Build filter conditions
  const where = {};

  // Keyword search
  if (query.keyword && typeof query.keyword === "string") {
    const keyword = query.keyword.trim();
    const type = typeof query.type === "string" ? query.type.trim() : "";

    if (!keyword) {
      throw new AppError(400, "Invalid search keyword");
    }

    if (type && !["title", "author", "isbn"].includes(type)) {
      throw new AppError(400, "Invalid search type");
    }

    where.OR =
      type === "title"
        ? [{ title: { contains: keyword } }]
        : type === "author"
          ? [{ author: { contains: keyword } }]
          : type === "isbn"
            ? buildIsbnSearchConditions(keyword)
            : [
                { title: { contains: keyword } },
                { author: { contains: keyword } },
                ...buildIsbnSearchConditions(keyword),
              ];
  }

  // Genre filter
  if (query.genre) {
    where.genre = query.genre;
  }

  // Availability filter
  if (query.available !== undefined) {
    where.available = query.available === "true";
  }

  // Get total count and book list
  const [total, books] = await Promise.all([
    prisma.book.count({ where }),
    prisma.book.findMany({
      where,
      skip,
      take: size,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    total,
    page,
    size,
    list: books.map(toBookSummary),
  };
}

/**
 * Look up a book from a scanned barcode value.
 *
 * Barcode scanners usually submit plain text. In this project the barcode value
 * is treated as either a Book ID or ISBN.
 */
async function lookupBarcode(code) {
  const { raw, normalized, compact } = normalizeBarcodeValue(code);

  if (!raw || !normalized) {
    throw new AppError(400, "Barcode is required");
  }

  const isbnCandidates = Array.from(new Set([normalized, compact].filter(Boolean)));
  const book = await prisma.book.findFirst({
    where: {
      OR: [
        { id: normalized },
        ...isbnCandidates.map((isbn) => ({ isbn })),
      ],
    },
  });

  if (!book) {
    throw new AppError(404, "Book not found for this barcode");
  }

  return {
    ...toBookDetail(book),
    barcode: raw,
    barcodeType: book.id === normalized ? "BOOK_ID" : "ISBN",
  };
}

/**
 * Fine Dashboard metrics for librarians.
 */
async function getFineDashboard() {
  await syncOverdueLoans();

  const unpaidFineWhere = {
    fineAmount: { gt: 0 },
    finePaid: false,
    fineForgiven: false,
  };

  const [bookCopySummary, checkedOutBooks, overdueBooks, unpaidFineLoans] = await Promise.all([
    prisma.book.aggregate({
      _sum: {
        availableCopies: true,
      },
    }),
    prisma.loan.count({
      where: {
        status: {
          in: ACTIVE_LOAN_STATUSES,
        },
      },
    }),
    prisma.loan.count({
      where: {
        status: "Overdue",
      },
    }),
    prisma.loan.findMany({
      where: unpaidFineWhere,
      include: {
        book: true,
        user: true,
      },
      orderBy: [
        { dueDate: "asc" },
        { returnDate: "desc" },
      ],
    }),
  ]);

  const fineItems = unpaidFineLoans.map((loan) => ({
    loanId: loan.id,
    userId: loan.userId,
    userName: loan.user?.name || "Unknown user",
    userEmail: loan.user?.email || "-",
    studentId: loan.user?.studentId || "-",
    bookId: loan.bookId,
    bookTitle: loan.book?.title || "This book is no longer available",
    isbn: loan.book?.isbn || "-",
    dueDate: formatDateTime(loan.dueDate),
    returnDate: loan.returnDate ? formatDateTime(loan.returnDate) : null,
    fineAmount: Number(loan.fineAmount),
    status: loan.status,
  }));

  return {
    booksInLibrary: bookCopySummary._sum.availableCopies || 0,
    checkedOutBooks,
    overdueBooks,
    fineDueToday: fineItems.reduce((sum, item) => sum + item.fineAmount, 0),
    fineItemCount: fineItems.length,
    fineItems,
    generatedAt: formatDateTime(new Date()),
  };
}

/**
 * Delete/Archive a book (L1.4)
 */
async function deleteBook(bookId, userId) {
  // Check if book exists
  const existingBook = await prisma.book.findUnique({
    where: { id: bookId },
  });
  if (!existingBook) {
    throw new AppError(404, "Book not found");
  }

  // Check if book has active loans
  const activeLoans = await prisma.loan.count({
    where: {
      bookId,
      status: "Borrowing",
    },
  });
  if (activeLoans > 0) {
    throw new AppError(400, "Cannot delete book with active loans");
  }

  // Delete the book (soft delete by setting available to false and availableCopies to 0)
  // Or hard delete - based on requirements, we'll do hard delete but log it
  await prisma.book.delete({
    where: { id: bookId },
  });

  // Log the action
  await prisma.auditLog.create({
    data: {
      userId,
      action: "DELETE_BOOK",
      entity: "Book",
      entityId: bookId,
      detail: `Deleted book: ${existingBook.title}`,
    },
  });

  return null;
}

/**
 * Helper: Convert book to summary format
 */
function toBookSummary(book) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    genre: book.genre,
    cover: book.cover,
    language: book.language,
    shelfLocation: book.shelfLocation,
    available: book.available,
    availableCopies: book.availableCopies,
    createdAt: formatDateTime(book.createdAt),
  };
}

/**
 * Helper: Convert book to detail format
 */
function toBookDetail(book) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    genre: book.genre,
    cover: book.cover,
    description: book.description,
    language: book.language,
    shelfLocation: book.shelfLocation,
    available: book.available,
    availableCopies: book.availableCopies,
    createdAt: formatDateTime(book.createdAt),
  };
}

module.exports = {
  addBook,
  editBook,
  viewBooks,
  lookupBarcode,
  getFineDashboard,
  deleteBook,
};
