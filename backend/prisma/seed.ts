import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed (India Hospitality Edition)...');

  // 1. Core Permissions
  const permissionsData = [
    { code: 'dashboard:view', module: 'DASHBOARD', action: 'READ', description: 'View dashboard metrics' },
    { code: 'company:read', module: 'COMPANY', action: 'READ', description: 'View company info' },
    { code: 'company:manage', module: 'COMPANY', action: 'MANAGE', description: 'Manage company settings' },
    { code: 'branch:read', module: 'BRANCH', action: 'READ', description: 'View branches' },
    { code: 'branch:manage', module: 'BRANCH', action: 'MANAGE', description: 'Manage branches' },
    { code: 'users:read', module: 'USERS', action: 'READ', description: 'View users' },
    { code: 'users:manage', module: 'USERS', action: 'MANAGE', description: 'Create and update users' },
    { code: 'roles:read', module: 'ROLES', action: 'READ', description: 'View roles and permissions' },
    { code: 'roles:manage', module: 'ROLES', action: 'MANAGE', description: 'Manage roles and permissions' },
    { code: 'audit:read', module: 'AUDIT', action: 'READ', description: 'View audit logs' },
    // Inventory, Purchasing, Production Permissions
    { code: 'inventory:read', module: 'INVENTORY', action: 'READ', description: 'View items and stock balances' },
    { code: 'inventory:manage', module: 'INVENTORY', action: 'MANAGE', description: 'Create/edit items and transfer stock' },
    { code: 'purchase:read', module: 'PURCHASE', action: 'READ', description: 'View purchase requests, orders, and GRNs' },
    { code: 'purchase:manage', module: 'PURCHASE', action: 'MANAGE', description: 'Create and approve purchase orders and GRNs' },
    { code: 'production:read', module: 'PRODUCTION', action: 'READ', description: 'View recipes and production orders' },
    { code: 'production:manage', module: 'PRODUCTION', action: 'MANAGE', description: 'Build recipes and execute production orders' },
    { code: 'warehouse:read', module: 'WAREHOUSE', action: 'READ', description: 'View warehouse list' },
    { code: 'warehouse:manage', module: 'WAREHOUSE', action: 'MANAGE', description: 'Manage warehouses' },
    // Restaurant POS & Operations Permissions
    { code: 'pos:read', module: 'POS', action: 'READ', description: 'View POS terminal and orders' },
    { code: 'pos:manage', module: 'POS', action: 'MANAGE', description: 'Create orders and process POS settlements' },
    { code: 'tables:read', module: 'TABLES', action: 'READ', description: 'View table floor plan' },
    { code: 'tables:manage', module: 'TABLES', action: 'MANAGE', description: 'Create and manage dining tables' },
    { code: 'kds:read', module: 'KDS', action: 'READ', description: 'View kitchen display system' },
    { code: 'kds:manage', module: 'KDS', action: 'MANAGE', description: 'Update kitchen ticket status' },
    { code: 'menu:read', module: 'MENU', action: 'READ', description: 'View restaurant menus and items' },
    { code: 'menu:manage', module: 'MENU', action: 'MANAGE', description: 'Manage menu items and pricing' },
    { code: 'sales:read', module: 'SALES', action: 'READ', description: 'View sales reports and revenue analytics' },
    // Hotel PMS & Front Desk Permissions
    { code: 'hotel:read', module: 'HOTEL', action: 'READ', description: 'View rooms, guests, and hotel bookings' },
    { code: 'hotel:manage', module: 'HOTEL', action: 'MANAGE', description: 'Manage check-in, check-out, night audit, and housekeeping' },
    // Accounting & Finance Permissions
    { code: 'accounting:read', module: 'ACCOUNTING', action: 'READ', description: 'View General Ledger, Chart of Accounts, and P&L' },
    { code: 'accounting:manage', module: 'ACCOUNTING', action: 'MANAGE', description: 'Post journal entries, manage accounts, AP/AR, and expenses' },
    // HR & Payroll Permissions
    { code: 'hr:read', module: 'HR', action: 'READ', description: 'View employees, attendance, and departments' },
    { code: 'hr:manage', module: 'HR', action: 'MANAGE', description: 'Manage employee profiles, shifts, and leaves' },
    { code: 'payroll:read', module: 'PAYROLL', action: 'READ', description: 'View payroll runs and payslips' },
    { code: 'payroll:manage', module: 'PAYROLL', action: 'MANAGE', description: 'Process and disburse payroll' },
    // Approval Center Permissions
    { code: 'approval:read', module: 'APPROVAL', action: 'READ', description: 'View pending approvals inbox' },
    { code: 'approval:manage', module: 'APPROVAL', action: 'MANAGE', description: 'Approve or reject requests and configure rules' },
    // Unified Analytics & AI Assistant
    { code: 'analytics:read', module: 'ANALYTICS', action: 'READ', description: 'View executive cross-module analytics' },
    { code: 'ai:chat', module: 'AI', action: 'READ', description: 'Access enterprise AI Assistant' }
  ];

  const permissions: Record<string, string> = {};
  for (const permData of permissionsData) {
    const perm = await prisma.permission.upsert({
      where: { code: permData.code },
      update: {},
      create: permData
    });
    permissions[permData.code] = perm.id;
  }
  console.log(`✅ Upserted ${Object.keys(permissions).length} permissions`);

  // 2. Core Roles
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {},
    create: {
      name: 'SUPER_ADMIN',
      description: 'System Super Administrator with full unrestricted access',
      isSystem: true
    }
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Company Admin with full business access',
      isSystem: true
    }
  });

  const managerRole = await prisma.role.upsert({
    where: { name: 'MANAGER' },
    update: {},
    create: {
      name: 'MANAGER',
      description: 'Branch Operational Manager',
      isSystem: true
    }
  });

  // Assign all permissions to SUPER_ADMIN, ADMIN, and MANAGER
  const allPermissionIds = Object.values(permissions);
  for (const permId of allPermissionIds) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: permId } },
      update: {},
      create: { roleId: superAdminRole.id, permissionId: permId }
    });

    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permId } },
      update: {},
      create: { roleId: adminRole.id, permissionId: permId }
    });

    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: managerRole.id, permissionId: permId } },
      update: {},
      create: { roleId: managerRole.id, permissionId: permId }
    });
  }
  console.log('✅ Created roles & permissions mappings');

  // 3. Default Indian Company
  const company = await prisma.company.upsert({
    where: { code: 'COMP-001' },
    update: {
      name: 'Grand Heritage Hospitality Ltd',
      email: 'contact@grandheritage.in',
      phone: '+91 98765 43210',
      address: 'Connaught Place, Central Delhi, New Delhi 110001 (GSTIN: 07AAAAA0000A1Z5)'
    },
    create: {
      name: 'Grand Heritage Hospitality Ltd',
      code: 'COMP-001',
      email: 'contact@grandheritage.in',
      phone: '+91 98765 43210',
      address: 'Connaught Place, Central Delhi, New Delhi 110001 (GSTIN: 07AAAAA0000A1Z5)'
    }
  });

  // 4. Default Property Branch
  const hotelBranch = await prisma.branch.upsert({
    where: { code: 'BR-HOTEL-01' },
    update: {
      name: 'Grand Heritage Resort & Palace',
      type: 'HYBRID',
      email: 'palace@grandheritage.in',
      phone: '+91 98765 43211',
      address: '12 Civil Lines, Jaipur, Rajasthan 302006'
    },
    create: {
      companyId: company.id,
      name: 'Grand Heritage Resort & Palace',
      code: 'BR-HOTEL-01',
      type: 'HYBRID',
      email: 'palace@grandheritage.in',
      phone: '+91 98765 43211',
      address: '12 Civil Lines, Jaipur, Rajasthan 302006'
    }
  });

  // 5. Default Super Admin User
  const passwordHash = await bcrypt.hash('Admin@123456', 12);
  const superAdminUser = await prisma.user.upsert({
    where: { email: 'admin@hotel-erp.com' },
    update: { companyId: company.id },
    create: {
      companyId: company.id,
      roleId: superAdminRole.id,
      email: 'admin@hotel-erp.com',
      username: 'admin',
      passwordHash,
      firstName: 'Super',
      lastName: 'Administrator',
      phone: '+91 98765 00001'
    }
  });

  await prisma.userBranch.upsert({
    where: { userId_branchId: { userId: superAdminUser.id, branchId: hotelBranch.id } },
    update: {},
    create: { userId: superAdminUser.id, branchId: hotelBranch.id, isDefault: true }
  });

  // 6. Categories
  const categoriesData = [
    { name: 'Fresh Vegetables & Produce', code: 'CAT-PRODUCE', description: 'Fresh vegetables, onions, tomatoes and greens' },
    { name: 'Dairy & Paneer Staples', code: 'CAT-DAIRY', description: 'Fresh Paneer, Amul Butter, Ghee, Milk & Cream' },
    { name: 'Grains, Spices & Dry Stores', code: 'CAT-DRY', description: 'Basmati Rice, Atta, MDH Spices, Pulses and Oils' },
    { name: 'Fresh Poultry & Meats', code: 'CAT-MEAT', description: 'Farm fresh chicken, mutton cuts and eggs' },
    { name: 'Kitchen Prepared Dishes', code: 'CAT-DISHES', description: 'Authentic Indian curries, tandoor breads and biryanis' }
  ];

  const categories: Record<string, string> = {};
  for (const cat of categoriesData) {
    const created = await prisma.category.upsert({
      where: { companyId_code: { companyId: company.id, code: cat.code } },
      update: { name: cat.name, description: cat.description },
      create: { companyId: company.id, ...cat }
    });
    categories[cat.code] = created.id;
  }

  // 7. Units of Measure
  const unitsData = [
    { name: 'Kilogram', symbol: 'kg' },
    { name: 'Gram', symbol: 'g' },
    { name: 'Liter', symbol: 'L' },
    { name: 'Milliliter', symbol: 'ml' },
    { name: 'Pieces / Portions', symbol: 'pcs' },
    { name: 'Box', symbol: 'box' }
  ];

  const units: Record<string, string> = {};
  for (const u of unitsData) {
    const created = await prisma.unit.upsert({
      where: { companyId_symbol: { companyId: company.id, symbol: u.symbol } },
      update: {},
      create: { companyId: company.id, ...u }
    });
    units[u.symbol] = created.id;
  }

  // 8. Warehouses / Stores
  const centralWh = await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: company.id, code: 'WH-CENTRAL' } },
    update: { name: 'Main Central Stores Hub' },
    create: {
      companyId: company.id,
      name: 'Main Central Stores Hub',
      code: 'WH-CENTRAL',
      isCentral: true,
      address: 'Central Stores Logistics Hub, Bay 1'
    }
  });

  const kitchenWh = await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: company.id, code: 'WH-KITCHEN-01' } },
    update: { name: 'Grand Heritage Kitchen Store', branchId: hotelBranch.id },
    create: {
      companyId: company.id,
      branchId: hotelBranch.id,
      name: 'Grand Heritage Kitchen Store',
      code: 'WH-KITCHEN-01',
      isCentral: false,
      address: 'Kitchen Cold Room & Dry Pantry'
    }
  });

  // 9. Indian Suppliers (GSTIN Registered)
  const supplier1 = await prisma.supplier.upsert({
    where: { companyId_code: { companyId: company.id, code: 'SUP-001' } },
    update: {
      name: 'Amul Dairy Distributors Ltd',
      contactPerson: 'Ramesh Patel',
      email: 'orders@amuldairy.in',
      phone: '+91 98250 12345',
      address: 'Anand Dairy Industrial Estate, Gujarat 388001',
      taxNumber: '24AAAAA0000A1Z5',
      paymentTerms: 'Net 15 Days'
    },
    create: {
      companyId: company.id,
      name: 'Amul Dairy Distributors Ltd',
      code: 'SUP-001',
      contactPerson: 'Ramesh Patel',
      email: 'orders@amuldairy.in',
      phone: '+91 98250 12345',
      address: 'Anand Dairy Industrial Estate, Gujarat 388001',
      taxNumber: '24AAAAA0000A1Z5',
      paymentTerms: 'Net 15 Days'
    }
  });

  // 10. Items Master (Raw Ingredients in INR)
  const rawItemsData = [
    {
      name: 'Fresh Malai Paneer',
      code: 'RM-PANEER-01',
      type: 'RAW_MATERIAL' as const,
      categoryId: categories['CAT-DAIRY'],
      unitId: units['kg'],
      costPrice: 320.0,
      sellingPrice: 0,
      minStockLevel: 10,
      reorderQty: 25
    },
    {
      name: 'Premium Basmati Rice',
      code: 'RM-RICE-01',
      type: 'RAW_MATERIAL' as const,
      categoryId: categories['CAT-DRY'],
      unitId: units['kg'],
      costPrice: 110.0,
      sellingPrice: 0,
      minStockLevel: 25,
      reorderQty: 50
    },
    {
      name: 'Amul Table Butter',
      code: 'RM-BUTTER-01',
      type: 'RAW_MATERIAL' as const,
      categoryId: categories['CAT-DAIRY'],
      unitId: units['kg'],
      costPrice: 480.0,
      sellingPrice: 0,
      minStockLevel: 8,
      reorderQty: 20
    },
    {
      name: 'MDH Shahi Garam Masala',
      code: 'RM-SPICE-01',
      type: 'RAW_MATERIAL' as const,
      categoryId: categories['CAT-DRY'],
      unitId: units['kg'],
      costPrice: 650.0,
      sellingPrice: 0,
      minStockLevel: 5,
      reorderQty: 10
    },
    {
      name: 'Farm Fresh Chicken Cuts',
      code: 'RM-CHICKEN-01',
      type: 'RAW_MATERIAL' as const,
      categoryId: categories['CAT-MEAT'],
      unitId: units['kg'],
      costPrice: 240.0,
      sellingPrice: 0,
      minStockLevel: 15,
      reorderQty: 30
    }
  ];

  const rawItems: Record<string, any> = {};
  for (const it of rawItemsData) {
    const created = await prisma.item.upsert({
      where: { companyId_code: { companyId: company.id, code: it.code } },
      update: { costPrice: new Prisma.Decimal(it.costPrice) },
      create: {
        companyId: company.id,
        name: it.name,
        code: it.code,
        type: it.type,
        categoryId: it.categoryId,
        unitId: it.unitId,
        costPrice: new Prisma.Decimal(it.costPrice),
        sellingPrice: new Prisma.Decimal(it.sellingPrice),
        minStockLevel: new Prisma.Decimal(it.minStockLevel),
        reorderQty: new Prisma.Decimal(it.reorderQty)
      }
    });
    rawItems[it.code] = created;
  }

  // Finished Goods in INR
  const shahiPaneerDish = await prisma.item.upsert({
    where: { companyId_code: { companyId: company.id, code: 'FG-PANEER-01' } },
    update: {
      name: 'Royal Shahi Paneer (Plate)',
      costPrice: new Prisma.Decimal(115.0),
      sellingPrice: new Prisma.Decimal(380.0)
    },
    create: {
      companyId: company.id,
      name: 'Royal Shahi Paneer (Plate)',
      code: 'FG-PANEER-01',
      type: 'FINISHED_GOOD',
      categoryId: categories['CAT-DISHES'],
      unitId: units['pcs'],
      costPrice: new Prisma.Decimal(115.0),
      sellingPrice: new Prisma.Decimal(380.0),
      minStockLevel: new Prisma.Decimal(5),
      reorderQty: new Prisma.Decimal(15)
    }
  });

  const butterChickenDish = await prisma.item.upsert({
    where: { companyId_code: { companyId: company.id, code: 'FG-BUTTERCHIK-01' } },
    update: {
      name: 'Mughlai Butter Chicken (350g)',
      costPrice: new Prisma.Decimal(145.0),
      sellingPrice: new Prisma.Decimal(460.0)
    },
    create: {
      companyId: company.id,
      name: 'Mughlai Butter Chicken (350g)',
      code: 'FG-BUTTERCHIK-01',
      type: 'FINISHED_GOOD',
      categoryId: categories['CAT-DISHES'],
      unitId: units['pcs'],
      costPrice: new Prisma.Decimal(145.0),
      sellingPrice: new Prisma.Decimal(460.0),
      minStockLevel: new Prisma.Decimal(5),
      reorderQty: new Prisma.Decimal(10)
    }
  });

  // 11. Initial Stock in Warehouses
  const initialStocks = [
    { wh: centralWh.id, item: rawItems['RM-PANEER-01'].id, qty: 50 },
    { wh: centralWh.id, item: rawItems['RM-RICE-01'].id, qty: 100 },
    { wh: centralWh.id, item: rawItems['RM-BUTTER-01'].id, qty: 30 },
    { wh: centralWh.id, item: rawItems['RM-SPICE-01'].id, qty: 20 },
    { wh: centralWh.id, item: rawItems['RM-CHICKEN-01'].id, qty: 40 },
    // Kitchen Store
    { wh: kitchenWh.id, item: rawItems['RM-PANEER-01'].id, qty: 20 },
    { wh: kitchenWh.id, item: rawItems['RM-RICE-01'].id, qty: 40 },
    { wh: kitchenWh.id, item: rawItems['RM-BUTTER-01'].id, qty: 15 },
    { wh: kitchenWh.id, item: rawItems['RM-SPICE-01'].id, qty: 10 },
    { wh: kitchenWh.id, item: rawItems['RM-CHICKEN-01'].id, qty: 25 },
    { wh: kitchenWh.id, item: shahiPaneerDish.id, qty: 10 }
  ];

  for (const st of initialStocks) {
    await prisma.stockBalance.upsert({
      where: { warehouseId_itemId: { warehouseId: st.wh, itemId: st.item } },
      update: { quantity: new Prisma.Decimal(st.qty) },
      create: {
        warehouseId: st.wh,
        itemId: st.item,
        quantity: new Prisma.Decimal(st.qty)
      }
    });
  }

  // 12. Recipe (Bill of Materials) for Shahi Paneer
  const paneerRecipe = await prisma.recipe.upsert({
    where: { companyId_code: { companyId: company.id, code: 'REC-PANEER-01' } },
    update: { name: 'Royal Shahi Paneer Special Recipe' },
    create: {
      companyId: company.id,
      finishedItemId: shahiPaneerDish.id,
      name: 'Royal Shahi Paneer Special Recipe',
      code: 'REC-PANEER-01',
      description: 'Rich creamy cashew-tomato gravy cooked with fresh malai paneer cubes and aromatic spices',
      yieldQty: new Prisma.Decimal(1),
      preparationMinutes: 15,
      instructions: '1. Sauté cashew & onion paste.\n2. Add tomato gravy and MDH spices.\n3. Add fresh paneer cubes.\n4. Finish with butter & cream.',
      ingredients: {
        create: [
          { rawItemId: rawItems['RM-PANEER-01'].id, quantity: new Prisma.Decimal(0.2), unitId: units['kg'] },
          { rawItemId: rawItems['RM-BUTTER-01'].id, quantity: new Prisma.Decimal(0.05), unitId: units['kg'] },
          { rawItemId: rawItems['RM-SPICE-01'].id, quantity: new Prisma.Decimal(0.02), unitId: units['kg'] }
        ]
      }
    }
  });

  // 13. RESTAURANT DINING TABLES
  const tablesData = [
    { tableNumber: 'T-01', name: 'Table 1', capacity: 2, section: 'Main AC Dining', status: 'AVAILABLE' as const },
    { tableNumber: 'T-02', name: 'Table 2', capacity: 4, section: 'Main AC Dining', status: 'AVAILABLE' as const },
    { tableNumber: 'T-03', name: 'Table 3', capacity: 4, section: 'Main AC Dining', status: 'AVAILABLE' as const },
    { tableNumber: 'T-04', name: 'Family Booth 4', capacity: 6, section: 'Main AC Dining', status: 'AVAILABLE' as const },
    { tableNumber: 'P-01', name: 'Garden Terrace 1', capacity: 4, section: 'Garden Terrace', status: 'AVAILABLE' as const },
    { tableNumber: 'VIP-01', name: 'Maharajah Private Dining', capacity: 12, section: 'VIP Banquet', status: 'AVAILABLE' as const }
  ];

  for (const t of tablesData) {
    await prisma.diningTable.upsert({
      where: { branchId_tableNumber: { branchId: restBranch.id, tableNumber: t.tableNumber } },
      update: {},
      create: {
        companyId: company.id,
        branchId: restBranch.id,
        tableNumber: t.tableNumber,
        name: t.name,
        capacity: t.capacity,
        section: t.section,
        status: t.status
      }
    });
  }

  // 14. RESTAURANT MASTER MENU & CATEGORIES
  const diningMenu = await prisma.menu.upsert({
    where: { companyId_code: { companyId: company.id, code: 'MENU-MAIN-01' } },
    update: { name: 'Grand Heritage Specialty Dining', branchId: hotelBranch.id },
    create: {
      companyId: company.id,
      branchId: hotelBranch.id,
      name: 'Grand Heritage Specialty Dining',
      code: 'MENU-MAIN-01',
      description: 'North Indian Curries, Mughlai Specialties, Tandoori Breads & Desserts'
    }
  });

  const catCurries = await prisma.menuCategory.upsert({
    where: { menuId_code: { menuId: diningMenu.id, code: 'MC-CURRIES' } },
    update: {},
    create: { menuId: diningMenu.id, name: 'Main Course Curries', code: 'MC-CURRIES', sortOrder: 1, icon: 'Flame' }
  });

  const catBreads = await prisma.menuCategory.upsert({
    where: { menuId_code: { menuId: diningMenu.id, code: 'MC-BREADS' } },
    update: {},
    create: { menuId: diningMenu.id, name: 'Tandoori Breads & Rice', code: 'MC-BREADS', sortOrder: 2, icon: 'Utensils' }
  });

  const catBeverages = await prisma.menuCategory.upsert({
    where: { menuId_code: { menuId: diningMenu.id, code: 'MC-BEVERAGES' } },
    update: {},
    create: { menuId: diningMenu.id, name: 'Beverages & Lassi', code: 'MC-BEVERAGES', sortOrder: 3, icon: 'GlassWater' }
  });

  // 15. MENU ITEMS LINKED TO RECIPES & FINISHED GOODS IN INR
  await prisma.menuItem.upsert({
    where: { companyId_code: { companyId: company.id, code: 'MI-SHAHI-PANEER' } },
    update: {
      name: 'Royal Shahi Paneer (Plate)',
      price: new Prisma.Decimal(380.0),
      costPrice: new Prisma.Decimal(115.0),
      taxRate: new Prisma.Decimal(5.0)
    },
    create: {
      companyId: company.id,
      menuId: diningMenu.id,
      categoryId: catCurries.id,
      finishedItemId: shahiPaneerDish.id,
      recipeId: paneerRecipe.id,
      name: 'Royal Shahi Paneer (Plate)',
      code: 'MI-SHAHI-PANEER',
      description: 'Soft cottage cheese simmered in rich makhani cashew gravy with butter & cream',
      price: new Prisma.Decimal(380.0),
      costPrice: new Prisma.Decimal(115.0),
      taxRate: new Prisma.Decimal(5.0),
      kitchenStation: 'MAIN_KITCHEN',
      preparationMinutes: 15
    }
  });

  await prisma.menuItem.upsert({
    where: { companyId_code: { companyId: company.id, code: 'MI-BUTTER-CHIK' } },
    update: {
      name: 'Mughlai Butter Chicken (350g)',
      price: new Prisma.Decimal(460.0),
      costPrice: new Prisma.Decimal(145.0),
      taxRate: new Prisma.Decimal(5.0)
    },
    create: {
      companyId: company.id,
      menuId: diningMenu.id,
      categoryId: catCurries.id,
      finishedItemId: butterChickenDish.id,
      name: 'Mughlai Butter Chicken (350g)',
      code: 'MI-BUTTER-CHIK',
      description: 'Tandoor roasted chicken chunks in rich spiced tomato & butter gravy',
      price: new Prisma.Decimal(460.0),
      costPrice: new Prisma.Decimal(145.0),
      taxRate: new Prisma.Decimal(5.0),
      kitchenStation: 'MAIN_KITCHEN',
      preparationMinutes: 20
    }
  });

  await prisma.menuItem.upsert({
    where: { companyId_code: { companyId: company.id, code: 'MI-BUTTER-NAAN' } },
    update: {
      name: 'Butter Garlic Naan',
      price: new Prisma.Decimal(65.0),
      costPrice: new Prisma.Decimal(18.0),
      taxRate: new Prisma.Decimal(5.0)
    },
    create: {
      companyId: company.id,
      menuId: diningMenu.id,
      categoryId: catBreads.id,
      name: 'Butter Garlic Naan',
      code: 'MI-BUTTER-NAAN',
      description: 'Clay tandoor baked leavened bread brushed with garlic & Amul butter',
      price: new Prisma.Decimal(65.0),
      costPrice: new Prisma.Decimal(18.0),
      taxRate: new Prisma.Decimal(5.0),
      kitchenStation: 'GRILL_STATION',
      preparationMinutes: 6
    }
  });

  await prisma.menuItem.upsert({
    where: { companyId_code: { companyId: company.id, code: 'MI-MANGO-LASSI' } },
    update: {
      name: 'Special Mango Lassi (400ml)',
      price: new Prisma.Decimal(120.0),
      costPrice: new Prisma.Decimal(35.0),
      taxRate: new Prisma.Decimal(5.0)
    },
    create: {
      companyId: company.id,
      menuId: diningMenu.id,
      categoryId: catBeverages.id,
      name: 'Special Mango Lassi (400ml)',
      code: 'MI-MANGO-LASSI',
      description: 'Chilled thick sweet curd beverage blended with Alphonso mango pulp',
      price: new Prisma.Decimal(120.0),
      costPrice: new Prisma.Decimal(35.0),
      taxRate: new Prisma.Decimal(5.0),
      kitchenStation: 'BAR',
      preparationMinutes: 3
    }
  });

  console.log('✅ Seeded Indian Restaurant Menu and Dishes in ₹');

  // ==========================================
  // 12. Standard Chart of Accounts (Double-Entry General Ledger with GST)
  // ==========================================
  const standardAccounts = [
    { code: '1010', name: 'Cash on Hand (Front Desk & POS Counter)', type: 'ASSET', subType: 'CURRENT_ASSET', balance: 50000 },
    { code: '1020', name: 'Operating Bank Account (HDFC Current A/c)', type: 'ASSET', subType: 'CURRENT_ASSET', balance: 450000 },
    { code: '1030', name: 'UPI & POS Card Clearing Account', type: 'ASSET', subType: 'CURRENT_ASSET', balance: 120000 },
    { code: '1040', name: 'Input GST Tax Credit (CGST + SGST + IGST)', type: 'ASSET', subType: 'CURRENT_ASSET', balance: 25000 },
    { code: '1200', name: 'Accounts Receivable - Hotel In-House Guests', type: 'ASSET', subType: 'CURRENT_ASSET', balance: 0 },
    { code: '1300', name: 'Food & Beverage Stores Inventory Asset', type: 'ASSET', subType: 'CURRENT_ASSET', balance: 180000 },
    { code: '1500', name: 'Hotel & Resort Property, Plant & Equipment', type: 'ASSET', subType: 'FIXED_ASSET', balance: 35000000 },
    { code: '2010', name: 'Accounts Payable - Vendors & Suppliers', type: 'LIABILITY', subType: 'CURRENT_LIABILITY', balance: 0 },
    { code: '2020', name: 'Output GST Tax Payable (CGST + SGST + IGST)', type: 'LIABILITY', subType: 'CURRENT_LIABILITY', balance: 0 },
    { code: '3010', name: 'Owner / Shareholder Equity Capital', type: 'EQUITY', subType: 'EQUITY_CAPITAL', balance: 25000000 },
    { code: '3020', name: 'Retained Earnings', type: 'EQUITY', subType: 'RETAINED_EARNINGS', balance: 10825000 },
    { code: '4010', name: 'Restaurant Food & Beverage Sales Revenue', type: 'REVENUE', subType: 'OPERATING_REVENUE', balance: 0 },
    { code: '4020', name: 'Hotel Room Accommodation Revenue', type: 'REVENUE', subType: 'OPERATING_REVENUE', balance: 0 },
    { code: '5010', name: 'Cost of Goods Sold - Food & Beverage (BOM)', type: 'EXPENSE', subType: 'COST_OF_GOODS_SOLD', balance: 0 },
    { code: '6010', name: 'Staff Salaries & Wages Expense', type: 'EXPENSE', subType: 'OPERATING_EXPENSE', balance: 0 },
    { code: '6020', name: 'Electricity, Gas & Water Utilities Expense', type: 'EXPENSE', subType: 'OPERATING_EXPENSE', balance: 0 },
    { code: '6030', name: 'Repairs & Property Maintenance Expense', type: 'EXPENSE', subType: 'OPERATING_EXPENSE', balance: 0 },
    { code: '6040', name: 'Housekeeping & Guest Amenities Expense', type: 'EXPENSE', subType: 'OPERATING_EXPENSE', balance: 0 }
  ];

  for (const acc of standardAccounts) {
    await prisma.chartOfAccount.upsert({
      where: { companyId_code: { companyId: company.id, code: acc.code } },
      update: { name: acc.name, balance: new Prisma.Decimal(acc.balance) },
      create: {
        companyId: company.id,
        code: acc.code,
        name: acc.name,
        type: acc.type as any,
        subType: acc.subType as any,
        balance: new Prisma.Decimal(acc.balance),
        isSystem: true
      }
    });
  }
  console.log(`✅ Seeded ${standardAccounts.length} Chart of Accounts in ₹`);

  // ==========================================
  // 13. Hotel PMS: Floors, Room Types & Rates in INR
  // ==========================================
  const floor1 = await prisma.floor.upsert({
    where: { branchId_floorNumber: { branchId: hotelBranch.id, floorNumber: 1 } },
    update: {},
    create: {
      companyId: company.id,
      branchId: hotelBranch.id,
      floorNumber: 1,
      name: 'Ground Level & Courtyard Wing',
      description: 'Garden and heritage fountain view rooms'
    }
  });

  const floor2 = await prisma.floor.upsert({
    where: { branchId_floorNumber: { branchId: hotelBranch.id, floorNumber: 2 } },
    update: {},
    create: {
      companyId: company.id,
      branchId: hotelBranch.id,
      floorNumber: 2,
      name: 'Second Floor Royal Heritage Wings',
      description: 'Palace view deluxe rooms'
    }
  });

  const floor3 = await prisma.floor.upsert({
    where: { branchId_floorNumber: { branchId: hotelBranch.id, floorNumber: 3 } },
    update: {},
    create: {
      companyId: company.id,
      branchId: hotelBranch.id,
      floorNumber: 3,
      name: 'Executive & Maharajah Suites',
      description: 'VIP luxury suites with private jacuzzi'
    }
  });

  const rtDeluxeKing = await prisma.roomType.upsert({
    where: { branchId_code: { branchId: hotelBranch.id, code: 'DLX-KNG' } },
    update: { baseRate: new Prisma.Decimal(4500.0) },
    create: {
      companyId: company.id,
      branchId: hotelBranch.id,
      name: 'Deluxe Heritage King Room',
      code: 'DLX-KNG',
      description: 'King bed with traditional Rajasthani decor, balcony, and modern marble bathroom',
      baseOccupancy: 2,
      maxOccupancy: 3,
      baseRate: new Prisma.Decimal(4500.0),
      amenities: 'High-speed WiFi, Balcony, Tea/Coffee Maker, Rain Shower, Smart TV'
    }
  });

  const rtExecSuite = await prisma.roomType.upsert({
    where: { branchId_code: { branchId: hotelBranch.id, code: 'EXE-SUT' } },
    update: { baseRate: new Prisma.Decimal(8500.0) },
    create: {
      companyId: company.id,
      branchId: hotelBranch.id,
      name: 'Grand Executive Royal Suite',
      code: 'EXE-SUT',
      description: 'Living room salon, luxury jacuzzi, complimentary breakfast & airport pick-up',
      baseOccupancy: 2,
      maxOccupancy: 4,
      baseRate: new Prisma.Decimal(8500.0),
      amenities: 'Jacuzzi, Living Room, 24/7 Butler, Free Airport Transfer, Welcome Drink'
    }
  });

  const rtStdTwin = await prisma.roomType.upsert({
    where: { branchId_code: { branchId: hotelBranch.id, code: 'STD-TWN' } },
    update: { baseRate: new Prisma.Decimal(3200.0) },
    create: {
      companyId: company.id,
      branchId: hotelBranch.id,
      name: 'Standard Heritage Twin Room',
      code: 'STD-TWN',
      description: 'Two twin beds with work desk and courtyard view',
      baseOccupancy: 2,
      maxOccupancy: 2,
      baseRate: new Prisma.Decimal(3200.0),
      amenities: 'Work Desk, High-speed WiFi, Tea/Coffee Maker, Safe Locker'
    }
  });

  // Rooms creation
  const seedRooms = [
    { floorId: floor1.id, roomTypeId: rtStdTwin.id, roomNumber: '101', status: 'AVAILABLE' },
    { floorId: floor1.id, roomTypeId: rtStdTwin.id, roomNumber: '102', status: 'AVAILABLE' },
    { floorId: floor1.id, roomTypeId: rtDeluxeKing.id, roomNumber: '103', status: 'AVAILABLE' },
    { floorId: floor2.id, roomTypeId: rtDeluxeKing.id, roomNumber: '201', status: 'AVAILABLE' },
    { floorId: floor2.id, roomTypeId: rtDeluxeKing.id, roomNumber: '202', status: 'AVAILABLE' },
    { floorId: floor2.id, roomTypeId: rtExecSuite.id, roomNumber: '205', status: 'AVAILABLE' },
    { floorId: floor3.id, roomTypeId: rtExecSuite.id, roomNumber: '301', status: 'AVAILABLE' },
    { floorId: floor3.id, roomTypeId: rtExecSuite.id, roomNumber: '302', status: 'AVAILABLE' }
  ];

  for (const r of seedRooms) {
    await prisma.room.upsert({
      where: { branchId_roomNumber: { branchId: hotelBranch.id, roomNumber: r.roomNumber } },
      update: {},
      create: {
        companyId: company.id,
        branchId: hotelBranch.id,
        floorId: r.floorId,
        roomTypeId: r.roomTypeId,
        roomNumber: r.roomNumber,
        status: r.status as any
      }
    });
  }

  // Seed VIP Indian Guest Profile
  await prisma.guestProfile.create({
    data: {
      companyId: company.id,
      firstName: 'Rajesh',
      lastName: 'Singhania',
      email: 'rajesh.singhania@corpindia.com',
      phone: '+91 98100 12345',
      idType: 'PASSPORT',
      idNumber: 'Z5849302',
      nationality: 'Indian',
      vipStatus: 'PLATINUM',
      preferences: 'High floor, feather pillows, green tea on arrival',
      notes: 'GSTIN: 07AAACS1234F1Z8 - Corporate billing client'
    }
  });

  console.log('✅ Seeded Hotel Floors, Room Types (in ₹), Rooms, and VIP Guest Profile');

  // ==========================================
  // 14. HR & PAYROLL SEEDING (Salaries in INR)
  // ==========================================
  const deptFrontOffice = await prisma.department.upsert({
    where: { companyId_code: { companyId: company.id, code: 'FO' } },
    update: {},
    create: { companyId: company.id, branchId: hotelBranch.id, code: 'FO', name: 'Front Office & Guest Experience' }
  });

  const deptFnB = await prisma.department.upsert({
    where: { companyId_code: { companyId: company.id, code: 'FNB' } },
    update: {},
    create: { companyId: company.id, branchId: restBranch.id, code: 'FNB', name: 'Food & Beverage / Restaurant' }
  });

  const deptAccounting = await prisma.department.upsert({
    where: { companyId_code: { companyId: company.id, code: 'ACC' } },
    update: {},
    create: { companyId: company.id, branchId: restBranch.id, code: 'ACC', name: 'Accounting & Financial Control' }
  });

  const shiftMorning = await prisma.shift.upsert({
    where: { id: 'shift-morn' },
    update: {},
    create: { id: 'shift-morn', companyId: company.id, branchId: hotelBranch.id, name: 'Morning Shift', code: 'MORN', startTime: '07:00', endTime: '15:30', gracePeriodMins: 15 }
  });

  const shiftEvening = await prisma.shift.upsert({
    where: { id: 'shift-eve' },
    update: {},
    create: { id: 'shift-eve', companyId: company.id, branchId: hotelBranch.id, name: 'Evening Shift', code: 'EVE', startTime: '15:00', endTime: '23:30', gracePeriodMins: 15 }
  });

  const leaveAnnual = await prisma.leaveType.upsert({
    where: { companyId_code: { companyId: company.id, code: 'AL' } },
    update: {},
    create: { companyId: company.id, code: 'AL', name: 'Annual Paid Leave', daysAllowed: 18, isPaid: true }
  });

  const leaveSick = await prisma.leaveType.upsert({
    where: { companyId_code: { companyId: company.id, code: 'SL' } },
    update: {},
    create: { companyId: company.id, code: 'SL', name: 'Medical / Sick Leave', daysAllowed: 12, isPaid: true }
  });

  const emp1 = await prisma.employee.upsert({
    where: { employeeCode: 'EMP-1001' },
    update: {
      firstName: 'Priya',
      lastName: 'Sharma',
      email: 'priya.s@grandheritage.in',
      phone: '+91 98765 11001',
      basicSalary: new Prisma.Decimal(45000.0),
      allowances: new Prisma.Decimal(5000.0)
    },
    create: {
      companyId: company.id,
      branchId: hotelBranch.id,
      departmentId: deptFrontOffice.id,
      employeeCode: 'EMP-1001',
      firstName: 'Priya',
      lastName: 'Sharma',
      email: 'priya.s@grandheritage.in',
      phone: '+91 98765 11001',
      designation: 'Front Desk Duty Manager',
      employmentType: 'FULL_TIME',
      basicSalary: new Prisma.Decimal(45000.0),
      allowances: new Prisma.Decimal(5000.0),
      status: 'ACTIVE'
    }
  });

  const emp2 = await prisma.employee.upsert({
    where: { employeeCode: 'EMP-1002' },
    update: {
      firstName: 'Chef Sanjeev',
      lastName: 'Kapoor',
      email: 'sanjeev.k@royalrasoi.in',
      phone: '+91 98765 11002',
      basicSalary: new Prisma.Decimal(65000.0),
      allowances: new Prisma.Decimal(8000.0)
    },
    create: {
      companyId: company.id,
      branchId: restBranch.id,
      departmentId: deptFnB.id,
      employeeCode: 'EMP-1002',
      firstName: 'Chef Sanjeev',
      lastName: 'Kapoor',
      email: 'sanjeev.k@royalrasoi.in',
      phone: '+91 98765 11002',
      designation: 'Executive Head Chef',
      employmentType: 'FULL_TIME',
      basicSalary: new Prisma.Decimal(65000.0),
      allowances: new Prisma.Decimal(8000.0),
      status: 'ACTIVE'
    }
  });

  console.log('✅ Seeded HR Departments, Shifts, Leave Types, and Staff with INR Salaries');

  // ==========================================
  // 15. APPROVAL CENTER RULES SEEDING (Amounts in INR)
  // ==========================================
  const approvalRules = [
    { transactionType: 'PURCHASE_REQUEST' as const, minAmount: new Prisma.Decimal(25000.0), requiredRole: 'MANAGER', stepNumber: 1 },
    { transactionType: 'PURCHASE_ORDER' as const, minAmount: new Prisma.Decimal(50000.0), requiredRole: 'SUPER_ADMIN', stepNumber: 1 },
    { transactionType: 'EXPENSE' as const, minAmount: new Prisma.Decimal(20000.0), requiredRole: 'SUPER_ADMIN', stepNumber: 1 },
    { transactionType: 'DISCOUNT' as const, minAmount: new Prisma.Decimal(2000.0), requiredRole: 'MANAGER', stepNumber: 1 },
    { transactionType: 'REFUND' as const, minAmount: new Prisma.Decimal(0.0), requiredRole: 'MANAGER', stepNumber: 1 }
  ];

  for (const ar of approvalRules) {
    await prisma.approvalRule.create({
      data: {
        companyId: company.id,
        branchId: restBranch.id,
        transactionType: ar.transactionType,
        minAmount: ar.minAmount,
        requiredRole: ar.requiredRole,
        stepNumber: ar.stepNumber,
        isActive: true
      }
    });
  }

  console.log('✅ Seeded Approval Rules with INR Thresholds');
  console.log('🌱 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
