const prisma = require("../server/db/prisma");

const TARGET_EMAIL = "Jane@gmail.com";
const TARGET_TITLES = ["The Great Gatsby"];

const checkoutDate = new Date("2026-03-01T00:00:00+08:00");
const dueDate = new Date("2026-03-31T00:00:00+08:00");

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new Error(`User not found: ${TARGET_EMAIL}`);
  }

  const loans = await prisma.loan.findMany({
    where: {
      userId: user.id,
      returnDate: null,
      book: {
        title: {
          in: TARGET_TITLES,
        },
      },
    },
    include: {
      book: {
        select: {
          title: true,
        },
      },
    },
  });

  if (loans.length !== TARGET_TITLES.length) {
    throw new Error(
      `Expected ${TARGET_TITLES.length} active loans, found ${loans.length}.`,
    );
  }

  const updatedLoans = [];
  for (const loan of loans) {
    const updatedLoan = await prisma.loan.update({
      where: { id: loan.id },
      data: {
        checkoutDate,
        dueDate,
      },
      select: {
        id: true,
        checkoutDate: true,
        dueDate: true,
        status: true,
        user: {
          select: {
            email: true,
          },
        },
        book: {
          select: {
            title: true,
          },
        },
      },
    });

    updatedLoans.push(updatedLoan);
  }

  console.log(
    JSON.stringify(
      {
        updatedCount: updatedLoans.length,
        checkoutDate,
        dueDate,
        loans: updatedLoans,
      },
      null,
      2,
    ),
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
