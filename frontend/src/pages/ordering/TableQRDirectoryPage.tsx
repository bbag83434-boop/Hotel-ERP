import React, { useState, useEffect } from 'react';
import {
  QrCode,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  Users,
  Search,
  Download
} from 'lucide-react';
import { onlineOrderApi } from '../../api/online-order.api';
import { BranchTableQRItem } from '../../types/online-order.types';

export const TableQRDirectoryPage: React.FC = () => {
  const [tables, setTables] = useState<BranchTableQRItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('All');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [selectedTableForCard, setSelectedTableForCard] = useState<BranchTableQRItem | null>(null);
  const [generatingToken, setGeneratingToken] = useState<string | null>(null);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    setLoading(true);
    try {
      const data = await onlineOrderApi.getBranchTablesQR();
      setTables(data);
    } catch (err) {
      console.error('Failed to load table QR directory', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQR = async (tableId: string) => {
    setGeneratingToken(tableId);
    try {
      await onlineOrderApi.generateTableQR(tableId);
      await loadTables();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to refresh QR session');
    } finally {
      setGeneratingToken(null);
    }
  };

  const handleCopyLink = (token: string) => {
    const fullUrl = `${window.location.origin}/order?token=${token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  // Section List
  const sections = ['All', ...Array.from(new Set(tables.map((t) => t.section)))];

  const filteredTables = tables.filter((t) => {
    const matchesSec = activeSection === 'All' || t.section === activeSection;
    const matchesSearch =
      t.tableNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tableName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.section.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSec && matchesSearch;
  });

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-[#d4a437] uppercase tracking-wider mb-1">
            <QrCode className="w-4 h-4" />
            <span>Digital Ordering Management</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white font-serif">Table QR Code Directory</h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Manage table QR tokens, generate contactless dining standees, and inspect live digital ordering sessions.
          </p>
        </div>

        <button
          onClick={loadTables}
          className="self-start sm:self-auto px-4 py-2 bg-[#17171c] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl text-xs font-semibold text-neutral-200 transition-colors flex items-center space-x-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Directory</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#111115] border border-white/[0.07] rounded-2xl p-3">
        <div className="flex items-center space-x-2 w-full sm:w-80 bg-[#17171c] border border-white/[0.08] rounded-xl px-3 py-2">
          <Search className="w-3.5 h-3.5 text-neutral-500" />
          <input
            type="text"
            placeholder="Search by table number or section..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-neutral-200 placeholder-neutral-500 outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto scrollbar-none">
          {sections.map((sec) => (
            <button
              key={sec}
              onClick={() => setActiveSection(sec)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                activeSection === sec
                  ? 'bg-[#d4a437] text-black font-bold shadow-sm'
                  : 'bg-[#17171c] text-neutral-400 hover:text-white border border-white/[0.05]'
              }`}
            >
              {sec}
            </button>
          ))}
        </div>
      </div>

      {/* Tables Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#d4a437] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-neutral-400">Loading tables QR status...</p>
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="py-16 text-center text-neutral-500 bg-[#111115] border border-white/[0.06] rounded-2xl space-y-2">
          <QrCode className="w-8 h-8 mx-auto opacity-40" />
          <p className="text-xs">No tables found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTables.map((table) => {
            const isCopied = copiedToken === table.sessionToken;
            return (
              <div
                key={table.tableId}
                className="bg-[#121216] border border-white/[0.07] hover:border-[#d4a437]/30 rounded-2xl p-4 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-base font-bold text-white font-mono">{table.tableNumber}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                            table.status === 'OCCUPIED'
                              ? 'bg-[#d4a437]/20 text-[#d4a437]'
                              : table.status === 'AVAILABLE'
                              ? 'bg-[#3fbf6f]/20 text-[#3fbf6f]'
                              : 'bg-white/[0.06] text-neutral-400'
                          }`}
                        >
                          {table.status}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">{table.tableName}</p>
                    </div>

                    <span className="text-[11px] text-neutral-400 flex items-center space-x-1">
                      <Users className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{table.capacity} Seats</span>
                    </span>
                  </div>

                  <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between text-neutral-400">
                      <span>Dining Section</span>
                      <span className="text-neutral-200 font-medium">{table.section}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Active Token</span>
                      <span className="font-mono text-[#d4a437] font-semibold">{table.sessionToken}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/[0.05]">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleCopyLink(table.sessionToken)}
                      className="py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-neutral-200 transition-colors flex items-center justify-center space-x-1.5"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-[#3fbf6f]" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? 'Link Copied!' : 'Copy Link'}</span>
                    </button>

                    <a
                      href={`/order?token=${table.sessionToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 rounded-xl bg-[#d4a437]/15 hover:bg-[#d4a437] text-[#d4a437] hover:text-black text-xs font-bold transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Guest View</span>
                    </a>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={generatingToken === table.tableId}
                      onClick={() => handleGenerateQR(table.tableId)}
                      className="py-1.5 text-[11px] text-neutral-400 hover:text-white transition-colors flex items-center justify-center space-x-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${generatingToken === table.tableId ? 'animate-spin' : ''}`} />
                      <span>Reset Token</span>
                    </button>

                    <button
                      onClick={() => setSelectedTableForCard(table)}
                      className="py-1.5 text-[11px] text-[#d4a437] hover:underline transition-colors flex items-center justify-center space-x-1"
                    >
                      <QrCode className="w-3 h-3" />
                      <span>Preview Standee</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Standee Preview Modal */}
      {selectedTableForCard && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141418] border border-white/[0.1] rounded-3xl w-full max-w-sm p-6 space-y-5 text-center">
            {/* Standee Card */}
            <div className="bg-gradient-to-b from-[#1c1c24] to-[#0e0e12] border-2 border-[#d4a437]/50 rounded-2xl p-6 space-y-4 shadow-2xl">
              <div className="space-y-1">
                <p className="text-[10px] font-bold tracking-widest text-[#d4a437] uppercase font-mono">GRAND HERITAGE</p>
                <h3 className="text-lg font-bold text-white font-serif">Table {selectedTableForCard.tableNumber}</h3>
                <p className="text-xs text-neutral-400">{selectedTableForCard.section}</p>
              </div>

              {/* QR Graphic Box */}
              <div className="bg-white p-5 rounded-2xl inline-block shadow-inner mx-auto">
                <div className="w-36 h-36 bg-neutral-900 rounded-xl flex flex-col items-center justify-center text-center p-2 text-white">
                  <QrCode className="w-20 h-20 text-[#d4a437]" />
                  <p className="text-[9px] font-mono text-neutral-400 mt-1">Scan for Digital Menu</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-bold text-neutral-200">Scan QR with Phone Camera</p>
                <p className="text-[11px] text-neutral-400">Instant Menu, Modifiers & Digital Settlement</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-[#d4a437] text-black font-bold text-xs uppercase tracking-wider shadow-md flex items-center justify-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Print Standee</span>
              </button>
              <button
                onClick={() => setSelectedTableForCard(null)}
                className="px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-xs font-semibold text-neutral-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableQRDirectoryPage;
