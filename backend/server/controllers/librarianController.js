const librarianService = require("../services/librarianService");
const { sendSuccess } = require("../lib/response");

/**
 * L1.1 - Add a new book
 * POST /api/librarian/books
 */
async function addBook(req, res, next) {
  try {
    const userId = req.currentUser?.id;
    const data = await librarianService.addBook(req.body, userId);
    sendSuccess(res, data, "Book added successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * L1.2 - Edit an existing book
 * PUT /api/librarian/books/:id
 */
async function editBook(req, res, next) {
  try {
    const bookId = req.params.id;
    const userId = req.currentUser?.id;
    const data = await librarianService.editBook(bookId, req.body, userId);
    sendSuccess(res, data, "Book updated successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * L1.3 - View all books with status
 * GET /api/librarian/books
 */
async function viewBooks(req, res, next) {
  try {
    const data = await librarianService.viewBooks(req.query);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

/**
 * Barcode lookup for librarian checkout
 * GET /api/librarian/barcodes/:code
 */
async function lookupBarcode(req, res, next) {
  try {
    const data = await librarianService.lookupBarcode(req.params.code);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

/**
 * Fine Dashboard
 * GET /api/librarian/fine-dashboard
 */
async function getFineDashboard(req, res, next) {
  try {
    const data = await librarianService.getFineDashboard();
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

/**
 * L1.4 - Delete/Archive a book
 * DELETE /api/librarian/books/:id
 */
async function deleteBook(req, res, next) {
  try {
    const bookId = req.params.id;
    const userId = req.currentUser?.id;
    await librarianService.deleteBook(bookId, userId);
    sendSuccess(res, null, "Book deleted successfully");
  } catch (error) {
    next(error);
  }
}

module.exports = {
  addBook,
  editBook,
  viewBooks,
  lookupBarcode,
  getFineDashboard,
  deleteBook,
};
