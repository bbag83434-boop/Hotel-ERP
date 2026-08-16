import { prisma } from './src/config/database';
import { RestaurantService } from './src/services/restaurant.service';

async function testPosSettlement() {
  console.log('🧪 Starting Restaurant POS Settlement Flow Audit...\n');

  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new Error('No active company found');

  const branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
  if (!branch) throw new Error('No branch found');

  const user = await prisma.user.findFirst({ where: { companyId: company.id } });
  if (!user) throw new Error('No user found');

  // 1. Get or create a sample menu item
  let menuItem = await prisma.menuItem.findFirst({
    where: { menu: { companyId: company.id } }
  });

  if (!menuItem) {
    let menu = await prisma.menu.findFirst({ where: { companyId: company.id } });
    if (!menu) {
      menu = await prisma.menu.create({
        data: {
          companyId: company.id,
          branchId: branch.id,
          name: 'Main Dining Menu',
          code: 'MAIN-MENU'
        }
      });
    }

    let category = await prisma.menuCategory.findFirst({ where: { menuId: menu.id } });
    if (!category) {
      category = await prisma.menuCategory.create({
        data: {
          menuId: menu.id,
          name: 'Signature Dishes',
          code: 'SIG-DISH'
        }
      });
    }

    menuItem = await prisma.menuItem.create({
      data: {
        menuId: menu.id,
        categoryId: category.id,
        name: 'Royal Paneer Butter Masala',
        code: 'R-PBM-01',
        price: 350.00,
        costPrice: 120.00,
        taxRate: 5.0,
        kitchenStation: 'MAIN_KITCHEN'
      }
    });
  }

  console.log(`✅ Using MenuItem: "${menuItem.name}" (Price: ₹${menuItem.price})`);

  // 2. Create POS Order
  console.log('\n--- Step 1: Create POS Order ---');
  const order = await RestaurantService.createOrder(
    company.id,
    branch.id,
    {
      branchId: branch.id,
      orderType: 'DINE_IN',
      guestCount: 2,
      customerName: 'Test Guest',
      items: [
        {
          menuItemId: menuItem.id,
          quantity: 2,
          notes: 'Medium spicy'
        }
      ]
    },
    user.id
  );

  console.log(`✅ Order Created: #${order.orderNumber} (ID: ${order.id})`);
  console.log(`   Subtotal:    ₹${order.subtotal}`);
  console.log(`   Tax (5%):    ₹${order.taxAmount}`);
  console.log(`   Grand Total: ₹${order.grandTotal}`);

  // 3. Test Checkout / Settlement via CASH
  console.log('\n--- Step 2: Test Settle Order via CASH (₹1000 tendered) ---');
  const settlementRes = await RestaurantService.completeOrderCheckout({
    companyId: company.id,
    orderId: order.id,
    paymentMethod: 'CASH',
    amount: order.grandTotal.toNumber(),
    receivedAmount: 1000,
    cashierId: user.id
  });

  console.log('✅ Settlement Succeeded:');
  console.log(`   Invoice Number: ${settlementRes.invoiceNumber}`);
  console.log(`   Payment Method: ${settlementRes.payment.method}`);
  console.log(`   Amount Paid:    ₹${settlementRes.payment.amount}`);
  console.log(`   Cash Received:  ₹${settlementRes.payment.receivedAmount}`);
  console.log(`   Change Due:     ₹${settlementRes.changeAmount}`);
  console.log(`   Sales Record:   ${settlementRes.salesRecord.id}`);

  // 4. Verify in DB
  const updatedOrder = await prisma.restaurantOrder.findUnique({ where: { id: order.id } });
  console.log(`   Final Order Status in DB: ${updatedOrder?.status}`);
  if (updatedOrder?.status !== 'COMPLETED') {
    throw new Error(`Expected order status COMPLETED, got ${updatedOrder?.status}`);
  }

  console.log('\n🎉 RESTAURANT POS SETTLEMENT FLOW AUDIT PASSED 100%!');
}

testPosSettlement()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ POS Settlement Test Failed:', err);
    process.exit(1);
  });
