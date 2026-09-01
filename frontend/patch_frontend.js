const fs = require('fs');
let content = fs.readFileSync('C:/Users/Biswanath Bag/OneDrive/Desktop/Hotel-ERP/frontend/src/components/workspaces/ProductionWorkspace.tsx', 'utf8');

const oldTableHead = `<thead className="bg-[#FAF8F5] text-[#707070] font-bold border-b border-[rgba(45,45,45,0.08)]">
                        <tr>
                          <th className="p-3">Raw Ingredient</th>
                          <th className="p-3 text-right">Required Qty</th>
                          <th className="p-3 text-right">Current Stock</th>
                          <th className="p-3 text-right">Unit Cost</th>
                          <th className="p-3 text-right">Total Cost</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>`;

const newTableHead = `<thead className="bg-[#FAF8F5] text-[#707070] font-bold border-b border-[rgba(45,45,45,0.08)]">
                        <tr>
                          <th className="p-3">Raw Ingredient</th>
                          <th className="p-3 text-right">Required Qty</th>
                          <th className="p-3 text-right">Available Stock</th>
                          <th className="p-3 text-left">FIFO Batches Used</th>
                          <th className="p-3 text-right">Estimated Cost</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>`;

const oldTableBody = `<tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                        {previewData.ingredients.map((ing) => (
                          <tr key={ing.rawItemId} className="hover:bg-[#FAF8F5]/50">
                            <td className="p-3 font-semibold text-[#1C1C1C]">
                              {ing.rawItemName} ({ing.rawItemCode})
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-[#1C1C1C]">
                              {Number(ing.standardRequiredQty || ing.requiredQty).toFixed(2)} {ing.unitSymbol}
                            </td>
                            <td className="p-3 text-right font-mono text-[#707070]">
                              {Number(ing.currentStockInKitchen || ing.availableQty).toFixed(2)} {ing.unitSymbol}
                            </td>
                            <td className="p-3 text-right font-mono font-semibold text-[#1C1C1C]">
                              \${Number(ing.unitCost).toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-mono font-semibold text-[#2E8B57]">
                              \${Number(ing.totalCost).toFixed(2)}
                            </td>
                            <td className="p-3">
                              {ing.isAvailable || ing.isSufficient ? (
                                <Badge variant="success">Available</Badge>
                              ) : (
                                <Badge variant="danger">
                                  Short: {Number(ing.shortageQty).toFixed(2)} {ing.unitSymbol}
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>`;

// Notice: In the old app, sometimes it uses standardRequiredQty, currentStockInKitchen, isAvailable
// In the current python response, it's required_qty, available_qty, is_sufficient
const newTableBody = `<tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                        {previewData.ingredients.map((ing: any) => (
                          <tr key={ing.rawItemId || ing.raw_item_id} className="hover:bg-[#FAF8F5]/50">
                            <td className="p-3 font-semibold text-[#1C1C1C]">
                              {ing.rawItemName || ing.item_name} ({ing.rawItemCode || ing.item_code})
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-[#1C1C1C]">
                              {Number(ing.standardRequiredQty || ing.required_qty).toFixed(2)} {ing.unitSymbol || ing.unit_symbol}
                            </td>
                            <td className="p-3 text-right font-mono text-[#707070]">
                              {Number(ing.currentStockInKitchen || ing.available_qty).toFixed(2)} {ing.unitSymbol || ing.unit_symbol}
                            </td>
                            <td className="p-3 text-left font-mono text-[10px] text-[#707070]">
                              {(ing.fifo_batches || []).map((b: string, i: number) => <div key={i}>{b}</div>)}
                              {(!ing.fifo_batches || ing.fifo_batches.length === 0) && "-"}
                            </td>
                            <td className="p-3 text-right font-mono font-semibold text-[#2E8B57]">
                              ₹{Number(ing.totalCost || ing.total_cost).toFixed(2)}
                            </td>
                            <td className="p-3">
                              {ing.isAvailable !== false && ing.is_sufficient !== false && ing.isSufficient !== false ? (
                                <Badge variant="success">Available</Badge>
                              ) : (
                                <Badge variant="danger">
                                  Short: {Number(ing.shortageQty || ing.shortage_qty).toFixed(2)} {ing.unitSymbol || ing.unit_symbol}
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>`;

if(content.includes('Current Stock')) {
    content = content.replace(oldTableHead, newTableHead);
    // Replace table body. Since there might be some differences in field names from the exact old text, I'll do a rough replace.
    const bodyStart = content.indexOf('<tbody className="divide-y divide-[rgba(45,45,45,0.06)]">');
    const bodyEnd = content.indexOf('</tbody>', bodyStart) + 8;
    content = content.substring(0, bodyStart) + newTableBody + content.substring(bodyEnd);
    fs.writeFileSync('C:/Users/Biswanath Bag/OneDrive/Desktop/Hotel-ERP/frontend/src/components/workspaces/ProductionWorkspace.tsx', content);
    console.log('Patched ProductionWorkspace.tsx');
} else {
    console.log('Could not find Current Stock');
}
