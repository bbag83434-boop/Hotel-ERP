const fs = require('fs');
let content = fs.readFileSync('C:/Users/Biswanath Bag/OneDrive/Desktop/Hotel-ERP/frontend/src/components/workspaces/RecipeManager.tsx', 'utf8');

const marginText = `                      <span className="text-[10px] text-[#707070] block">
                        Margin
                      </span>
                      <b
                        className={margin > 0 ? "text-[#2E8B57]" : "text-red-600"}
                      >
                        ₹{margin.toFixed(2)} ({marginPct}%)
                      </b>
                    </div>`;

const newMarginText = `                      <span className="text-[10px] text-[#707070] block">
                        Margin
                      </span>
                      <div className="flex items-center justify-center gap-1">
                        <b className={margin > 0 ? "text-[#2E8B57]" : "text-red-600"}>
                          ₹{margin.toFixed(2)} ({marginPct}%)
                        </b>
                        {sp > 0 && margin/sp < 0.20 && (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500" title="Low Margin Warning (< 20%)" />
                        )}
                      </div>
                    </div>`;

if(content.includes('Margin')) {
    content = content.replace(marginText, newMarginText);
    fs.writeFileSync('C:/Users/Biswanath Bag/OneDrive/Desktop/Hotel-ERP/frontend/src/components/workspaces/RecipeManager.tsx', content);
    console.log('Patched RecipeManager margin warning');
}
