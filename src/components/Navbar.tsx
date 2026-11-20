import React, { useState } from 'react';
import { 
  Home, 
  CalendarDays, 
  Calendar,
  UtensilsCrossed, 
  Boxes, 
  FileText, 
  Activity, 
  ShieldCheck, 
  UserCheck, 
  LogOut, 
  Sparkles, 
  Menu, 
  X,
  ChevronDown,
  Megaphone,
  BarChart2,
  MessageSquare,
  Clock
} from 'lucide-react';
import { UserProfile, UserRole, BookingEvent } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onSwitchUser: (user: UserProfile) => void;
  bookings?: BookingEvent[];
  lastBackupTime?: string;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  allUsers,
  onSwitchUser,
  bookings = [],
  mobileOpen = false,
  setMobileOpen = () => {},
}) => {
  const [roleModalOpen, setRoleModalOpen] = useState(false);

  // Compute pending items for Chef and Accounts
  const chefPendingCount = bookings.filter(b => 
    b.hasFoodFromHotel && 
    b.partyEnded && 
    (!b.chefApproved || b.costingStatus === 'party_ended_pending_chef') &&
    b.costingStatus !== 'forwarded_to_accounts' &&
    b.costingStatus !== 'costed_by_arun'
  ).length;

  const accountsPendingCount = bookings.filter(b => 
    b.hasFoodFromHotel && 
    (b.costingStatus === 'forwarded_to_accounts' || (b.chefApproved && !b.arunCostedAt && b.costingStatus !== 'costed_by_arun'))
  ).length;

  const gmPendingCount = chefPendingCount + accountsPendingCount;

  // Role-based navigation filtering: streamlined, non-redundant role workflows
  const allNavItems = [
    { 
      id: 'dashboard', 
      label: currentUser.role === 'general_manager'
        ? 'Executive Reports'
        : currentUser.role === 'executive_chef'
        ? 'Chef Dashboard'
        : currentUser.role === 'accounts_executive'
        ? 'Accounts Dashboard'
        : currentUser.role === 'marketing_executive'
        ? 'Growth Dashboard'
        : 'Supervisor Desk', 
      icon: Home, 
      roles: ['general_manager', 'marketing_executive', 'fnb_supervisor', 'banquet_manager', 'executive_chef', 'accounts_executive'] 
    },
    {
      id: 'reports',
      label: currentUser.role === 'general_manager'
        ? 'Annual & YoY Reports'
        : currentUser.role === 'accounts_executive'
        ? 'Financial & YoY Reports'
        : 'Reports & Ledgers',
      icon: FileText,
      roles: ['general_manager', 'accounts_executive', 'marketing_executive']
    },
    { 
      id: 'costing_required', 
      label: currentUser.role === 'accounts_executive' ? 'FIFO Costing Queue' : 'Costing Queue', 
      icon: Clock, 
      roles: ['executive_chef', 'accounts_executive'],
      badge: currentUser.role === 'executive_chef' ? chefPendingCount : accountsPendingCount,
      badgeColor: currentUser.role === 'executive_chef' ? 'bg-amber-400 text-amber-950' : 'bg-purple-300 text-purple-950',
    },
    { 
      id: 'bookings', 
      label: currentUser.role === 'executive_chef' 
        ? 'Party Menus (Read)' 
        : currentUser.role === 'accounts_executive' 
        ? 'All Parties (Read)' 
        : currentUser.role === 'marketing_executive' 
        ? 'Bookings & Parties' 
        : 'Bookings & Calendar', 
      icon: CalendarDays, 
      roles: ['marketing_executive', 'fnb_supervisor', 'banquet_manager', 'executive_chef', 'accounts_executive'] 
    },
    { 
      id: 'costing', 
      label: currentUser.role === 'executive_chef' ? 'Recipes & Calculators' : 'Purchasing Costing', 
      icon: UtensilsCrossed, 
      roles: ['executive_chef', 'accounts_executive'] 
    },
    { 
      id: 'marketing', 
      label: 'Meta Ads & ROAS', 
      icon: BarChart2, 
      roles: ['marketing_executive'] 
    },
    { 
      id: 'marketing_kpi', 
      label: 'Inquiries Pipeline (CRM)', 
      icon: Megaphone, 
      roles: ['marketing_executive', 'banquet_manager', 'fnb_supervisor'] 
    },
    { 
      id: 'guest_retargeting', 
      label: 'WhatsApp Guests', 
      icon: MessageSquare, 
      roles: ['marketing_executive', 'banquet_manager'] 
    },
    { 
      id: 'invoices', 
      label: 'Invoices & Receipts', 
      icon: FileText, 
      roles: ['accounts_executive', 'fnb_supervisor', 'banquet_manager'] 
    },
    { 
      id: 'backups', 
      label: currentUser.role === 'executive_chef' 
        ? 'Chef Voucher Logs' 
        : currentUser.role === 'accounts_executive' 
        ? 'Accounts Costing Logs' 
        : 'System & Logs Vault', 
      icon: currentUser.role === 'executive_chef' || currentUser.role === 'accounts_executive' ? Clock : ShieldCheck, 
      roles: ['marketing_executive', 'accounts_executive', 'executive_chef'] 
    },
  ];

  const navItems = allNavItems.filter(item => item.roles.includes(currentUser.role));

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'general_manager':
        return 'bg-emerald-100 text-[#236B50] border-emerald-300';
      case 'marketing_executive':
        return 'bg-teal-100 text-teal-900 border-teal-300';
      case 'executive_chef':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'banquet_manager':
      case 'fnb_supervisor':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'accounts_executive':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const navContent = (
    <div className="flex flex-col justify-between h-full py-7 px-5 text-white">
      {/* Top Brand Logo - Exactly as shown in the screenshot */}
      <div className="space-y-6">
        <div 
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center space-x-3 cursor-pointer group px-2"
        >
          {/* Flash / Leaf Logo Mark */}
          <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white backdrop-blur-sm group-hover:bg-white/25 transition-all">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white text-white">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div>
            <div className="font-extrabold text-base tracking-tight font-['Plus_Jakarta_Sans'] leading-tight">
              AuraBanquets
            </div>
            <div className="text-[10px] text-[#A5D1C1] font-semibold tracking-wide">
              Crystal Plaza Hotel
            </div>
          </div>
        </div>

        {/* Navigation Items with Active Dot Indicator */}
        <nav className="space-y-1.5 pt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs sm:text-sm font-medium transition-all group ${
                  isActive
                    ? 'text-white font-bold bg-white/10 shadow-sm'
                    : 'text-[#B4D9CB] hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center space-x-3.5">
                  <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 transition-colors ${
                    isActive ? 'text-white' : 'text-[#A3CBB9] group-hover:text-white'
                  }`} />
                  <span className="tracking-tight">{item.label}</span>
                </div>

                <div className="flex items-center space-x-2">
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.badgeColor || 'bg-amber-400 text-amber-950'} shadow-xs animate-pulse`}>
                      {item.badge}
                    </span>
                  )}
                  {/* Solid white circular active dot indicator on the right - as seen in the uploaded UI screenshot! */}
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                  )}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile & Switch Role / Logout Pill Button */}
      <div className="pt-6 border-t border-white/10 space-y-3">
        {/* Active staff summary */}
        <div className="px-2">
          <div className="text-[10px] text-[#A5D1C1] font-medium uppercase tracking-wider">Active Staff</div>
          <div className="font-bold text-xs text-white truncate">{currentUser.name}</div>
          <div className="text-[10px] text-[#CBE7DC] truncate">{currentUser.title}</div>
        </div>

        {/* White pill button: Switch Role / Logout */}
        <button
          onClick={() => setRoleModalOpen(true)}
          className="w-full py-2.5 px-4 rounded-full bg-white text-[#236B50] hover:bg-[#F0F7F4] active:scale-98 transition-all flex items-center justify-center space-x-2 text-xs font-bold shadow-md cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 rotate-180" />
          <span>Switch Role</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar - Deep pine green #236B50 (Locked Navigation) */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#236B50] rounded-l-[32px] shrink-0 border-r border-[#1D5E46]/20 select-none sticky top-0 h-full max-h-[96vh] overflow-y-auto">
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-64 bg-[#236B50] h-full shadow-2xl z-10">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
            {navContent}
          </div>
        </div>
      )}

      {/* Role Switcher Modal */}
      {roleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-[#D5E5DE]">
            <div className="px-6 py-5 bg-[#F6FAF8] border-b border-[#E5EFEA] flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-[#236B50]/10 flex items-center justify-center text-[#236B50]">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#192A24] text-base">Select Staff Profile (RBAC)</h3>
                  <p className="text-[11px] text-[#6E8279]">Switch between Marketing Executive (Betselot), General Manager, Head Chef, Sales, or Accounts</p>
                </div>
              </div>
              <button
                onClick={() => setRoleModalOpen(false)}
                className="text-[#6E8279] hover:text-[#192A24] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <div className="grid grid-cols-1 gap-2.5">
                {allUsers.map((user) => {
                  const isSelected = user.id === currentUser.id;
                  return (
                    <button
                      key={user.id}
                      onClick={() => {
                        onSwitchUser(user);
                        setRoleModalOpen(false);
                      }}
                      className={`flex items-start space-x-3.5 p-3.5 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'bg-[#EBF5F1] border-[#236B50] shadow-sm ring-1 ring-[#236B50]'
                          : 'bg-white border-[#E5EFEA] hover:bg-[#F9FCFA] hover:border-[#CADBD2]'
                      }`}
                    >
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#192A24] text-sm">{user.name}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRoleBadgeColor(user.role)}`}>
                            {user.role.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-[#52685F] font-medium truncate">{user.title}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 bg-[#F6FAF8] border-t border-[#E5EFEA] flex justify-end">
              <button
                onClick={() => setRoleModalOpen(false)}
                className="px-5 py-2 bg-[#236B50] hover:bg-[#1E5C45] text-white text-xs font-bold rounded-full transition-colors shadow-sm cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
