import { Prisma, PrismaClient, UserRole, TableStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Dev-only password for seed user (change in production). */
const OWNER_PASSWORD = "ChangeMe123!";

async function main() {
  await prisma.refreshToken.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.table.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 12);

  await prisma.user.create({
    data: {
      email: "owner@example.com",
      passwordHash,
      name: "Demo Owner",
      role: UserRole.OWNER,
    },
  });

  const drinks = await prisma.menuCategory.create({
    data: { name: "เครื่องดื่ม", sortOrder: 1 },
  });
  const food = await prisma.menuCategory.create({
    data: { name: "อาหารจานหลัก", sortOrder: 2 },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        categoryId: drinks.id,
        name: "น้ำเปล่า",
        price: new Prisma.Decimal(20),
        isAvailable: true,
      },
      {
        categoryId: food.id,
        name: "ข้าวผัดกุ้ง",
        price: new Prisma.Decimal(120),
        isAvailable: true,
      },
    ],
  });

  await prisma.table.createMany({
    data: [
      { label: "โต๊ะ 1", status: TableStatus.OPEN },
      { label: "โต๊ะ 2", status: TableStatus.CLOSED },
    ],
  });

  console.log(`Seed OK. Login: owner@example.com / ${OWNER_PASSWORD}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
