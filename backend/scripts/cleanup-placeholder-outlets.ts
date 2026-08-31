import { prisma } from '../src/config/database';

async function cleanupPlaceholderOutlets() {
  console.log('🔍 Auditing database for placeholder outlet "Royal Rasoi" / "BR-REST-01"...');

  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) {
    console.log('No company found.');
    return;
  }

  const hotelBranch = await prisma.branch.findFirst({
    where: { companyId: company.id, code: 'BR-HOTEL-01' }
  });

  if (!hotelBranch) {
    throw new Error('Primary hotel branch BR-HOTEL-01 not found.');
  }

  const placeholderBranch = await prisma.branch.findFirst({
    where: {
      OR: [
        { code: 'BR-REST-01' },
        { name: { contains: 'Royal Rasoi', mode: 'insensitive' } }
      ]
    }
  });

  if (!placeholderBranch) {
    console.log('✅ No placeholder branch "BR-REST-01" / "Royal Rasoi" found in database.');
  } else {
    console.log(`Found placeholder branch: ${placeholderBranch.name} (${placeholderBranch.code}) [ID: ${placeholderBranch.id}]`);
    const pId = placeholderBranch.id;
    const hId = hotelBranch.id;

    // Reassign all foreign keys pointing to placeholder branch to primary hotel branch
    await prisma.warehouse.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.purchaseRequest.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.purchaseOrder.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.goodsReceiveNote.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.productionOrder.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.menu.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.diningTable.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.restaurantOrder.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.kitchenTicket.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.salesRecord.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.accountingEntryStub.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.floor.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.roomType.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.room.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.ratePlan.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.booking.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.housekeepingTask.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.maintenanceTicket.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.lostAndFound.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.nightAudit.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.chartOfAccount.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.journalEntry.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.accountsPayable.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.accountsReceivable.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.expenseEntry.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.department.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.employee.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.shift.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.leaveRequest.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.payrollRun.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.approvalRule.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.approvalRequest.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.systemSetting.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.notification.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.cashSession.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.stockCount.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.stockAdjustment.updateMany({ where: { branchId: pId }, data: { branchId: hId } });
    await prisma.onlineOrder.updateMany({ where: { branchId: pId }, data: { branchId: hId } });

    // Delete user assignments for the placeholder branch
    const deletedUserBranches = await prisma.userBranch.deleteMany({
      where: { branchId: pId }
    });
    console.log(`Deleted ${deletedUserBranches.count} user-branch link(s) for placeholder branch.`);

    // Delete the placeholder branch
    await prisma.branch.delete({
      where: { id: pId }
    });
    console.log('✅ Deleted placeholder branch "BR-REST-01" from database.');
  }

  // Update any warehouse or menu names that contain "Royal Rasoi"
  const renamedWh = await prisma.warehouse.updateMany({
    where: { name: { contains: 'Royal Rasoi', mode: 'insensitive' } },
    data: { name: 'Grand Heritage Kitchen Store' }
  });
  if (renamedWh.count > 0) {
    console.log(`Renamed ${renamedWh.count} warehouse(s) to "Grand Heritage Kitchen Store"`);
  }

  const renamedMenus = await prisma.menu.updateMany({
    where: { name: { contains: 'Royal Rasoi', mode: 'insensitive' } },
    data: { name: 'Grand Heritage Specialty Dining' }
  });
  if (renamedMenus.count > 0) {
    console.log(`Renamed ${renamedMenus.count} menu(s) to "Grand Heritage Specialty Dining"`);
  }

  // Verification Query
  console.log('\n--- VERIFICATION QUERY ---');
  const remainingBranches = await prisma.branch.count({
    where: {
      OR: [
        { code: 'BR-REST-01' },
        { name: { contains: 'Royal Rasoi', mode: 'insensitive' } }
      ]
    }
  });

  const remainingWh = await prisma.warehouse.count({
    where: { name: { contains: 'Royal Rasoi', mode: 'insensitive' } }
  });

  const remainingMenus = await prisma.menu.count({
    where: { name: { contains: 'Royal Rasoi', mode: 'insensitive' } }
  });

  console.log(`Remaining "Royal Rasoi" / "BR-REST-01" Branches: ${remainingBranches}`);
  console.log(`Remaining "Royal Rasoi" Warehouses: ${remainingWh}`);
  console.log(`Remaining "Royal Rasoi" Menus: ${remainingMenus}`);

  if (remainingBranches === 0 && remainingWh === 0 && remainingMenus === 0) {
    console.log('🎉 VERIFICATION PASSED: Zero placeholder references remain in the database!');
  } else {
    throw new Error('Verification failed: some placeholder references still exist in database');
  }
}

cleanupPlaceholderOutlets()
  .catch((err) => {
    console.error('Error during cleanup:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
