const fs = require('fs');
let content = fs.readFileSync('C:/Users/Biswanath Bag/OneDrive/Desktop/Hotel-ERP/frontend/src/components/common/Sidebar.tsx', 'utf8');

const targetStr = `    {
      label: 'Kitchen Orders',
      defaultOpen: true,
      items: [{ id: 'kitchenOrders', label: 'Kitchen Orders', icon: ChefHat, initialTab: undefined, badge: null }],
    },
  ];`;

const replaceStr = `    {
      label: 'Kitchen Orders',
      defaultOpen: true,
      items: [{ id: 'kitchenOrders', label: 'Kitchen Orders', icon: ChefHat, initialTab: undefined, badge: null }],
    },
    {
      label: 'Outlet Inventory',
      defaultOpen: true,
      items: [{ id: 'inventory', label: 'Stock', icon: Boxes, initialTab: undefined, badge: null }],
    },
  ];`;

content = content.replace(targetStr, replaceStr);

fs.writeFileSync('C:/Users/Biswanath Bag/OneDrive/Desktop/Hotel-ERP/frontend/src/components/common/Sidebar.tsx', content);
console.log('Successfully added Stock to Outlet sidebar.');
