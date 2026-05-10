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

const studentEmail = `admin.r1.student.${uniqueSuffix}@example.com`;
const librarianEmail1 = `admin.r1.librarian1.${uniqueSuffix}@example.com`;
const librarianEmail2 = `admin.r1.librarian2.${uniqueSuffix}@example.com`;
const librarianUpdatedEmail1 = `admin.r1.librarian1.updated.${uniqueSuffix}@example.com`;

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
  assert.equal(adminLoginResult.body.message, "登录成功");
  assert.equal(adminLoginResult.body.data.role, "ADMIN");
  assert.ok(adminLoginResult.body.data.token);
  adminToken = adminLoginResult.body.data.token;
  adminUserId = adminLoginResult.body.data.userId;

  const registerStudentResult = await request("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Admin Smoke Student",
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
  studentToken = studentLoginResult.body.data.token;

  const forbiddenAdminAccess = await request("/api/admin/users?page=1&size=10", {
    headers: {
      Authorization: `Bearer ${studentToken}`,
    },
  });
  assert.equal(forbiddenAdminAccess.response.status, 403);

  const createLibrarian1 = await request("/api/admin/librarians", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Admin Smoke Librarian 1",
      email: librarianEmail1,
      password: "Lib123456",
      staffId: `L${uniqueSuffix}01`,
    }),
  });
  assert.equal(createLibrarian1.response.status, 200);
  assert.equal(createLibrarian1.body.data.role, "LIBRARIAN");
  assert.equal(createLibrarian1.body.data.email, librarianEmail1);
  const librarian1Id = createLibrarian1.body.data.id;
  createdUserIds.push(librarian1Id);

  const createLibrarian2 = await request("/api/admin/librarians", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Admin Smoke Librarian 2",
      email: librarianEmail2,
      password: "Lib123456",
      staffId: `L${uniqueSuffix}02`,
    }),
  });
  assert.equal(createLibrarian2.response.status, 200);
  const librarian2Id = createLibrarian2.body.data.id;
  createdUserIds.push(librarian2Id);

  const createLibrarianDuplicateEmail = await request("/api/admin/librarians", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Admin Smoke Librarian Duplicate",
      email: librarianEmail1,
      password: "Lib123456",
      staffId: `L${uniqueSuffix}03`,
    }),
  });
  assert.equal(createLibrarianDuplicateEmail.response.status, 400);

  const listLibrarians = await request(
    `/api/admin/librarians?page=1&size=10&keyword=${encodeURIComponent(`L${uniqueSuffix}01`)}`,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    },
  );
  assert.equal(listLibrarians.response.status, 200);
  assert.ok(listLibrarians.body.data.list.some((item) => item.id === librarian1Id));

  const detailLibrarian = await request(`/api/admin/librarians/${librarian1Id}`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(detailLibrarian.response.status, 200);
  assert.equal(detailLibrarian.body.data.id, librarian1Id);

  const updateLibrarian = await request(`/api/admin/librarians/${librarian1Id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: librarianUpdatedEmail1,
      staffId: `L${uniqueSuffix}11`,
    }),
  });
  assert.equal(updateLibrarian.response.status, 200);
  assert.equal(updateLibrarian.body.data.email, librarianUpdatedEmail1);

  const updateLibrarianStaffConflict = await request(`/api/admin/librarians/${librarian1Id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      staffId: `L${uniqueSuffix}02`,
    }),
  });
  assert.equal(updateLibrarianStaffConflict.response.status, 400);

  const deleteLibrarian = await request(`/api/admin/librarians/${librarian2Id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(deleteLibrarian.response.status, 200);
  assert.equal(deleteLibrarian.body.data, null);

  const deletedLibrarianDetail = await request(`/api/admin/librarians/${librarian2Id}`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(deletedLibrarianDetail.response.status, 404);

  const listUsers = await request(
    `/api/admin/users?page=1&size=10&role=STUDENT&keyword=${encodeURIComponent("Admin Smoke")}`,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    },
  );
  assert.equal(listUsers.response.status, 200);
  assert.ok(listUsers.body.data.list.some((item) => item.id === studentUserId));

  const updateUserRole = await request(`/api/admin/users/${studentUserId}/role`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: "LIBRARIAN",
    }),
  });
  assert.equal(updateUserRole.response.status, 200);
  assert.equal(updateUserRole.body.data.role, "LIBRARIAN");

  const updateSelfRole = await request(`/api/admin/users/${adminUserId}/role`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: "STUDENT",
    }),
  });
  assert.equal(updateSelfRole.response.status, 400);

  const resetPasswordResult = await request(`/api/admin/users/${studentUserId}/reset-password`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  assert.equal(resetPasswordResult.response.status, 200);
  assert.equal(resetPasswordResult.body.data.userId, studentUserId);
  assert.ok(resetPasswordResult.body.data.tempPassword);

  const reloginByTempPassword = await loginByEmail(
    studentEmail,
    resetPasswordResult.body.data.tempPassword,
  );
  assert.equal(reloginByTempPassword.response.status, 200);

  console.log("Admin Release1 smoke test passed.");
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(cleanup);
