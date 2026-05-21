const assert = require("node:assert/strict");

const app = require("../server/app");
const prisma = require("../server/db/prisma");

let server;
let baseUrl;
let librarianToken;
let borrowerId;
const createdBookIds = [];
const createdLoanIds = [];
const createdUserIds = [];
const uniqueSuffix = Date.now();

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  return { response, body };
}

async function loginByEmail(email, password) {
  return request("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName: email,
      password,
    }),
  });
}

async function cleanup() {
  if (createdLoanIds.length) {
    await prisma.loan.deleteMany({
      where: {
        id: {
          in: createdLoanIds,
        },
      },
    });
  }

  if (createdBookIds.length) {
    await prisma.book.deleteMany({
      where: {
        id: {
          in: createdBookIds,
        },
      },
    });
  }

  if (createdUserIds.length) {
    await prisma.user.deleteMany({
      where: {
        id: {
          in: createdUserIds,
        },
      },
    });
  }

  await prisma.$disconnect();

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function main() {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;

  const checkoutBook = await prisma.book.create({
    data: {
      title: `Librarian Release2 Checkout ${uniqueSuffix}`,
      author: "Codex Librarian",
      isbn: `librarian-r2-checkout-${uniqueSuffix}`,
      genre: "Technology",
      language: "English",
      shelfLocation: "LIB-R2-001",
      available: true,
      availableCopies: 1,
    },
  });
  createdBookIds.push(checkoutBook.id);

  const unavailableBook = await prisma.book.create({
    data: {
      title: `Librarian Release2 Unavailable ${uniqueSuffix}`,
      author: "Codex Librarian",
      isbn: `librarian-r2-unavailable-${uniqueSuffix}`,
      genre: "Technology",
      language: "English",
      shelfLocation: "LIB-R2-002",
      available: false,
      availableCopies: 0,
    },
  });
  createdBookIds.push(unavailableBook.id);

  const fineBook = await prisma.book.create({
    data: {
      title: `Librarian Release2 Fine ${uniqueSuffix}`,
      author: "Codex Librarian",
      isbn: `librarian-r2-fine-${uniqueSuffix}`,
      genre: "Science",
      language: "English",
      shelfLocation: "LIB-R2-003",
      available: true,
      availableCopies: 1,
    },
  });
  createdBookIds.push(fineBook.id);

  const borrowerEmail = `librarian.release2.student.${uniqueSuffix}@example.com`;
  const registerBorrower = await request("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Librarian Release2 Borrower",
      email: borrowerEmail,
      password: "student123",
      studentId: `LR2${uniqueSuffix}`,
    }),
  });
  assert.equal(registerBorrower.response.status, 200);
  borrowerId = registerBorrower.body.data.userId;
  createdUserIds.push(borrowerId);

  const librarianLogin = await loginByEmail("librarian@library.com", "lib123");
  assert.equal(librarianLogin.response.status, 200);
  librarianToken = librarianLogin.body.data.token;

  const invalidUserCheckout = await request("/api/librarian/loans/checkout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${librarianToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: "missing-user-id",
      bookId: checkoutBook.id,
    }),
  });
  assert.equal(invalidUserCheckout.response.status, 404);
  assert.equal(invalidUserCheckout.body.message, "User not found");

  const invalidBookCheckout = await request("/api/librarian/loans/checkout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${librarianToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: borrowerId,
      bookId: "missing-book-id",
    }),
  });
  assert.equal(invalidBookCheckout.response.status, 404);
  assert.equal(invalidBookCheckout.body.message, "Book not found");

  const unavailableCheckout = await request("/api/librarian/loans/checkout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${librarianToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: borrowerId,
      bookId: unavailableBook.id,
    }),
  });
  assert.equal(unavailableCheckout.response.status, 400);
  assert.equal(unavailableCheckout.body.message, "Book is not available for checkout");

  const checkoutResult = await request("/api/librarian/loans/checkout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${librarianToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: borrowerId,
      bookIdOrIsbn: checkoutBook.isbn,
    }),
  });
  assert.equal(checkoutResult.response.status, 200);
  assert.equal(checkoutResult.body.message, "Checkout successful");
  assert.equal(checkoutResult.body.data.userId, borrowerId);
  assert.equal(checkoutResult.body.data.bookId, checkoutBook.id);
  const checkoutLoanId = checkoutResult.body.data.loanId;
  createdLoanIds.push(checkoutLoanId);

  const borrowedCheckoutBook = await prisma.book.findUnique({
    where: { id: checkoutBook.id },
  });
  assert.equal(borrowedCheckoutBook.availableCopies, 0);
  assert.equal(borrowedCheckoutBook.available, false);

  const loanList = await request("/api/librarian/loans", {
    headers: {
      Authorization: `Bearer ${librarianToken}`,
    },
  });
  assert.equal(loanList.response.status, 200);
  assert.ok(
    loanList.body.data.list.some(
      (loan) => loan.id === checkoutLoanId && loan.userId === borrowerId && loan.bookId === checkoutBook.id,
    ),
  );

  const returnResult = await request("/api/librarian/loans/return", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${librarianToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      loanId: checkoutLoanId,
    }),
  });
  assert.equal(returnResult.response.status, 200);
  assert.equal(returnResult.body.message, "Return successful");
  assert.equal(returnResult.body.data.fineAmount, 0);

  const returnedCheckoutBook = await prisma.book.findUnique({
    where: { id: checkoutBook.id },
  });
  assert.equal(returnedCheckoutBook.availableCopies, 1);
  assert.equal(returnedCheckoutBook.available, true);

  const duplicateReturn = await request("/api/librarian/loans/return", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${librarianToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      loanId: checkoutLoanId,
    }),
  });
  assert.equal(duplicateReturn.response.status, 400);
  assert.equal(duplicateReturn.body.message, "This loan record has already been returned");

  const fineCheckout = await request("/api/librarian/loans/checkout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${librarianToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: borrowerId,
      bookId: fineBook.id,
    }),
  });
  assert.equal(fineCheckout.response.status, 200);
  const fineLoanId = fineCheckout.body.data.loanId;
  createdLoanIds.push(fineLoanId);

  await prisma.loan.update({
    where: { id: fineLoanId },
    data: {
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  const overdueReturn = await request("/api/librarian/loans/return", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${librarianToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      loanId: fineLoanId,
    }),
  });
  assert.equal(overdueReturn.response.status, 200);
  assert.equal(overdueReturn.body.data.fineAmount, 2.5);

  const blockedCheckout = await request("/api/librarian/loans/checkout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${librarianToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: borrowerId,
      bookId: checkoutBook.id,
    }),
  });
  assert.equal(blockedCheckout.response.status, 400);
  assert.equal(blockedCheckout.body.message, "User has unpaid fines");

  console.log("Librarian Release2 smoke test passed.");
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(cleanup);
