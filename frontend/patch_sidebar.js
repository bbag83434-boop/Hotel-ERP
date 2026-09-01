const fs = require('fs');
let content = fs.readFileSync('C:/Users/Biswanath Bag/OneDrive/Desktop/Hotel-ERP/frontend/src/components/common/Sidebar.tsx', 'utf8');

const target = `          <span>{isHeadOffice ? 'Head Office Scope' : activeOutlet?.id ? 'Restricted Outlet' : 'Select Branch Above'}</span>
        </div>
      </div>`;

const replaceWith = `          <span>{isHeadOffice ? 'Head Office Scope' : activeOutlet?.id ? 'Restricted Outlet' : 'Select Branch Above'}</span>
        </div>
        
        {isAdmin && activeOutlet?.id && !isHeadOffice && (
          <button
            type="button"
            onClick={() => {
              setActiveOutlet({
                id: '',
                code: '',
                name: 'Select Branch / Outlet',
                type: 'RESTAURANT_OUTLET',
                isActive: true,
              });
              setActiveWorkspace('dashboard');
            }}
            className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#1C1C1C] text-white text-[10px] font-bold rounded-lg hover:bg-black transition-colors shadow-sm"
          >
            <LayoutDashboard className="w-3 h-3" />
            Admin Dashboard
          </button>
        )}
      </div>`;

content = content.replace(target, replaceWith);

// Ensure setActiveOutlet is destructured from useOutlet
if (content.includes('const { activeOutlet, isHeadOffice } = useOutlet();')) {
    content = content.replace('const { activeOutlet, isHeadOffice } = useOutlet();', 'const { activeOutlet, isHeadOffice, setActiveOutlet } = useOutlet();');
}

fs.writeFileSync('C:/Users/Biswanath Bag/OneDrive/Desktop/Hotel-ERP/frontend/src/components/common/Sidebar.tsx', content);
console.log('Successfully injected button.');
