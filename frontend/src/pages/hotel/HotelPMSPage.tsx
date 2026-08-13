import React, { useState, useEffect } from 'react';
import {
  Bed,
  Calendar,
  Sparkles,
  Moon,
  Users,
  Search,
  Plus,
  Building,
  Key,
  Wrench
} from 'lucide-react';
import { hotelApi } from '../../api/hotel.api';
import {
  Room,
  Floor,
  RoomType,
  Booking,
  GuestProfile,
  HousekeepingTask,
  MaintenanceTicket,
  NightAudit
} from '../../types/hotel.types';
import { formatINR, formatDateIN } from '../../utils/formatters';

export const HotelPMSPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'rooms' | 'bookings' | 'housekeeping' | 'nightAudit' | 'guests'>('rooms');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Data States
  const [floors, setFloors] = useState<Floor[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [guests, setGuests] = useState<GuestProfile[]>([]);
  const [hkTasks, setHkTasks] = useState<HousekeepingTask[]>([]);
  const [maintenanceTickets, setMaintenanceTickets] = useState<MaintenanceTicket[]>([]);

  // Filter States
  const [selectedFloor, setSelectedFloor] = useState<string>('ALL');
  const [roomStatusFilter, setRoomStatusFilter] = useState<string>('ALL');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('ALL');
  const [guestSearch, setGuestSearch] = useState('');

  // Modals
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [showFolioChargeModal, setShowFolioChargeModal] = useState(false);
  const [showRoomChangeModal, setShowRoomChangeModal] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showHkModal, setShowHkModal] = useState(false);
  const [showMaintModal, setShowMaintModal] = useState(false);

  // Active Target for Modal Actions
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);

  // Form Inputs
  const [newBookingForm, setNewBookingForm] = useState({
    guestId: '',
    roomTypeId: '',
    roomId: '',
    checkInDate: new Date().toISOString().slice(0, 10),
    checkOutDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    adults: 2,
    children: 0,
    roomRate: 180,
    advancePayment: 0,
    notes: ''
  });

  const [checkInForm, setCheckInForm] = useState({
    roomId: '',
    keyCardNumber: '',
    notes: ''
  });

  const [checkOutForm, setCheckOutForm] = useState({
    paymentMethod: 'CREDIT_CARD',
    amountPaid: 0,
    discountAmount: 0,
    notes: ''
  });

  const [folioChargeForm, setFolioChargeForm] = useState({
    transactionType: 'FOOD_BEVERAGE_POS',
    description: '',
    amount: 0
  });

  const [roomChangeForm, setRoomChangeForm] = useState({
    newRoomId: '',
    reason: ''
  });

  const [newGuestForm, setNewGuestForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    idType: 'PASSPORT',
    idNumber: '',
    nationality: '',
    vipStatus: 'NONE',
    preferences: ''
  });

  const [newHkForm, setNewHkForm] = useState({
    roomId: '',
    taskType: 'DAILY_CLEAN',
    priority: 'MEDIUM',
    remarks: ''
  });

  const [newMaintForm, setNewMaintForm] = useState({
    roomId: '',
    title: '',
    description: '',
    category: 'PLUMBING',
    priority: 'MEDIUM'
  });

  const [latestNightAudit, setLatestNightAudit] = useState<NightAudit | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const [flrs, rTypes, rms, bks, gsts, hks, maints] = await Promise.all([
        hotelApi.getFloors().catch(() => []),
        hotelApi.getRoomTypes().catch(() => []),
        hotelApi.getRooms().catch(() => []),
        hotelApi.getBookings().catch(() => []),
        hotelApi.getGuests().catch(() => []),
        hotelApi.getHousekeepingTasks().catch(() => []),
        hotelApi.getMaintenanceTickets().catch(() => [])
      ]);
      setFloors(flrs);
      setRoomTypes(rTypes);
      setRooms(rms);
      setBookings(bks);
      setGuests(gsts);
      setHkTasks(hks);
      setMaintenanceTickets(maints);

      if (rTypes.length > 0 && !newBookingForm.roomTypeId) {
        setNewBookingForm((prev) => ({
          ...prev,
          roomTypeId: rTypes[0].id,
          roomRate: Number(rTypes[0].baseRate)
        }));
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to load hotel data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Quick stats
  const totalRoomsCount = rooms.length;
  const occupiedCount = rooms.filter((r) => r.status === 'OCCUPIED').length;
  const availableCount = rooms.filter((r) => r.status === 'AVAILABLE').length;
  const dirtyCount = rooms.filter((r) => r.status === 'DIRTY_CLEANING').length;
  const occupancyPct = totalRoomsCount > 0 ? Math.round((occupiedCount / totalRoomsCount) * 100) : 0;

  // Handler: Create Booking
  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookingForm.guestId || !newBookingForm.roomTypeId) {
      setErrorMsg('Please select both a guest and room type');
      return;
    }
    try {
      setLoading(true);
      const branchId = floors[0]?.branchId || rooms[0]?.branchId || '';
      const b = await hotelApi.createBooking({
        ...newBookingForm,
        branchId,
        adults: Number(newBookingForm.adults),
        roomRate: Number(newBookingForm.roomRate),
        advancePayment: Number(newBookingForm.advancePayment)
      });
      setShowBookingModal(false);
      showToast(`Booking #${b.bookingNumber} created successfully!`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Check-In
  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBooking || !checkInForm.roomId) return;
    try {
      setLoading(true);
      await hotelApi.checkInGuest(activeBooking.id, checkInForm);
      setShowCheckInModal(false);
      showToast(`Guest checked in to Room! Key issued.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to check in');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Check-Out
  const handleCheckOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBooking) return;
    try {
      setLoading(true);
      await hotelApi.checkOutGuest(activeBooking.id, {
        paymentMethod: checkOutForm.paymentMethod,
        amountPaid: Number(checkOutForm.amountPaid),
        discountAmount: Number(checkOutForm.discountAmount),
        notes: checkOutForm.notes
      });
      setShowCheckOutModal(false);
      showToast(`Booking #${activeBooking.bookingNumber} checked out! Double-Entry GL Journal posted.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to check out');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Post Folio Charge
  const handlePostFolioCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBooking) return;
    try {
      setLoading(true);
      await hotelApi.postFolioCharge(activeBooking.id, {
        transactionType: folioChargeForm.transactionType,
        description: folioChargeForm.description,
        amount: Number(folioChargeForm.amount)
      });
      setShowFolioChargeModal(false);
      showToast(`Posted $${folioChargeForm.amount} charge to guest folio!`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to post charge');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Room Change
  const handleRoomChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBooking || !roomChangeForm.newRoomId) return;
    try {
      setLoading(true);
      await hotelApi.changeRoom(activeBooking.id, roomChangeForm);
      setShowRoomChangeModal(false);
      showToast(`Room changed successfully! Previous room marked for cleaning.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to change room');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Create Guest
  const handleCreateGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const g = await hotelApi.createGuest(newGuestForm);
      setShowGuestModal(false);
      showToast(`Guest profile for ${g.firstName} ${g.lastName} created!`);
      setNewBookingForm((prev) => ({ ...prev, guestId: g.id }));
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create guest');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Run Night Audit
  const handleRunNightAudit = async () => {
    try {
      setLoading(true);
      const branchId = floors[0]?.branchId || rooms[0]?.branchId || '';
      const audit = await hotelApi.runNightAudit({ branchId });
      setLatestNightAudit(audit);
      showToast(`Night audit completed successfully! Room revenue and daily charges posted.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Night audit failed');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Update Housekeeping Status
  const handleUpdateHkStatus = async (taskId: string, status: string) => {
    try {
      await hotelApi.updateHousekeepingStatus(taskId, status);
      showToast(`Housekeeping status updated to ${status}`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to update housekeeping');
    }
  };

  const filteredRooms = rooms.filter((r) => {
    if (selectedFloor !== 'ALL' && r.floorId !== selectedFloor) return false;
    if (roomStatusFilter !== 'ALL' && r.status !== roomStatusFilter) return false;
    return true;
  });

  const filteredBookings = bookings.filter((b) => {
    if (bookingStatusFilter !== 'ALL' && b.status !== bookingStatusFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 md:pb-8">
      {/* Top Banner & KPI Bar */}
      <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-30 px-4 py-3 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-xl shadow-lg shadow-amber-900/20 text-slate-950 font-bold">
              <Building className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Hotel Property Management System (PMS)
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                  Front Desk & Folios
                </span>
              </h1>
              <p className="text-xs text-slate-400">Room availability matrix, guest check-in/out, billing folios, housekeeping & night audit</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowBookingModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-sm rounded-lg shadow-md transition"
            >
              <Plus className="w-4 h-4" />
              New Reservation
            </button>
            <button
              onClick={handleRunNightAudit}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 font-medium text-sm rounded-lg transition"
            >
              <Moon className="w-4 h-4 text-indigo-400" />
              Run Night Audit
            </button>
          </div>
        </div>

        {/* Quick KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-3 pt-3 border-t border-slate-800/80">
          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
            <span className="text-[11px] text-slate-400 uppercase font-medium">Occupancy Rate</span>
            <div className="text-lg font-bold text-amber-400 mt-0.5 flex items-baseline gap-1">
              {occupancyPct}%
              <span className="text-xs text-slate-400 font-normal">({occupiedCount}/{totalRoomsCount} rooms)</span>
            </div>
          </div>
          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
            <span className="text-[11px] text-slate-400 uppercase font-medium">Available Clean</span>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">{availableCount} Rooms</div>
          </div>
          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
            <span className="text-[11px] text-slate-400 uppercase font-medium">In-House Guests</span>
            <div className="text-lg font-bold text-indigo-300 mt-0.5">{occupiedCount} Stays</div>
          </div>
          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
            <span className="text-[11px] text-slate-400 uppercase font-medium">Dirty / Cleaning</span>
            <div className="text-lg font-bold text-rose-400 mt-0.5">{dirtyCount} Rooms</div>
          </div>
          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
            <span className="text-[11px] text-slate-400 uppercase font-medium">Housekeeping Tasks</span>
            <div className="text-lg font-bold text-sky-400 mt-0.5">{hkTasks.filter(t => t.status !== 'INSPECTED').length} Active</div>
          </div>
        </div>
      </header>

      {/* Main Tab Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <div className="flex border-b border-slate-800 overflow-x-auto scrollbar-none gap-2">
          {[
            { key: 'rooms', label: 'Room Map & Floor Plan', icon: Bed },
            { key: 'bookings', label: 'Front Desk & Reservations', icon: Calendar },
            { key: 'housekeeping', label: 'Housekeeping & Maintenance', icon: Sparkles },
            { key: 'nightAudit', label: 'Night Audit & Revenue', icon: Moon },
            { key: 'guests', label: 'Guest Profiles & VIPs', icon: Users }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition ${
                  isActive
                    ? 'border-amber-400 text-amber-400 bg-amber-400/5 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-950/80 border border-rose-800/80 text-rose-200 rounded-lg text-sm flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-rose-400 font-bold ml-3">✕</button>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-950/80 border border-emerald-800/80 text-emerald-200 rounded-lg text-sm flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-400 font-bold ml-3">✕</button>
          </div>
        )}

        {/* TAB 1: ROOM MAP & FLOOR PLAN */}
        {activeTab === 'rooms' && (
          <div className="mt-4 space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
                <span className="text-xs text-slate-400 font-semibold uppercase mr-1">Floor:</span>
                <button
                  onClick={() => setSelectedFloor('ALL')}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition ${
                    selectedFloor === 'ALL' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  All Floors
                </button>
                {floors.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFloor(f.id)}
                    className={`px-3 py-1 text-xs rounded-lg font-medium transition ${
                      selectedFloor === f.id ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Floor {f.floorNumber} ({f.name})
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold uppercase mr-1">Status:</span>
                <select
                  value={roomStatusFilter}
                  onChange={(e) => setRoomStatusFilter(e.target.value)}
                  className="bg-slate-800 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="AVAILABLE">Available Clean</option>
                  <option value="OCCUPIED">Occupied</option>
                  <option value="DIRTY_CLEANING">Dirty / Cleaning</option>
                  <option value="OUT_OF_SERVICE">Out of Service</option>
                </select>
              </div>
            </div>

            {/* Room Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {filteredRooms.map((r) => {
                const activeStay = r.bookings && r.bookings.length > 0 ? r.bookings[0] : null;
                const isOccupied = r.status === 'OCCUPIED';
                const isDirty = r.status === 'DIRTY_CLEANING';
                const isAvailable = r.status === 'AVAILABLE';

                let borderClass = 'border-slate-800 bg-slate-900';
                let badgeClass = 'bg-slate-800 text-slate-300';
                if (isAvailable) {
                  borderClass = 'border-emerald-700/60 bg-emerald-950/20';
                  badgeClass = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
                } else if (isOccupied) {
                  borderClass = 'border-indigo-700/60 bg-indigo-950/20';
                  badgeClass = 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
                } else if (isDirty) {
                  borderClass = 'border-rose-700/60 bg-rose-950/20';
                  badgeClass = 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
                }

                return (
                  <div
                    key={r.id}
                    className={`rounded-xl border p-3.5 flex flex-col justify-between transition hover:shadow-lg hover:border-slate-600 ${borderClass}`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-extrabold text-white tracking-tight">#{r.roomNumber}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${badgeClass}`}>
                          {r.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 font-medium">{r.roomType?.name || 'Standard Room'}</p>
                      <p className="text-xs text-amber-400/90 mt-0.5 font-semibold">{formatINR(r.roomType?.baseRate || 0)} / night</p>

                      {isOccupied && activeStay && (
                        <div className="mt-3 p-2 bg-slate-950/60 rounded-lg border border-indigo-900/40 text-xs">
                          <div className="font-semibold text-slate-200 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-indigo-400" />
                            {activeStay.guest?.firstName} {activeStay.guest?.lastName}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Due: {formatINR(activeStay.balanceAmount)}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center gap-2">
                      {isAvailable && (
                        <button
                          onClick={() => {
                            setNewBookingForm((prev) => ({
                              ...prev,
                              roomId: r.id,
                              roomTypeId: r.roomTypeId,
                              roomRate: Number(r.roomType?.baseRate || 180)
                            }));
                            setShowBookingModal(true);
                          }}
                          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg transition"
                        >
                          Book / Check-in
                        </button>
                      )}

                      {isOccupied && activeStay && (
                        <div className="grid grid-cols-2 gap-1.5 w-full">
                          <button
                            onClick={() => {
                              setActiveBooking(activeStay);
                              setFolioChargeForm({ transactionType: 'FOOD_BEVERAGE_POS', description: 'Room Service', amount: 35 });
                              setShowFolioChargeModal(true);
                            }}
                            className="py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] rounded font-medium border border-amber-500/20"
                          >
                            + Folio
                          </button>
                          <button
                            onClick={() => {
                              setActiveBooking(activeStay);
                              setCheckOutForm({
                                paymentMethod: 'CREDIT_CARD',
                                amountPaid: Number(activeStay.balanceAmount),
                                discountAmount: 0,
                                notes: ''
                              });
                              setShowCheckOutModal(true);
                            }}
                            className="py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] rounded font-bold"
                          >
                            Check-out
                          </button>
                        </div>
                      )}

                      {isDirty && (
                        <button
                          onClick={async () => {
                            await hotelApi.updateRoomStatus(r.id, 'AVAILABLE');
                            showToast(`Room #${r.roomNumber} marked AVAILABLE!`);
                            loadData();
                          }}
                          className="w-full py-1.5 bg-rose-600/80 hover:bg-rose-500 text-white font-medium text-xs rounded-lg transition flex items-center justify-center gap-1"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Mark Clean
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: FRONT DESK & RESERVATIONS */}
        {activeTab === 'bookings' && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold uppercase">Filter Stays:</span>
                {['ALL', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setBookingStatusFilter(st)}
                    className={`px-3 py-1 text-xs rounded-lg font-medium transition ${
                      bookingStatusFilter === st ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowBookingModal(true)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> New Booking
              </button>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Booking #</th>
                      <th className="px-4 py-3">Guest Name</th>
                      <th className="px-4 py-3">Room</th>
                      <th className="px-4 py-3">Dates</th>
                      <th className="px-4 py-3">Total / Balance</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredBookings.map((b) => {
                      const isCheckedIn = b.status === 'CHECKED_IN';
                      const isConfirmed = b.status === 'CONFIRMED';
                      return (
                        <tr key={b.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3 font-bold text-white">
                            {b.bookingNumber}
                            <span className="block text-[11px] text-slate-400 font-normal">{b.source}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-200">
                              {b.guest?.firstName} {b.guest?.lastName}
                            </div>
                            <div className="text-xs text-slate-400">{b.guest?.phone || b.guest?.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            {b.room ? (
                              <span className="font-bold text-amber-300">#{b.room.roomNumber} ({b.roomType?.code})</span>
                            ) : (
                              <span className="text-xs text-slate-500 italic">Unassigned ({b.roomType?.name})</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <div>In: {formatDateIN(b.checkInDate)}</div>
                            <div className="text-slate-400">Out: {formatDateIN(b.checkOutDate)}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-100">{formatINR(b.grandTotal)}</div>
                            <div className="text-xs text-rose-400">Due: {formatINR(b.balanceAmount)}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                                isCheckedIn
                                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                  : isConfirmed
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {b.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isConfirmed && (
                                <button
                                  onClick={() => {
                                    setActiveBooking(b);
                                    setCheckInForm({
                                      roomId: b.roomId || (rooms.find(r => r.roomTypeId === b.roomTypeId && r.status === 'AVAILABLE')?.id || ''),
                                      keyCardNumber: 'CARD-' + Math.floor(1000 + Math.random() * 9000),
                                      notes: ''
                                    });
                                    setShowCheckInModal(true);
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded transition flex items-center gap-1"
                                >
                                  <Key className="w-3 h-3" /> Check-In
                                </button>
                              )}

                              {isCheckedIn && (
                                <>
                                  <button
                                    onClick={() => {
                                      setActiveBooking(b);
                                      setFolioChargeForm({ transactionType: 'FOOD_BEVERAGE_POS', description: 'Restaurant Dining', amount: 45 });
                                      setShowFolioChargeModal(true);
                                    }}
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs rounded border border-amber-500/30"
                                  >
                                    + Charge
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveBooking(b);
                                      setRoomChangeForm({ newRoomId: '', reason: 'Guest room upgrade request' });
                                      setShowRoomChangeModal(true);
                                    }}
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs rounded border border-sky-500/30"
                                  >
                                    Change Room
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveBooking(b);
                                      setCheckOutForm({
                                        paymentMethod: 'CREDIT_CARD',
                                        amountPaid: Number(b.balanceAmount),
                                        discountAmount: 0,
                                        notes: ''
                                      });
                                      setShowCheckOutModal(true);
                                    }}
                                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded transition"
                                  >
                                    Check-Out
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: HOUSEKEEPING & MAINTENANCE */}
        {activeTab === 'housekeeping' && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Housekeeping Tasks */}
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" /> Housekeeping Queue
                  </h3>
                  <p className="text-xs text-slate-400">Live cleaning, turnover & room inspection tasks</p>
                </div>
                <button
                  onClick={() => setShowHkModal(true)}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> New Task
                </button>
              </div>

              <div className="space-y-2.5">
                {hkTasks.map((t) => (
                  <div key={t.id} className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">Room #{t.room?.roomNumber}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-semibold">
                          {t.taskType.replace('_', ' ')}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          t.status === 'INSPECTED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{t.remarks || 'Standard room turnover'}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {t.status === 'PENDING' && (
                        <button
                          onClick={() => handleUpdateHkStatus(t.id, 'IN_PROGRESS')}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded"
                        >
                          Start Clean
                        </button>
                      )}
                      {t.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleUpdateHkStatus(t.id, 'COMPLETED')}
                          className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded"
                        >
                          Complete
                        </button>
                      )}
                      {t.status === 'COMPLETED' && (
                        <button
                          onClick={() => handleUpdateHkStatus(t.id, 'INSPECTED')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded"
                        >
                          Inspect & Free Room
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Maintenance Tickets */}
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-sky-400" /> Engineering & Maintenance
                  </h3>
                  <p className="text-xs text-slate-400">Plumbing, HVAC & electrical repair tickets</p>
                </div>
                <button
                  onClick={() => setShowMaintModal(true)}
                  className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Log Issue
                </button>
              </div>

              <div className="space-y-2.5">
                {maintenanceTickets.map((m) => (
                  <div key={m.id} className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">
                          {m.room ? `Room #${m.room.roomNumber}: ` : ''}{m.title}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-sky-950 text-sky-300 font-semibold border border-sky-800">
                          {m.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{m.description}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: NIGHT AUDIT TERMINAL */}
        {activeTab === 'nightAudit' && (
          <div className="mt-4 max-w-4xl mx-auto space-y-6">
            <div className="bg-gradient-to-br from-indigo-950/60 to-slate-900 p-6 rounded-2xl border border-indigo-800/40 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Moon className="w-6 h-6 text-indigo-400" /> Automated Night Audit Terminal
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Roll forward daily room charges to in-house guest folios, compute ADR / RevPAR KPIs, and post Double-Entry GL entries.
                  </p>
                </div>
                <button
                  onClick={handleRunNightAudit}
                  disabled={loading}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg transition"
                >
                  {loading ? 'Auditing...' : 'Execute Night Audit'}
                </button>
              </div>

              {latestNightAudit && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-indigo-900/50">
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-indigo-900/30">
                    <span className="text-[11px] text-slate-400 uppercase">Occupancy</span>
                    <div className="text-lg font-bold text-amber-300 mt-0.5">{Number(latestNightAudit.occupancyRate)}%</div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Total Room Revenue</span>
                    <div className="text-lg font-bold text-emerald-400 mt-0.5">{formatINR(latestNightAudit.roomRevenue)}</div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Average Daily Rate (ADR)</span>
                    <div className="text-lg font-bold text-sky-400 mt-0.5">{formatINR(latestNightAudit.adr)}</div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400 uppercase font-semibold">RevPAR</span>
                    <div className="text-lg font-bold text-purple-400 mt-0.5">{formatINR(latestNightAudit.revpar)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: GUEST DIRECTORY */}
        {activeTab === 'guests' && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search guests by name, email, or phone..."
                  value={guestSearch}
                  onChange={(e) => setGuestSearch(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                onClick={() => setShowGuestModal(true)}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Guest Profile
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {guests.map((g) => (
                <div key={g.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-white text-base">{g.firstName} {g.lastName}</div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      g.vipStatus === 'PLATINUM'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : g.vipStatus === 'GOLD'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {g.vipStatus} VIP
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 space-y-0.5">
                    <div>Email: {g.email || 'N/A'}</div>
                    <div>Phone: {g.phone || 'N/A'}</div>
                    <div>Nationality: {g.nationality || 'International'}</div>
                  </div>
                  {g.preferences && (
                    <p className="text-[11px] text-amber-300/80 bg-slate-950 p-2 rounded border border-slate-800">
                      Pref: {g.preferences}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {/* 1. New Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Create New Reservation</h3>
            <form onSubmit={handleCreateBooking} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Guest Profile *</label>
                <select
                  value={newBookingForm.guestId}
                  onChange={(e) => setNewBookingForm({ ...newBookingForm, guestId: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  required
                >
                  <option value="">Select Guest</option>
                  {guests.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.firstName} {g.lastName} ({g.vipStatus} VIP)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Room Type *</label>
                  <select
                    value={newBookingForm.roomTypeId}
                    onChange={(e) => {
                      const rt = roomTypes.find((r) => r.id === e.target.value);
                      setNewBookingForm({
                        ...newBookingForm,
                        roomTypeId: e.target.value,
                        roomRate: Number(rt?.baseRate || 180)
                      });
                    }}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                    required
                  >
                    {roomTypes.map((rt) => (
                      <option key={rt.id} value={rt.id}>{rt.name} ({formatINR(Number(rt.baseRate))})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Nightly Rate (₹)</label>
                  <input
                    type="number"
                    value={newBookingForm.roomRate}
                    onChange={(e) => setNewBookingForm({ ...newBookingForm, roomRate: Number(e.target.value) })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Check-In Date</label>
                  <input
                    type="date"
                    value={newBookingForm.checkInDate}
                    onChange={(e) => setNewBookingForm({ ...newBookingForm, checkInDate: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Check-Out Date</label>
                  <input
                    type="date"
                    value={newBookingForm.checkOutDate}
                    onChange={(e) => setNewBookingForm({ ...newBookingForm, checkOutDate: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Advance Deposit Paid (₹)</label>
                <input
                  type="number"
                  value={newBookingForm.advancePayment}
                  onChange={(e) => setNewBookingForm({ ...newBookingForm, advancePayment: Number(e.target.value) })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs rounded-lg font-bold"
                >
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Check-In Modal */}
      {showCheckInModal && activeBooking && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Check-In Guest: #{activeBooking.bookingNumber}</h3>
            <p className="text-xs text-slate-400">
              Guest: {activeBooking.guest?.firstName} {activeBooking.guest?.lastName}
            </p>
            <form onSubmit={handleCheckIn} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Assign Clean Room *</label>
                <select
                  value={checkInForm.roomId}
                  onChange={(e) => setCheckInForm({ ...checkInForm, roomId: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  required
                >
                  <option value="">Select Available Room</option>
                  {rooms
                    .filter((r) => r.status === 'AVAILABLE' || r.id === activeBooking.roomId)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        Room #{r.roomNumber} ({r.roomType?.name})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Key Card ID</label>
                <input
                  type="text"
                  value={checkInForm.keyCardNumber}
                  onChange={(e) => setCheckInForm({ ...checkInForm, keyCardNumber: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCheckInModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs rounded-lg font-bold"
                >
                  Complete Check-In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Check-Out Modal */}
      {showCheckOutModal && activeBooking && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Check-Out & Settle Folio: #{activeBooking.bookingNumber}</h3>
            
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Room Tariff Charges:</span>
                <span>{formatINR(activeBooking.totalRoomCharges)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">GST on Accommodation (12%/18%):</span>
                <span>{formatINR(activeBooking.taxAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Extra Charges (F&B / Room Service):</span>
                <span>{formatINR(activeBooking.extraCharges)}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Advance Deposit Paid:</span>
                <span>-{formatINR(activeBooking.paidAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800">
                <span>Net Outstanding Balance:</span>
                <span className="text-rose-400">{formatINR(activeBooking.balanceAmount)}</span>
              </div>
            </div>

            <form onSubmit={handleCheckOut} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Payment Method</label>
                  <select
                    value={checkOutForm.paymentMethod}
                    onChange={(e) => setCheckOutForm({ ...checkOutForm, paymentMethod: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  >
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="CASH">Cash</option>
                    <option value="MOBILE_BANKING">Mobile Banking</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Amount Paid (₹) *</label>
                  <input
                    type="number"
                    value={checkOutForm.amountPaid}
                    onChange={(e) => setCheckOutForm({ ...checkOutForm, amountPaid: Number(e.target.value) })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCheckOutModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg font-bold"
                >
                  Settle & Check-Out
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Post Folio Charge Modal */}
      {showFolioChargeModal && activeBooking && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Post Charge to Folio</h3>
            <form onSubmit={handlePostFolioCharge} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Charge Type</label>
                <select
                  value={folioChargeForm.transactionType}
                  onChange={(e) => setFolioChargeForm({ ...folioChargeForm, transactionType: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                >
                  <option value="FOOD_BEVERAGE_POS">Food & Beverage (Room Service / Dining)</option>
                  <option value="SPA">Spa & Wellness</option>
                  <option value="LAUNDRY">Laundry & Valet</option>
                  <option value="MINIBAR">Minibar</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Description</label>
                <input
                  type="text"
                  value={folioChargeForm.description}
                  onChange={(e) => setFolioChargeForm({ ...folioChargeForm, description: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Amount ($)</label>
                <input
                  type="number"
                  value={folioChargeForm.amount}
                  onChange={(e) => setFolioChargeForm({ ...folioChargeForm, amount: Number(e.target.value) })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowFolioChargeModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs rounded-lg font-bold"
                >
                  Post Charge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Add Guest Modal */}
      {showGuestModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Create Guest Profile</h3>
            <form onSubmit={handleCreateGuest} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">First Name *</label>
                  <input
                    type="text"
                    value={newGuestForm.firstName}
                    onChange={(e) => setNewGuestForm({ ...newGuestForm, firstName: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={newGuestForm.lastName}
                    onChange={(e) => setNewGuestForm({ ...newGuestForm, lastName: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Email</label>
                <input
                  type="email"
                  value={newGuestForm.email}
                  onChange={(e) => setNewGuestForm({ ...newGuestForm, email: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Phone</label>
                  <input
                    type="text"
                    value={newGuestForm.phone}
                    onChange={(e) => setNewGuestForm({ ...newGuestForm, phone: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">VIP Tier</label>
                  <select
                    value={newGuestForm.vipStatus}
                    onChange={(e) => setNewGuestForm({ ...newGuestForm, vipStatus: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  >
                    <option value="NONE">Standard</option>
                    <option value="SILVER">Silver VIP</option>
                    <option value="GOLD">Gold VIP</option>
                    <option value="PLATINUM">Platinum VIP</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGuestModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs rounded-lg font-bold"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 6. Room Change Modal */}
      {showRoomChangeModal && activeBooking && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Change Room for Booking #{activeBooking.bookingNumber}</h3>
            <p className="text-xs text-slate-400">Current Room: #{activeBooking.room?.roomNumber}</p>
            <form onSubmit={handleRoomChange} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">New Clean Room *</label>
                <select
                  value={roomChangeForm.newRoomId}
                  onChange={(e) => setRoomChangeForm({ ...roomChangeForm, newRoomId: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  required
                >
                  <option value="">Select Target Available Room</option>
                  {rooms
                    .filter((r) => r.status === 'AVAILABLE')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        Room #{r.roomNumber} ({r.roomType?.name})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Reason for Move *</label>
                <input
                  type="text"
                  placeholder="e.g. Upgrade / AC Maintenance"
                  value={roomChangeForm.reason}
                  onChange={(e) => setRoomChangeForm({ ...roomChangeForm, reason: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRoomChangeModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs rounded-lg font-bold"
                >
                  Execute Move
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. New Housekeeping Task Modal */}
      {showHkModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Create Housekeeping Task</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setLoading(true);
                  const branchId = floors[0]?.branchId || rooms[0]?.branchId || '';
                  await hotelApi.createHousekeepingTask({ ...newHkForm, branchId });
                  setShowHkModal(false);
                  showToast('Housekeeping task created!');
                  loadData();
                } catch (err: any) {
                  setErrorMsg(err.response?.data?.message || 'Failed to create task');
                } finally {
                  setLoading(false);
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Room *</label>
                <select
                  value={newHkForm.roomId}
                  onChange={(e) => setNewHkForm({ ...newHkForm, roomId: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  required
                >
                  <option value="">Select Room</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>Room #{r.roomNumber} ({r.status})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Task Type</label>
                  <select
                    value={newHkForm.taskType}
                    onChange={(e) => setNewHkForm({ ...newHkForm, taskType: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  >
                    <option value="DAILY_CLEAN">Daily Clean</option>
                    <option value="DEEP_CLEAN">Deep Clean</option>
                    <option value="CHECKOUT_CLEAN">Checkout Clean</option>
                    <option value="TURNDOWN">Turndown</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Priority</label>
                  <select
                    value={newHkForm.priority}
                    onChange={(e) => setNewHkForm({ ...newHkForm, priority: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Extra towels and feather pillows"
                  value={newHkForm.remarks}
                  onChange={(e) => setNewHkForm({ ...newHkForm, remarks: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowHkModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs rounded-lg font-bold"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. New Maintenance Ticket Modal */}
      {showMaintModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Log Maintenance Issue</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setLoading(true);
                  const branchId = floors[0]?.branchId || rooms[0]?.branchId || '';
                  await hotelApi.createMaintenanceTicket({ ...newMaintForm, branchId });
                  setShowMaintModal(false);
                  showToast('Maintenance ticket logged!');
                  loadData();
                } catch (err: any) {
                  setErrorMsg(err.response?.data?.message || 'Failed to log ticket');
                } finally {
                  setLoading(false);
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Bathroom shower pressure low"
                  value={newMaintForm.title}
                  onChange={(e) => setNewMaintForm({ ...newMaintForm, title: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Room (Optional)</label>
                  <select
                    value={newMaintForm.roomId}
                    onChange={(e) => setNewMaintForm({ ...newMaintForm, roomId: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  >
                    <option value="">General Property</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>Room #{r.roomNumber}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Category</label>
                  <select
                    value={newMaintForm.category}
                    onChange={(e) => setNewMaintForm({ ...newMaintForm, category: e.target.value })}
                    className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  >
                    <option value="PLUMBING">Plumbing</option>
                    <option value="ELECTRICAL">Electrical</option>
                    <option value="HVAC">HVAC / Air Con</option>
                    <option value="CARPENTRY">Carpentry</option>
                    <option value="APPLIANCE">Appliance</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Description *</label>
                <textarea
                  rows={2}
                  placeholder="Detailed description of issue..."
                  value={newMaintForm.description}
                  onChange={(e) => setNewMaintForm({ ...newMaintForm, description: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowMaintModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs rounded-lg font-bold"
                >
                  Log Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
