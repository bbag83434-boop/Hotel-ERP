'use client';

import React, { useState, useEffect } from 'react';
import { useOutlet } from '@/context/OutletContext';
import { apiClient } from '@/api/client';
import {
  ChefHat,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Flame,
  Boxes,
  Percent,
} from 'lucide-react';

export const ProductionWorkspace: React.FC = () => {
  const { activeOutlet } = useOutlet();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/recipes', {
        params: { branch_id: activeOutlet.id },
      });
      if (res.data?.data) {
        setRecipes(res.data.data);
      } else if (Array.isArray(res.data)) {
        setRecipes(res.data);
      } else {
        setRecipes([]);
      }
    } catch (err: any) {
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, [activeOutlet.id]);

  const filtered = recipes.filter((r) =>
    (r.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.code || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-[#C79A3B]" />
              Recipes, Bill of Materials (BOM) & Production Engine
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] text-[#B8862D] font-bold border border-[rgba(45,45,45,0.1)]">
              [{activeOutlet.code}]
            </span>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Define standard ingredient recipes, yield metrics, and commissary batch production runs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRecipes}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[rgba(45,45,45,0.12)] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1C1C1C] transition-all shadow-sm active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C79A3B] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Active Recipes / BOM</span>
            <ChefHat className="w-4 h-4 text-[#C79A3B]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{recipes.length}</p>
          <p className="text-[10px] text-[#2E8B57] mt-1 font-medium">Standardized Multi-Outlet Menu</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Central Bakery Hub</span>
            <Flame className="w-4 h-4 text-[#D99625]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">DK-01 Kitchen</p>
          <p className="text-[10px] text-[#D99625] mt-1 font-medium">Dessert & Pastry Production</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm">
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Yield Control</span>
            <Percent className="w-4 h-4 text-[#2E8B57]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">Real-Time</p>
          <p className="text-[10px] text-[#707070] mt-1">Variance tracking on batch prep</p>
        </div>
      </div>

      {/* Recipe List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">Recipe & BOM Directory</h3>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
            <input
              type="text"
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 sm:w-64 pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C]"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[#707070] text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#C79A3B]" />
            <span>Loading recipe registry...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] text-xs text-[#707070] space-y-2">
            <ChefHat className="w-8 h-8 mx-auto text-[#C79A3B]/50" />
            <p className="font-semibold text-[#1C1C1C]">No custom recipes registered yet</p>
            <p className="max-w-md mx-auto">
              BOM recipes establish the theoretical consumption of ingredients per dish sold on POS.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((r, idx) => (
              <div
                key={r.id || idx}
                className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-[#1C1C1C]">{r.name}</h4>
                  <span className="text-[10px] font-mono text-[#B8862D] font-bold">[{r.code}]</span>
                </div>
                <p className="text-xs text-[#707070]">{r.description || 'Standard dish preparation recipe'}</p>
                <div className="text-[10px] text-[#707070] pt-1 border-t border-[rgba(45,45,45,0.06)] flex items-center justify-between">
                  <span>Portion Size: {r.yield_quantity || 1} Servings</span>
                  <span className="text-[#2E8B57] font-semibold">Active BOM</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductionWorkspace;
