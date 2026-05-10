const assert = require("node:assert/strict");

const app = require("../server/app");
const prisma = require("../server/db/prisma");

let server;
let baseUrl;
let adminToken;
let studentToken;
let adminUserId;
const createdUserIds = [];
const createdBookIds = [];
const uniqueSuffix = Date.now();

const studentEmail = `admin.r2.student.${uniqueSuffix}@example.com`;
const bookIsbnPrefix = `R2-${uniqueSuffix}`;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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

function formatDateTime(date) {
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}:${pad(date.getSeconds())}`;
}

function parseDateTime(value) {
  if (!value || typeof value !== "string" || !value.includes(" ")) {
    return null;
  }

  const [datePart, timePart] = value.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);

  return new Date(year, month - 1, day, hour, minute, second);
}

async function createBook(token, payload) {
  const result = await request("/api/librarian/books", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  assert.equal(result.response.status, 200);
  assert.ok(result.body.data.id);
  createdBookIds.push(result.body.data.id);
  return result.body.data;
}

async function cleanup() {
  if (createdUserIds.length) {
    await prisma.loan.deleteMany({
      where: {
        userId: {
          in: createdUserIds,
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: createdUserIds,
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

  const adminLoginResult = await loginByEmail("admin@library.com", "admin123");
  assert.equal(adminLoginResult.response.status, 200);
  assert.equal(adminLoginResult.body.data.role, "ADMIN");
  assert.ok(adminLoginResult.body.data.token);
  adminToken = adminLoginResult.body.data.token;
  adminUserId = adminLoginResult.body.data.userId;

  const registerStudentResult = await request("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Admin R2 Smoke Student",
      email: studentEmail,
      password: "student123",
      studentId: `S${uniqueSuffix}`,
    }),
  });
  assert.equal(registerStudentResult.response.status, 200);
  const studentUserId = registerStudentResult.body.data.userId;
  createdUserIds.push(studentUserId);

  const studentLoginResult = await loginByEmail(studentEmail, "student123");
  assert.equal(studentLoginResult.response.status, 200);
  assert.ok(studentLoginResult.body.data.token);
  studentToken = studentLoginResult.body.data.token;

  const getConfigByAdmin = await request("/api/admin/config", {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(getConfigByAdmin.response.status, 200);
  assert.equal(typeof getConfigByAdmin.body.data.borrowRules.maxBorrowDays, "number");
  assert.equal(typeof getConfigByAdmin.body.data.borrowRules.maxBorrowBooks, "number");
  assert.equal(typeof getConfigByAdmin.body.data.fineRules.dailyFineRate, "number");

  const updateBorrowRulesByAdmin = await request("/api/admin/config/borrow-rules", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      maxBorrowDays: 2,
      maxBorrowBooks: 2,
    }),
  });
  assert.equal(updateBorrowRulesByAdmin.response.status, 200);
  assert.equal(updateBorrowRulesByAdmin.body.data.borrowRules.maxBorrowDays, 2);
  assert.equal(updateBorrowRulesByAdmin.body.data.borrowRules.maxBorrowBooks, 2);

  const updateBorrowRulesInvalid = await request("/api/admin/config/borrow-rules", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      maxBorrowDays: 0,
      maxBorrowBooks: 10,
    }),
  });
  assert.equal(updateBorrowRulesInvalid.response.status, 400);

  const updateFineRateByAdmin = await request("/api/admin/config/fine-rate", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dailyFineRate: 1.25,
    }),
  });
  assert.equal(updateFineRateByAdmin.response.status, 200);
  assert.equal(updateFineRateByAdmin.body.data.fineRules.dailyFineRate, 1.25);

  const updateFineRateInvalid = await request("/api/admin/config/fine-rate", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dailyFineRate: 1.234,
    }),
  });
  assert.equal(updateFineRateInvalid.response.status, 400);

  const getConfigAfterUpdates = await request("/api/admin/config", {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(getConfigAfterUpdates.response.status, 200);
  assert.equal(getConfigAfterUpdates.body.data.borrowRules.maxBorrowDays, 2);
  assert.equal(getConfigAfterUpdates.body.data.borrowRules.maxBorrowBooks, 2);
  assert.equal(getConfigAfterUpdates.body.data.fineRules.dailyFineRate, 1.25);

  const configForbiddenByStudent = await request("/api/admin/config", {
    headers: {
      Authorization: `Bearer ${studentToken}`,
    },
  });
  assert.equal(configForbiddenByStudent.response.status, 403);

  const fineRateUpdateForbiddenByStudent = await request("/api/admin/config/fine-rate", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dailyFineRate: 2.0,
    }),
  });
  assert.equal(fineRateUpdateForbiddenByStudent.response.status, 403);

  const auditLogsForbiddenByStudent = await request("/api/admin/audit-logs?page=1&size=10", {
    headers: {
      Authorization: `Bearer ${studentToken}`,
    },
  });
  assert.equal(auditLogsForbiddenByStudent.response.status, 403);

  const book1 = await createBook(adminToken, {
    title: "R2 Smoke Book 1",
    author: "Smoke Author",
    isbn: `${bookIsbnPrefix}-1`,
    genre: "Technology",
    language: "English",
    availableCopies: 1,
  });

  const book2 = await createBook(adminToken, {
    title: "R2 Smoke Book 2",
    author: "Smoke Author",
    isbn: `${bookIsbnPrefix}-2`,
    genre: "Technology",
    language: "English",
    availableCopies: 1,
  });

  const book3 = await createBook(adminToken, {
    title: "R2 Smoke Book 3",
    author: "Smoke Author",
    isbn: `${bookIsbnPrefix}-3`,
    genre: "Technology",
    language: "English",
    availableCopies: 1,
  });

  const loanStartTime = Date.now();

  const createLoan1 = await request("/api/loans", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bookId: book1.id,
    }),
  });
  assert.equal(createLoan1.response.status, 200);
  const dueDate1 = parseDateTime(createLoan1.body.data.dueDate);
  assert.ok(dueDate1 instanceof Date);
  assert.ok(!Number.isNaN(dueDate1.getTime()));
  const loan1DiffDays = (dueDate1.getTime() - loanStartTime) / ONE_DAY_MS;
  assert.ok(loan1DiffDays >= 1.7 && loan1DiffDays <= 2.3);

  const createLoan2 = await request("/api/loans", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bookId: book2.id,
    }),
  });
  assert.equal(createLoan2.response.status, 200);

  const createLoanExceed = await request("/api/loans", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bookId: book3.id,
    }),
  });
  assert.equal(createLoanExceed.response.status, 400);
  assert.equal(createLoanExceed.body.message, "You have reached the borrowing limit (2 books). Please return some books before borrowing more.");

  const loanIdForFine = createLoan1.body.data.loanId;
  const overdueDueDate = new Date(Date.now() - 2 * ONE_DAY_MS + 1000);
  await prisma.loan.update({
    where: { id: loanIdForFine },
    data: { dueDate: overdueDueDate },
  });

  const returnOverdueLoan = await request(`/api/loans/${loanIdForFine}/return`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
    },
  });
  assert.equal(returnOverdueLoan.response.status, 200);
  assert.ok(Math.abs(returnOverdueLoan.body.data.fineAmount - 2.5) < 1e-6);

  const fromTime = formatDateTime(new Date(Date.now() - 60 * 60 * 1000));
  const toTime = formatDateTime(new Date(Date.now() + 60 * 60 * 1000));
  const listAuditLogs = await request(
    `/api/admin/audit-logs?page=1&size=20&operatorId=${adminUserId}&entity=Config&from=${encodeURIComponent(fromTime)}&to=${encodeURIComponent(toTime)}`,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    },
  );
  assert.equal(listAuditLogs.response.status, 200);
  assert.ok(Array.isArray(listAuditLogs.body.data.list));
  assert.ok(listAuditLogs.body.data.total >= 2);

  const actions = listAuditLogs.body.data.list.map((item) => item.action);
  assert.ok(actions.includes("ADMIN_UPDATE_BORROW_RULES"));
  assert.ok(actions.includes("ADMIN_UPDATE_FINE_RATE"));

  const borrowActionLogs = await request(
    "/api/admin/audit-logs?page=1&size=10&action=ADMIN_UPDATE_BORROW_RULES",
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    },
  );
  assert.equal(borrowActionLogs.response.status, 200);
  assert.ok(borrowActionLogs.body.data.list.length >= 1);
  assert.equal(borrowActionLogs.body.data.list[0].action, "ADMIN_UPDATE_BORROW_RULES");

  console.log("Admin Release2 smoke test passed.");
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(cleanup);
