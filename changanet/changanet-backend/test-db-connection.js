const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function test() {
  console.log("Testing DB...");
  console.log(await prisma.$queryRaw`SELECT 1`);
}
test();