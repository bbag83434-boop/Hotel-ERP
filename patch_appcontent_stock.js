const fs = require('fs');
let content = fs.readFileSync('C:/Users/Biswanath Bag/OneDrive/Desktop/Hotel-ERP/frontend/src/app/AppContent.tsx', 'utf8');

const targetStr = `          {!isManagement &&
            activeWorkspace !== 'purchase' &&
            activeWorkspace !== 'kitchenOrders' && (`;

const replaceStr = `          {!isManagement &&
            activeWorkspace !== 'purchase' &&
            activeWorkspace !== 'kitchenOrders' &&
            activeWorkspace !== 'inventory' && (`;

content = content.replace(targetStr, replaceStr);

const pTargetStr = `As an outlet user you can access
                    Purchase / Needs, Receiving, My Bills and Kitchen Orders.`;

const pReplaceStr = `As an outlet user you can access
                    Purchase / Needs, Receiving, My Bills, Kitchen Orders and Stock.`;

content = content.replace(pTargetStr, pReplaceStr);

fs.writeFileSync('C:/Users/Biswanath Bag/OneDrive/Desktop/Hotel-ERP/frontend/src/app/AppContent.tsx', content);
console.log('Successfully added inventory exception in AppContent.');
