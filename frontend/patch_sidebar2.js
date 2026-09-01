const fs = require('fs');
let content = fs.readFileSync('C:/Users/Biswanath Bag/OneDrive/Desktop/Hotel-ERP/frontend/src/components/common/Sidebar.tsx', 'utf8');

// Fix the Dashboard label
content = content.replace(
  "{ id: 'dashboard' as WorkspaceId, label: 'Executive Dashboard', icon: LayoutDashboard, badge: null }",
  "{ id: 'dashboard' as WorkspaceId, label: isAdmin && (!activeOutlet?.id || isHeadOffice) ? 'Executive Dashboard' : 'Outlet Dashboard', icon: LayoutDashboard, badge: null }"
);

// Inject the button after the Active Scope Card
const splitText = "<span>{isHeadOffice ? 'Head Office Scope' : activeOutlet?.id ? 'Restricted Outlet' : 'Select Branch Above'}</span>";
const parts = content.split(splitText);
if (parts.length === 2) {
  const insertIndex = parts[1].indexOf('</div>') + 6;
  const newButton = `
          {isAdmin && activeOutlet?.id && !isHeadOffice && (
            <button
              type="button"
              onClick={() => {
                if (typeof setActiveOutlet === 'function') {
                    setActiveOutlet({
                      id: '',
                      code: '',
                      name: 'Select Branch / Outlet',
                      type: 'RESTAURANT_OUTLET',
                      isActive: true,
                    });
                }
                setActiveWorkspace('dashboard');
              }}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#1C1C1C] text-white text-[11px] font-bold rounded-lg hover:bg-black transition-colors shadow-sm"
            >
              <LayoutDashboard className="w-3 h-3" />
              Return to Admin Dashboard
            </button>
          )}`;
  
  content = parts[0] + splitText + parts[1].slice(0, insertIndex) + newButton + parts[1].slice(insertIndex);
  
  // Make sure setActiveOutlet is destructured
  if (content.includes('const { activeOutlet, isHeadOffice } = useOutlet();')) {
      content = content.replace('const { activeOutlet, isHeadOffice } = useOutlet();', 'const { activeOutlet, isHeadOffice, setActiveOutlet } = useOutlet();');
  }
  
  fs.writeFileSync('C:/Users/Biswanath Bag/OneDrive/Desktop/Hotel-ERP/frontend/src/components/common/Sidebar.tsx', content);
  console.log('Successfully injected button and fixed label.');
} else {
  console.log('Failed to find split point.');
}
