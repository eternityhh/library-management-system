const assert = require("node:assert/strict");

const app = require("../server/app");
const prisma = require("../server/db/prisma");

let server;
let baseUrl;
let adminToken;
let studentToken;
let adminUserId;
const createdUserIds = [];
const uniqueSuffix = Date.now();

const studentEmail = `admin.r2.student.${uniqueSuffix}@example.com`;

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
      maxBorrowDays: 45,
      maxBorrowBooks: 10,
    }),
  });
  assert.equal(updateBorrowRulesByAdmin.response.status, 200);
  assert.equal(updateBorrowRulesByAdmin.body.data.borrowRules.maxBorrowDays, 45);
  assert.equal(updateBorrowRulesByAdmin.body.data.borrowRules.maxBorrowBooks, 10);

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
  assert.equal(getConfigAfterUpdates.body.data.borrowRules.maxBorrowDays, 45);
  assert.equal(getConfigAfterUpdates.body.data.borrowRules.maxBorrowBooks, 10);
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

  const fromTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const toTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
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
