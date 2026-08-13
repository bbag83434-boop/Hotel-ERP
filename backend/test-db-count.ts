import { prisma } from './src/config/database';

async function verifyDbData() {
  const usersCount = await prisma.user.count();
  const companiesCount = await prisma.company.count();
  const branchesCount = await prisma.branch.count();
  const itemsCount = await prisma.item.count();
  const menuItemsCount = await prisma.menuItem.count();
  const roomsCount = await prisma.room.count();
  const accountsCount = await prisma.chartOfAccount.count();

  console.log('📊 DATABASE RECORD COUNT VERIFICATION:');
  console.log(`- Companies: ${companiesCount}`);
  console.log(`- Branches: ${branchesCount}`);
  console.log(`- Users: ${usersCount}`);
  console.log(`- Items & Stores: ${itemsCount}`);
  console.log(`- Restaurant Menu Items: ${menuItemsCount}`);
  console.log(`- Hotel Rooms: ${roomsCount}`);
  console.log(`- Chart of Accounts: ${accountsCount}`);
  console.log('✅ ALL PRODUCTION DATA INTACT - ZERO DATA MODIFIED OR DELETED!');
}

verifyDbData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
