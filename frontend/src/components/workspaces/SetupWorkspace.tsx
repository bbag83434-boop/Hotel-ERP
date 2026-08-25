'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { inventoryApi } from '@/api/inventory';
import { procurementApi } from '@/api/procurement';
import { Item, Category, Unit } from '@/types/inventory.types';
import { Supplier, SupplierItem } from '@/types/purchase.types';
import {
  SlidersHorizontal,
  Package,
  Building2,
  Tags,
  Layers,
  Plus,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  History,
  Boxes,
  Check,
  X,
  Lock,
} from 'lucide-react';
import ItemCreateModal from '../masters/ItemCreateModal';
import VendorCreateModal from '../masters/VendorCreateModal';
import CategoryCreateModal from '../masters/CategoryCreateModal';
import UnitCreateModal from '../masters/UnitCreateModal';

type TopTab = 'masters' | 'import_export' | 'activity_log';
type MasterSubTab = 'items' | 'vendors' | 'categories_units' | 'variant_groups' | 'order_templates';

export const SetupWorkspace: React.FC = () => {
  // Navigation State
  const [activeTopTab, setActiveTopTab] = useState<TopTab>('masters');
  const [activeSubTab, setActiveSubTab] = useState<MasterSubTab>('items');

  // Domain Data
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [vendorItems, setVendorItems] = useState<SupplierItem[]>([]);

  // UI State
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters
  const [itemSearch, setItemSearch] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [vendorSearch, setVendorSearch] = useState<string>('');

  // Modals
  const [showItemModal, setShowItemModal] = useState<boolean>(false);
  const [showVendorModal, setShowVendorModal] = useState<boolean>(false);
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [showUnitModal, setShowUnitModal] = useState<boolean>(false);

  // Data Loader
  const loadData = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [itemsData, catsData, unitsData, suppsData, vItemsData] = await Promise.all([
        inventoryApi.getItems().catch(() => []),
        inventoryApi.getCategories().catch(() => []),
        inventoryApi.getUnits().catch(() => []),
        procurementApi.getSuppliers().catch(() => []),
        procurementApi.getVendorItems().catch(() => []),
      ]);

      setItems(itemsData);
      setCategories(catsData);
      setUnits(unitsData);
      setSuppliers(suppsData);
      setVendorItems(vItemsData);
    } catch (err: any) {
      console.error('Failed to fetch setup master records:', err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to load master catalogue data from server.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Item vendor mapping lookup map: item_id -> default vendor name
  const itemVendorMap = useMemo(() => {
    const map = new Map<string, string>();
    // First pass for any mapping
    for (const vi of vendorItems) {
      if (vi.item_id && vi.supplier_name && !map.has(vi.item_id)) {
        map.set(vi.item_id, vi.supplier_name);
      }
    }
    // Second pass: override with preferred vendor if available
    for (const vi of vendorItems) {
      if (vi.item_id && vi.supplier_name && vi.is_preferred) {
        map.set(vi.item_id, vi.supplier_name);
      }
    }
    return map;
  }, [vendorItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
        item.code.toLowerCase().includes(itemSearch.toLowerCase()) ||
        (item.category_name || '').toLowerCase().includes(itemSearch.toLowerCase());
      const matchesCategory =
        selectedCategoryFilter === 'ALL' || item.category_id === selectedCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [items, itemSearch, selectedCategoryFilter]);

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((sup) => {
      const term = vendorSearch.toLowerCase();
      const contact = (sup.contactPerson || (sup as any).contact_person || '').toLowerCase();
      return (
        sup.name.toLowerCase().includes(term) ||
        sup.code.toLowerCase().includes(term) ||
        contact.includes(term) ||
        (sup.email || '').toLowerCase().includes(term) ||
        (sup.phone || '').toLowerCase().includes(term)
      );
    });
  }, [suppliers, vendorSearch]);

  // Helper formatting for item flags/types
  const renderItemTypeBadge = (type: string) => {
    switch (type) {
      case 'RAW_MATERIAL':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF8F5] text-[#707070] border border-[rgba(45,45,45,0.12)]">
            RAW MATERIAL
          </span>
        );
      case 'FINISHED_GOOD':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2E8B57]/10 text-[#2E8B57] border border-[#2E8B57]/30">
            FINISHED GOOD
          </span>
        );
      case 'SEMI_FINISHED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#3978B8]/10 text-[#3978B8] border border-[#3978B8]/30">
            PREP / SEMI
          </span>
        );
      case 'PACKAGING':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30">
            PACKAGING
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF8F5] text-[#707070] border border-[rgba(45,45,45,0.08)]">
            {type || 'ITEM'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-[#C79A3B]" />
            Setup & Masters
          </h2>
          <p className="text-xs text-[#707070] mt-0.5">
            Manage items, vendors, categories and units used across all outlets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-[rgba(45,45,45,0.12)] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1C1C1C] shadow-xs active:scale-95 disabled:opacity-60 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C79A3B] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-[#2E8B57]/10 border-[#2E8B57]/30 text-[#2E8B57]'
              : 'bg-[#D9534F]/10 border-[#D9534F]/30 text-[#D9534F]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-bold underline opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Top-Level Tabs (Masters | Import & export | Activity log) */}
      <div className="flex items-center border-b border-[rgba(45,45,45,0.08)] gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTopTab('masters')}
          className={`pb-3 px-1 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTopTab === 'masters'
              ? 'border-[#C79A3B] text-[#B8862D]'
              : 'border-transparent text-[#707070] hover:text-[#1C1C1C]'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Masters</span>
        </button>

        <button
          disabled
          className="pb-3 px-1 text-xs font-medium text-[#707070]/60 border-b-2 border-transparent flex items-center gap-1.5 whitespace-nowrap cursor-not-allowed opacity-75"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Import & export</span>
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#FAF8F5] text-[#707070] border border-[rgba(45,45,45,0.08)]">
            Coming soon
          </span>
        </button>

        <button
          disabled
          className="pb-3 px-1 text-xs font-medium text-[#707070]/60 border-b-2 border-transparent flex items-center gap-1.5 whitespace-nowrap cursor-not-allowed opacity-75"
        >
          <History className="w-4 h-4" />
          <span>Activity log</span>
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#FAF8F5] text-[#707070] border border-[rgba(45,45,45,0.08)]">
            Coming soon
          </span>
        </button>
      </div>

      {/* 3. Sub-Tabs inside Masters */}
      <div className="flex items-center border-b border-[rgba(45,45,45,0.06)] gap-4 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('items')}
          className={`pb-2 text-xs font-bold tracking-wide transition-all border-b-2 whitespace-nowrap ${
            activeSubTab === 'items'
              ? 'border-[#C79A3B] text-[#1C1C1C]'
              : 'border-transparent text-[#707070] hover:text-[#1C1C1C]'
          }`}
        >
          Items
        </button>

        <button
          onClick={() => setActiveSubTab('vendors')}
          className={`pb-2 text-xs font-bold tracking-wide transition-all border-b-2 whitespace-nowrap ${
            activeSubTab === 'vendors'
              ? 'border-[#C79A3B] text-[#1C1C1C]'
              : 'border-transparent text-[#707070] hover:text-[#1C1C1C]'
          }`}
        >
          Vendors
        </button>

        <button
          onClick={() => setActiveSubTab('categories_units')}
          className={`pb-2 text-xs font-bold tracking-wide transition-all border-b-2 whitespace-nowrap ${
            activeSubTab === 'categories_units'
              ? 'border-[#C79A3B] text-[#1C1C1C]'
              : 'border-transparent text-[#707070] hover:text-[#1C1C1C]'
          }`}
        >
          Categories & Units
        </button>

        <button
          disabled
          className="pb-2 text-xs font-medium text-[#707070]/60 border-b-2 border-transparent flex items-center gap-1.5 whitespace-nowrap cursor-not-allowed"
        >
          <span>Variant groups</span>
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#FAF8F5] text-[#707070] border border-[rgba(45,45,45,0.08)]">
            Coming soon
          </span>
        </button>

        <button
          disabled
          className="pb-2 text-xs font-medium text-[#707070]/60 border-b-2 border-transparent flex items-center gap-1.5 whitespace-nowrap cursor-not-allowed"
        >
          <span>Order templates</span>
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#FAF8F5] text-[#707070] border border-[rgba(45,45,45,0.08)]">
            Coming soon
          </span>
        </button>
      </div>

      {/* 4. SUB-TAB 1: Items */}
      {activeSubTab === 'items' && (
        <div className="space-y-4">
          {/* Controls Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 max-w-2xl">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
                <input
                  type="text"
                  placeholder="Search by code or name..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C] shadow-xs"
                />
              </div>

              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] text-[#1C1C1C] focus:outline-none focus:border-[#C79A3B] shadow-xs"
              >
                <option value="ALL">All categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowItemModal(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#C79A3B] to-[#B8862D] text-white text-xs font-bold shadow-md shadow-[#C79A3B]/20 hover:brightness-105 active:scale-95 transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>+ Item</span>
            </button>
          </div>

          {/* Item Count */}
          <div className="text-[11px] font-semibold text-[#707070]">
            {filteredItems.length.toLocaleString()} items
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[rgba(45,45,45,0.08)] bg-[#FAF8F5]/80 text-[#707070] uppercase font-bold text-[10px] tracking-wider">
                    <th className="py-3 px-4">CODE</th>
                    <th className="py-3 px-4">ITEM</th>
                    <th className="py-3 px-4">CATEGORY</th>
                    <th className="py-3 px-4">UNIT</th>
                    <th className="py-3 px-4">DEFAULT VENDOR</th>
                    <th className="py-3 px-4">FLAGS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                  {loading ? (
                    // Skeleton rows
                    Array.from({ length: 6 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td className="py-3.5 px-4">
                          <div className="h-3 w-16 bg-gray-200 rounded"></div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="h-3 w-36 bg-gray-200 rounded"></div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="h-3 w-20 bg-gray-200 rounded"></div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="h-3 w-10 bg-gray-200 rounded"></div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="h-3 w-28 bg-gray-200 rounded"></div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="h-4 w-20 bg-gray-200 rounded-full"></div>
                        </td>
                      </tr>
                    ))
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#707070]">
                        <div className="max-w-xs mx-auto space-y-2">
                          <Package className="w-8 h-8 text-[#C79A3B]/50 mx-auto" />
                          <p className="font-bold text-[#1C1C1C]">No items found</p>
                          <p className="text-[11px]">
                            {itemSearch || selectedCategoryFilter !== 'ALL'
                              ? 'Try clearing the search or category filter.'
                              : 'Get started by creating your first master inventory item.'}
                          </p>
                          {(itemSearch || selectedCategoryFilter !== 'ALL') && (
                            <button
                              onClick={() => {
                                setItemSearch('');
                                setSelectedCategoryFilter('ALL');
                              }}
                              className="text-xs font-bold text-[#B8862D] underline pt-1"
                            >
                              Clear filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((it) => {
                      const defaultVendor = itemVendorMap.get(it.id) || '—';
                      return (
                        <tr
                          key={it.id}
                          className="hover:bg-[#FAF8F5]/60 transition-colors duration-100"
                        >
                          <td className="py-3 px-4 font-mono font-bold text-[#B8862D]">
                            [{it.code}]
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-[#1C1C1C]">{it.name}</span>
                          </td>
                          <td className="py-3 px-4 text-[#707070]">
                            {it.category_name || '—'}
                          </td>
                          <td className="py-3 px-4 font-mono text-[#1C1C1C]">
                            {it.unit_symbol || '—'}
                          </td>
                          <td className="py-3 px-4 text-[#1C1C1C] font-medium">
                            {defaultVendor}
                          </td>
                          <td className="py-3 px-4">
                            {renderItemTypeBadge(it.type)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. SUB-TAB 2: Vendors */}
      {activeSubTab === 'vendors' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
              <input
                type="text"
                placeholder="Search vendors by name, code or contact..."
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C] shadow-xs"
              />
            </div>

            <button
              onClick={() => setShowVendorModal(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#C79A3B] to-[#B8862D] text-white text-xs font-bold shadow-md shadow-[#C79A3B]/20 hover:brightness-105 active:scale-95 transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>+ Vendor</span>
            </button>
          </div>

          {/* Count */}
          <div className="text-[11px] font-semibold text-[#707070]">
            {filteredSuppliers.length.toLocaleString()} vendors
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[rgba(45,45,45,0.08)] bg-[#FAF8F5]/80 text-[#707070] uppercase font-bold text-[10px] tracking-wider">
                    <th className="py-3 px-4">NAME</th>
                    <th className="py-3 px-4">CONTACT</th>
                    <th className="py-3 px-4">PHONE</th>
                    <th className="py-3 px-4">EMAIL</th>
                    <th className="py-3 px-4">ACTIVE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                  {loading ? (
                    // Skeleton
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td className="py-3.5 px-4">
                          <div className="h-3 w-32 bg-gray-200 rounded"></div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="h-3 w-24 bg-gray-200 rounded"></div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="h-3 w-24 bg-gray-200 rounded"></div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="h-3 w-32 bg-gray-200 rounded"></div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="h-4 w-12 bg-gray-200 rounded-full"></div>
                        </td>
                      </tr>
                    ))
                  ) : filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[#707070]">
                        <div className="max-w-xs mx-auto space-y-2">
                          <Building2 className="w-8 h-8 text-[#C79A3B]/50 mx-auto" />
                          <p className="font-bold text-[#1C1C1C]">No vendors found</p>
                          <p className="text-[11px]">
                            {vendorSearch
                              ? 'No suppliers match your current search.'
                              : 'Register your approved vendors to start tracking procurement.'}
                          </p>
                          {vendorSearch && (
                            <button
                              onClick={() => setVendorSearch('')}
                              className="text-xs font-bold text-[#B8862D] underline pt-1"
                            >
                              Clear search
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map((sup) => {
                      const contactPerson =
                        sup.contactPerson || (sup as any).contact_person || '—';
                      const isActive =
                        sup.isActive !== undefined ? sup.isActive : (sup as any).is_active ?? true;
                      return (
                        <tr
                          key={sup.id}
                          className="hover:bg-[#FAF8F5]/60 transition-colors duration-100"
                        >
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#1C1C1C] flex items-center gap-2">
                              <span>{sup.name}</span>
                              <span className="text-[10px] font-mono font-bold text-[#707070] bg-[#FAF8F5] px-1.5 py-0.2 rounded border border-[rgba(45,45,45,0.08)]">
                                {sup.code}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[#707070]">{contactPerson}</td>
                          <td className="py-3 px-4 font-mono text-[#1C1C1C]">
                            {sup.phone || (sup as any).whatsapp_number || '—'}
                          </td>
                          <td className="py-3 px-4 text-[#707070]">{sup.email || '—'}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isActive
                                  ? 'bg-[#2E8B57]/10 text-[#2E8B57] border border-[#2E8B57]/30'
                                  : 'bg-gray-100 text-gray-500 border border-gray-200'
                              }`}
                            >
                              {isActive ? (
                                <>
                                  <Check className="w-2.5 h-2.5" /> Yes
                                </>
                              ) : (
                                <>
                                  <X className="w-2.5 h-2.5" /> No
                                </>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. SUB-TAB 3: Categories & Units */}
      {activeSubTab === 'categories_units' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Categories Card */}
          <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[rgba(45,45,45,0.08)] flex items-center justify-between bg-[#FAF8F5]/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#F1E4C5] text-[#B8862D] flex items-center justify-center">
                  <Tags className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-[#1C1C1C] font-['Outfit']">
                    Material Categories
                  </h3>
                  <p className="text-[10px] text-[#707070]">{categories.length} registered</p>
                </div>
              </div>

              <button
                onClick={() => setShowCategoryModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] text-[#1C1C1C] text-xs font-bold hover:bg-[#FAF8F5] active:scale-95 shadow-xs transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-[#C79A3B]" />
                <span>+ Category</span>
              </button>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[rgba(45,45,45,0.06)] bg-[#FAF8F5]/80 text-[#707070] uppercase font-bold text-[10px] tracking-wider">
                    <th className="py-2.5 px-4">NAME</th>
                    <th className="py-2.5 px-4">CODE</th>
                    <th className="py-2.5 px-4">DESCRIPTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td className="py-3 px-4">
                          <div className="h-3 w-24 bg-gray-200 rounded"></div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="h-3 w-16 bg-gray-200 rounded"></div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="h-3 w-32 bg-gray-200 rounded"></div>
                        </td>
                      </tr>
                    ))
                  ) : categories.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-[#707070] text-xs">
                        No categories found. Click "+ Category" to add one.
                      </td>
                    </tr>
                  ) : (
                    categories.map((c) => (
                      <tr key={c.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-[#1C1C1C]">{c.name}</td>
                        <td className="py-3 px-4 font-mono text-[#B8862D] font-bold">[{c.code}]</td>
                        <td className="py-3 px-4 text-[#707070] text-[11px]">
                          {c.description || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Units of Measure Card */}
          <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[rgba(45,45,45,0.08)] flex items-center justify-between bg-[#FAF8F5]/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#3978B8]/10 text-[#3978B8] flex items-center justify-center">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-[#1C1C1C] font-['Outfit']">
                    Units of Measure
                  </h3>
                  <p className="text-[10px] text-[#707070]">{units.length} defined</p>
                </div>
              </div>

              <button
                onClick={() => setShowUnitModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#C79A3B] to-[#B8862D] text-white text-xs font-bold shadow-md shadow-[#C79A3B]/20 hover:brightness-105 active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Unit</span>
              </button>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[rgba(45,45,45,0.06)] bg-[#FAF8F5]/80 text-[#707070] uppercase font-bold text-[10px] tracking-wider">
                    <th className="py-2.5 px-4">NAME</th>
                    <th className="py-2.5 px-4">SYMBOL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td className="py-3 px-4">
                          <div className="h-3 w-28 bg-gray-200 rounded"></div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="h-3 w-12 bg-gray-200 rounded"></div>
                        </td>
                      </tr>
                    ))
                  ) : units.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-8 text-center text-[#707070] text-xs">
                        No units found. Click "+ Unit" to define one.
                      </td>
                    </tr>
                  ) : (
                    units.map((u) => (
                      <tr key={u.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-[#1C1C1C]">{u.name}</td>
                        <td className="py-3 px-4 font-mono font-bold text-[#3978B8]">
                          ({u.symbol})
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal Components */}
      <ItemCreateModal
        isOpen={showItemModal}
        onClose={() => setShowItemModal(false)}
        onSuccess={(newItem) => {
          setFeedback({
            type: 'success',
            message: `Item "${newItem.name}" [${newItem.code}] created successfully.`,
          });
          loadData();
        }}
        categories={categories}
        units={units}
      />

      <VendorCreateModal
        isOpen={showVendorModal}
        onClose={() => setShowVendorModal(false)}
        onSuccess={(newVendor) => {
          setFeedback({
            type: 'success',
            message: `Vendor "${newVendor.name}" [${newVendor.code}] registered successfully.`,
          });
          loadData();
        }}
      />

      <CategoryCreateModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onSuccess={(newCat) => {
          setFeedback({
            type: 'success',
            message: `Category "${newCat.name}" created successfully.`,
          });
          loadData();
        }}
      />

      <UnitCreateModal
        isOpen={showUnitModal}
        onClose={() => setShowUnitModal(false)}
        onSuccess={(newUnit) => {
          setFeedback({
            type: 'success',
            message: `Unit "${newUnit.name}" (${newUnit.symbol}) created successfully.`,
          });
          loadData();
        }}
      />
    </div>
  );
};

export default SetupWorkspace;
