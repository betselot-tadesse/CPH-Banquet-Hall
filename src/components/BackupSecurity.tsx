import React, { useState, useRef, useMemo } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Key, 
  FileText, 
  Users, 
  Database,
  History,
  Sparkles,
  Cloud,
  ChefHat,
  Calculator,
  Search,
  Filter,
  ArrowRight,
  Receipt,
  FileCheck,
  Building,
  Clock
} from 'lucide-react';
import { BackupRecord, AuditLog, UserProfile, UserRole, BookingEvent } from '../types';
import { AppStorage } from '../services/storage';

interface BackupSecurityProps {
  backups: BackupRecord[];
  auditLogs: AuditLog[];
  allUsers: UserProfile[];
  currentUser: UserProfile;
  bookings?: BookingEvent[];
  onRefreshState: () => void;
}

type SubTabType = 
  | 'chef_vouchers' 
  | 'chef_audit' 
  | 'accounts_costings' 
  | 'accounts_payments'
  | 'accounts_audit' 
  | 'backups' 
  | 'users_rbac' 
  | 'audit_log';

export const BackupSecurity: React.FC<BackupSecurityProps> = ({
  backups,
  auditLogs,
  allUsers,
  currentUser,
  bookings = [],
  onRefreshState,
}) => {
  const isChef = currentUser.role === 'executive_chef';
  const isAccounts = currentUser.role === 'accounts_executive';
  const isGM = currentUser.role === 'general_manager' || currentUser.role === 'marketing_executive';

  const [activeSubTab, setActiveSubTab] = useState<SubTabType>(() => {
    if (isChef) return 'chef_vouchers';
    if (isAccounts) return 'accounts_costings';
    return 'audit_log';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState<string | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<{ success: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger Encrypted Cloud Backup
  const handleTriggerBackup = () => {
    setIsBackingUp(true);
    setBackupSuccessMessage(null);

    setTimeout(() => {
      const record = AppStorage.createEncryptedBackup(currentUser.name);
      setIsBackingUp(false);
      setBackupSuccessMessage(`Encrypted snapshot generated successfully (SHA-256: ${record.sha256Hash.substring(0, 18)}...) and synced to cloud vault.`);
      onRefreshState();
    }, 900);
  };

  // Download Encrypted File
  const handleDownloadVaultFile = () => {
    const { blob, filename } = AppStorage.exportEncryptedFile();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Restore from file
  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = AppStorage.restoreFromEncryptedJson(content);
      if (res.success) {
        setRestoreMessage({ success: true, text: res.message });
        setTimeout(() => {
          onRefreshState();
        }, 1000);
      } else {
        setRestoreMessage({ success: false, text: res.message });
      }
    };
    reader.readAsText(file);
  };

  // -------------------------------------------------------------
  // Filtered Data Sets for Chef & Accounts Logs History
  // -------------------------------------------------------------

  // Chef's completed kitchen ingredient usage vouchers
  const chefCompletedParties = useMemo(() => {
    return bookings.filter(b => 
      (b.chefPartyEntries && b.chefPartyEntries.length > 0) || 
      b.chefUsageLogged || 
      b.chefApproved ||
      b.costingStatus === 'forwarded_to_accounts' ||
      b.costingStatus === 'costed_by_arun'
    ).sort((a, b) => {
      const timeA = new Date(a.chefApprovedAt || a.eventDate).getTime();
      const timeB = new Date(b.chefApprovedAt || b.eventDate).getTime();
      return timeB - timeA; // Most recent first
    });
  }, [bookings]);

  // Accounts' costed banquet parties & GL posting reports
  const accountsCostedParties = useMemo(() => {
    return bookings.filter(b => 
      b.costingStatus === 'costed_by_arun' || 
      b.arunCostedAt || 
      b.postingReportGenerated ||
      b.arunApproved
    ).sort((a, b) => {
      const timeA = new Date(a.arunCostedAt || a.eventDate).getTime();
      const timeB = new Date(b.arunCostedAt || b.eventDate).getTime();
      return timeB - timeA; // Most recent first
    });
  }, [bookings]);

  // All recorded payments / cash receipts
  const allPaymentRecords = useMemo(() => {
    const list: { booking: BookingEvent; payment: any }[] = [];
    bookings.forEach(b => {
      if (b.payments && b.payments.length > 0) {
        b.payments.forEach(p => {
          list.push({ booking: b, payment: p });
        });
      }
    });
    return list.sort((a, b) => new Date(b.payment.createdAt || b.payment.date).getTime() - new Date(a.payment.createdAt || a.payment.date).getTime());
  }, [bookings]);

  // Audit logs filtered by Chef Karim
  const chefAuditLogs = useMemo(() => {
    return auditLogs.filter(l => 
      l.userName.toLowerCase().includes('karim') || 
      l.category === 'Inventory' || 
      (l.category === 'Costing' && (l.action.toLowerCase().includes('chef') || l.action.toLowerCase().includes('recipe')))
    );
  }, [auditLogs]);

  // Audit logs filtered by Arun Kumar
  const accountsAuditLogs = useMemo(() => {
    return auditLogs.filter(l => 
      l.userName.toLowerCase().includes('arun') || 
      l.category === 'Invoice' || 
      (l.category === 'Costing' && (l.action.toLowerCase().includes('account') || l.action.toLowerCase().includes('gl') || l.action.toLowerCase().includes('price')))
    );
  }, [auditLogs]);

  // Search filtered master audit logs
  const filteredMasterAuditLogs = useMemo(() => {
    if (!searchQuery.trim()) return auditLogs;
    const q = searchQuery.toLowerCase();
    return auditLogs.filter(l => 
      l.action.toLowerCase().includes(q) ||
      l.userName.toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q) ||
      l.category.toLowerCase().includes(q)
    );
  }, [auditLogs, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#192A24] font-['Plus_Jakarta_Sans'] flex items-center space-x-2.5">
            {isChef ? (
              <ChefHat className="w-6 h-6 text-amber-700" />
            ) : isAccounts ? (
              <Calculator className="w-6 h-6 text-purple-700" />
            ) : (
              <ShieldCheck className="w-6 h-6 text-[#236B50]" />
            )}
            <span>
              {isChef
                ? 'Chef Karim — Kitchen Logs & Voucher History'
                : isAccounts
                ? 'Arun Kumar — Accounts Costing & GL Logs History'
                : 'System Vault, RBAC & Complete Audit Logs'}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[#5A6F66] mt-0.5">
            {isChef
              ? 'Complete historical ledger of all kitchen usage vouchers, ingredient quantities logged, and official seals.'
              : isAccounts
              ? 'Complete historical ledger of finalized purchasing costings, GL posting reports, and payment audit logs.'
              : 'AES-256-GCM encrypted database snapshots, SHA-256 integrity checks, and immutable multi-department audit logs.'}
          </p>
        </div>

        {/* Sub-tab Switcher: tailored specifically for each role */}
        <div className="bg-[#EBF3EF] p-1 rounded-2xl border border-[#D5E5DE] flex flex-wrap gap-1 text-xs font-semibold self-start sm:self-auto">
          {isChef && (
            <>
              <button
                onClick={() => setActiveSubTab('chef_vouchers')}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeSubTab === 'chef_vouchers'
                    ? 'bg-amber-600 text-white font-black shadow-xs'
                    : 'text-[#3D5A4E] hover:text-[#192A24]'
                }`}
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>Kitchen Usage Vouchers ({chefCompletedParties.length})</span>
              </button>
              <button
                onClick={() => setActiveSubTab('chef_audit')}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeSubTab === 'chef_audit'
                    ? 'bg-amber-600 text-white font-black shadow-xs'
                    : 'text-[#3D5A4E] hover:text-[#192A24]'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>My Chef Activity Logs ({chefAuditLogs.length})</span>
              </button>
              <button
                onClick={() => setActiveSubTab('audit_log')}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeSubTab === 'audit_log'
                    ? 'bg-[#236B50] text-white font-bold shadow-xs'
                    : 'text-[#3D5A4E] hover:text-[#192A24]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Hotel Audit Trail</span>
              </button>
            </>
          )}

          {isAccounts && (
            <>
              <button
                onClick={() => setActiveSubTab('accounts_costings')}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeSubTab === 'accounts_costings'
                    ? 'bg-purple-700 text-white font-black shadow-xs'
                    : 'text-[#3D5A4E] hover:text-[#192A24]'
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Costing & GL Postings ({accountsCostedParties.length})</span>
              </button>
              <button
                onClick={() => setActiveSubTab('accounts_payments')}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeSubTab === 'accounts_payments'
                    ? 'bg-purple-700 text-white font-black shadow-xs'
                    : 'text-[#3D5A4E] hover:text-[#192A24]'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Cash Receipts & Payments ({allPaymentRecords.length})</span>
              </button>
              <button
                onClick={() => setActiveSubTab('accounts_audit')}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeSubTab === 'accounts_audit'
                    ? 'bg-purple-700 text-white font-black shadow-xs'
                    : 'text-[#3D5A4E] hover:text-[#192A24]'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>My Accounts Logs ({accountsAuditLogs.length})</span>
              </button>
              <button
                onClick={() => setActiveSubTab('audit_log')}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeSubTab === 'audit_log'
                    ? 'bg-[#236B50] text-white font-bold shadow-xs'
                    : 'text-[#3D5A4E] hover:text-[#192A24]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Hotel Audit Trail</span>
              </button>
            </>
          )}

          {isGM && (
            <>
              <button
                onClick={() => setActiveSubTab('audit_log')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeSubTab === 'audit_log'
                    ? 'bg-[#236B50] text-white font-bold shadow-xs'
                    : 'text-[#3D5A4E] hover:text-[#192A24]'
                }`}
              >
                Master Audit Trail
              </button>
              <button
                onClick={() => setActiveSubTab('chef_vouchers')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1 ${
                  activeSubTab === 'chef_vouchers'
                    ? 'bg-amber-600 text-white font-bold shadow-xs'
                    : 'text-[#3D5A4E] hover:text-[#192A24]'
                }`}
              >
                <ChefHat className="w-3 h-3" />
                <span>Chef Kitchen Logs</span>
              </button>
              <button
                onClick={() => setActiveSubTab('accounts_costings')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1 ${
                  activeSubTab === 'accounts_costings'
                    ? 'bg-purple-700 text-white font-bold shadow-xs'
                    : 'text-[#3D5A4E] hover:text-[#192A24]'
                }`}
              >
                <Calculator className="w-3 h-3" />
                <span>Accounts Costing Logs</span>
              </button>
              <button
                onClick={() => setActiveSubTab('backups')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeSubTab === 'backups'
                    ? 'bg-[#236B50] text-white font-bold shadow-xs'
                    : 'text-[#3D5A4E] hover:text-[#192A24]'
                }`}
              >
                Encrypted Backups
              </button>
              <button
                onClick={() => setActiveSubTab('users_rbac')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeSubTab === 'users_rbac'
                    ? 'bg-[#236B50] text-white font-bold shadow-xs'
                    : 'text-[#3D5A4E] hover:text-[#192A24]'
                }`}
              >
                RBAC Access Roles
              </button>
            </>
          )}
        </div>
      </div>

      {/* =====================================================================
          CHEF SUBTAB 1: KITCHEN USAGE VOUCHERS LOG (Chef Karim's logs history)
          ===================================================================== */}
      {activeSubTab === 'chef_vouchers' && (
        <div className="bg-white border-2 border-amber-300 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-amber-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold">
                <ChefHat className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#192A24] text-base">
                  Executive Chef Karim Zayani — Kitchen Logs & Usage Vouchers History
                </h3>
                <p className="text-xs text-[#5A6F66]">
                  Signed and sealed kitchen vouchers with exact quantities consumed for each concluded banquet event.
                </p>
              </div>
            </div>
            <span className="text-xs font-black px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 self-start sm:self-auto">
              {chefCompletedParties.length} Completed Party Vouchers
            </span>
          </div>

          {chefCompletedParties.length === 0 ? (
            <div className="p-8 text-center bg-amber-50/50 rounded-2xl border border-amber-200 text-xs text-amber-900">
              No completed kitchen usage vouchers recorded yet. Once a party ends and Chef Karim logs ingredients, they will appear here.
            </div>
          ) : (
            <div className="space-y-4">
              {chefCompletedParties.map(party => {
                const entries = party.chefPartyEntries || [];
                const isForwarded = party.costingStatus === 'forwarded_to_accounts';
                const isCosted = party.costingStatus === 'costed_by_arun';

                return (
                  <div 
                    key={party.id}
                    className="border-2 border-[#E2ECE7] hover:border-amber-400 rounded-2xl p-4.5 bg-gradient-to-r from-white to-[#FDFBF7] shadow-xs space-y-3 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#E2ECE7]">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-black text-sm text-[#192A24]">{party.clientName}</span>
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                            {party.bookingNumber}
                          </span>
                          <span className="text-xs text-[#5A6F66] font-medium">
                            • {party.eventDate} ({party.timeSlot || 'Evening'}) • {party.guestCount} Guests • {party.hallName}
                          </span>
                        </div>
                        {party.selectedMenuName && (
                          <div className="text-[11px] text-amber-900 font-bold mt-0.5">
                            Menu: {party.selectedMenuName}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        {isCosted ? (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            <span>Priced by Accounts & GL Posted</span>
                          </span>
                        ) : isForwarded ? (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-amber-700" />
                            <span>Transmitted to Accounts (FIFO Queue)</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-blue-100 text-blue-900 border border-blue-300">
                            Chef Usage Logged
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Table of ingredients logged by Chef */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F8FAF9] text-[#5A6F66] font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">#</th>
                            <th className="py-2 px-3">Ingredient (Kitchen Stock Item)</th>
                            <th className="py-2 px-3">Amount Used (Quantity)</th>
                            <th className="py-2 px-3">Dish / Chafer</th>
                            <th className="py-2 px-3">Chef Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {entries.map((item, idx) => (
                            <tr key={item.id || idx} className="hover:bg-amber-50/20">
                              <td className="py-2 px-3 font-mono text-[10px] text-slate-400">{idx + 1}</td>
                              <td className="py-2 px-3 font-bold text-[#192A24]">{item.ingredient}</td>
                              <td className="py-2 px-3 font-mono font-black text-amber-900 bg-amber-50/50">
                                {item.amountUsed}
                              </td>
                              <td className="py-2 px-3 text-[#5A6F66]">{item.foodItemName || 'Banquet Chafers'}</td>
                              <td className="py-2 px-3 text-slate-500 italic text-[11px]">{item.notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer certification stamp */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-[#5A6F66] pt-1">
                      <div className="flex items-center space-x-1.5 font-medium">
                        <FileCheck className="w-3.5 h-3.5 text-amber-600" />
                        <span>Certified & Signed by <strong>Executive Chef Karim Zayani</strong></span>
                        {party.chefApprovedAt && <span>on {party.chefApprovedAt.replace('T', ' ').substring(0, 16)}</span>}
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">
                        {entries.length} raw ingredients consumed
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          ACCOUNTS SUBTAB 1: COSTING & GL POSTINGS LOG (Arun Kumar's logs history)
          ===================================================================== */}
      {activeSubTab === 'accounts_costings' && (
        <div className="bg-white border-2 border-purple-300 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-purple-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-700 text-white flex items-center justify-center font-bold">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#192A24] text-base">
                  Accounts Executive Arun Kumar — Costing & General Ledger History
                </h3>
                <p className="text-xs text-[#5A6F66]">
                  Complete log of priced banquet parties, purchase rates matched from Excel/OCR, and GL posting reports.
                </p>
              </div>
            </div>
            <span className="text-xs font-black px-3 py-1 rounded-full bg-purple-100 text-purple-950 border border-purple-300 self-start sm:self-auto">
              {accountsCostedParties.length} Finalized Costings
            </span>
          </div>

          {accountsCostedParties.length === 0 ? (
            <div className="p-8 text-center bg-purple-50/50 rounded-2xl border border-purple-200 text-xs text-purple-900">
              No finalized accounts costings recorded yet. When Arun Kumar approves prices and posts to GL, they will appear here.
            </div>
          ) : (
            <div className="space-y-4">
              {accountsCostedParties.map(party => {
                const entries = party.chefPartyEntries || [];
                const postNum = party.postingReportNumber || `CPH-GL-POST-${party.bookingNumber.replace(/[^0-9]/g, '')}`;

                return (
                  <div 
                    key={party.id}
                    className="border-2 border-purple-200 hover:border-purple-400 rounded-2xl p-4.5 bg-gradient-to-r from-white to-[#FAF8FC] shadow-xs space-y-3 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-purple-100">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-black text-sm text-[#192A24]">{party.clientName}</span>
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-extrabold">
                            {postNum}
                          </span>
                          <span className="text-xs text-[#5A6F66]">
                            • Booking: <strong>{party.bookingNumber}</strong> ({party.eventDate}) • {party.guestCount} Guests
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-black px-3 py-1 rounded-xl bg-[#236B50] text-white shadow-xs">
                          Total Food Cost: AED {(party.foodCostActualTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] font-black px-2 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                          GL Locked
                        </span>
                      </div>
                    </div>

                    {/* Table of costed entries */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F8FAF9] text-[#5A6F66] font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Ingredient</th>
                            <th className="py-2 px-3">Chef Amount (Locked)</th>
                            <th className="py-2 px-3">Purchasing Unit Price</th>
                            <th className="py-2 px-3 text-right">Computed Cost</th>
                            <th className="py-2 px-3">Price Source</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {entries.map((item, idx) => (
                            <tr key={item.id || idx} className="hover:bg-purple-50/20">
                              <td className="py-2 px-3 font-bold text-[#192A24]">{item.ingredient}</td>
                              <td className="py-2 px-3 font-mono text-slate-700 font-semibold">{item.amountUsed}</td>
                              <td className="py-2 px-3 font-mono font-bold text-purple-900">
                                AED {Number(item.purchasingPriceAED || 0).toFixed(2)} / {item.purchasingUnit || 'unit'}
                              </td>
                              <td className="py-2 px-3 font-mono font-black text-right text-[#236B50]">
                                AED {Number(item.calculatedCostAED || 0).toFixed(2)}
                              </td>
                              <td className="py-2 px-3">
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                  {item.priceSource === 'excel_sheet' ? 'Excel Matched' : item.priceSource === 'ocr_scan' ? 'OCR Invoice' : 'Manual Arun'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-[#5A6F66] pt-1">
                      <div className="flex items-center space-x-1.5 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-700" />
                        <span>GL Posting finalized by <strong>Arun Kumar (Accounts Executive)</strong></span>
                        {party.arunCostedAt && <span>on {party.arunCostedAt.replace('T', ' ').substring(0, 16)}</span>}
                      </div>
                      {party.arunAccountsNotes && (
                        <span className="italic text-slate-500">Note: "{party.arunAccountsNotes}"</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          ACCOUNTS SUBTAB 2: PAYMENT & CASH RECEIPTS LOG
          ===================================================================== */}
      {activeSubTab === 'accounts_payments' && (
        <div className="bg-white border-2 border-purple-300 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-purple-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-bold">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#192A24] text-base">
                  Client Payments & Cash Balance Receipts Ledger
                </h3>
                <p className="text-xs text-[#5A6F66]">
                  Record of all advance deposits and post-party cash balance settlements collected.
                </p>
              </div>
            </div>
            <span className="text-xs font-black px-3 py-1 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 self-start sm:self-auto">
              {allPaymentRecords.length} Recorded Receipts
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAF9] text-[#5A6F66] font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Client & Booking</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Received By</th>
                  <th className="py-3 px-4 text-right">Amount (AED)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allPaymentRecords.map(({ booking, payment }) => (
                  <tr key={payment.id} className="hover:bg-[#F6FAF8] transition-colors">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-800">{payment.receiptNumber}</td>
                    <td className="py-2.5 px-4 text-slate-500">{payment.date}</td>
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-[#192A24]">{booking.clientName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{booking.bookingNumber}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        payment.paymentType === 'balance' 
                          ? 'bg-rose-100 text-rose-900 border border-rose-300' 
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      }`}>
                        {payment.paymentType}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-700">{payment.paymentMode || 'Cash'}</td>
                    <td className="py-2.5 px-4 text-slate-600">{payment.receivedBy || "Francis D'Souza"}</td>
                    <td className="py-2.5 px-4 font-mono font-black text-right text-[#236B50]">
                      AED {Number(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          ROLE-FILTERED AUDIT LOGS: CHEF KARIM ONLY
          ===================================================================== */}
      {activeSubTab === 'chef_audit' && (
        <div className="bg-white border-2 border-amber-300 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-amber-200">
            <div>
              <h3 className="font-extrabold text-[#192A24] text-base">
                Chef Karim Zayani — Action & Certification History
              </h3>
              <p className="text-xs text-[#5A6F66]">
                Chronological security trail of ingredients logged, recipes created, and kitchen seals applied.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-900">
              {chefAuditLogs.length} Chef Logged Events
            </span>
          </div>

          <div className="border border-[#E2ECE7] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAF9] text-[#5A6F66] border-b border-[#E2ECE7] sticky top-0 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Staff</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2ECE7]">
                  {chefAuditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-amber-50/20 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-[#5A6F66] text-[11px] whitespace-nowrap">
                        {log.timestamp.replace('T', ' ').substring(0, 19)}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-[#192A24]">{log.action}</td>
                      <td className="py-2.5 px-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          {log.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-[#192A24]">{log.userName}</td>
                      <td className="py-2.5 px-4 text-[#5A6F66]">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ROLE-FILTERED AUDIT LOGS: ARUN KUMAR ONLY
          ===================================================================== */}
      {activeSubTab === 'accounts_audit' && (
        <div className="bg-white border-2 border-purple-300 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-purple-200">
            <div>
              <h3 className="font-extrabold text-[#192A24] text-base">
                Arun Kumar — Accounts & GL Certification History
              </h3>
              <p className="text-xs text-[#5A6F66]">
                Chronological financial trail of purchasing rates verified, GL costings approved, and client invoices.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-100 text-purple-900">
              {accountsAuditLogs.length} Accounts Logged Events
            </span>
          </div>

          <div className="border border-[#E2ECE7] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAF9] text-[#5A6F66] border-b border-[#E2ECE7] sticky top-0 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Staff</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2ECE7]">
                  {accountsAuditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-purple-50/20 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-[#5A6F66] text-[11px] whitespace-nowrap">
                        {log.timestamp.replace('T', ' ').substring(0, 19)}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-[#192A24]">{log.action}</td>
                      <td className="py-2.5 px-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300">
                          {log.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-[#192A24]">{log.userName}</td>
                      <td className="py-2.5 px-4 text-[#5A6F66]">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          HOTEL MASTER AUDIT TRAIL (Available to all roles)
          ===================================================================== */}
      {activeSubTab === 'audit_log' && (
        <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2ECE7]">
            <div>
              <h3 className="font-extrabold text-[#192A24] text-base">Hotel Operations & Security Master Audit Trail</h3>
              <p className="text-xs text-[#5A6F66]">
                Immutable chronological log of banquet bookings, chef vouchers, accounts GL postings, and client payments.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs by keyword..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#236B50]"
              />
            </div>
          </div>

          <div className="border border-[#E2ECE7] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-[550px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAF9] text-[#5A6F66] border-b border-[#E2ECE7] sticky top-0 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Staff User</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2ECE7]">
                  {filteredMasterAuditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-[#F6FAF8] transition-colors">
                      <td className="py-2.5 px-4 font-mono text-[#5A6F66] text-[11px] whitespace-nowrap">
                        {log.timestamp.replace('T', ' ').substring(0, 19)}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-[#192A24]">{log.action}</td>
                      <td className="py-2.5 px-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EBF3EF] text-[#284B3D] border border-[#D5E5DE]">
                          {log.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-[#192A24]">{log.userName}</td>
                      <td className="py-2.5 px-4 text-[#5A6F66]">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          GENERAL MANAGER / ADMIN SUBTABS: BACKUPS & RBAC
          ===================================================================== */}
      {isGM && activeSubTab === 'backups' && (
        <div className="space-y-6">
          {/* Cloud Vault Status Card */}
          <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E2ECE7]">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#E8F5EE] text-[#236B50] flex items-center justify-center border border-[#C5E5D5]">
                  <Cloud className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#236B50]"></span>
                    <h2 className="text-lg font-extrabold text-[#192A24]">Encrypted Cloud Backup Vault</h2>
                  </div>
                  <p className="text-xs text-[#5A6F66] mt-0.5">
                    Military-grade AES-256 client-side encryption. Banquets, recipe costings, and billing records.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleTriggerBackup}
                  disabled={isBackingUp}
                  className="flex items-center space-x-2 px-4 py-2.5 rounded-full bg-[#236B50] hover:bg-[#1C5740] active:scale-98 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-[#236B50]/20 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isBackingUp ? 'animate-spin' : ''}`} />
                  <span>{isBackingUp ? 'Encrypting Database...' : 'Backup Database Now'}</span>
                </button>

                <button
                  onClick={handleDownloadVaultFile}
                  className="flex items-center space-x-1.5 px-4 py-2.5 rounded-full bg-[#EBF3EF] hover:bg-[#DEEBE5] text-[#236B50] text-xs font-bold transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .enc Vault File</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-1.5 px-4 py-2.5 rounded-full bg-[#EBF3EF] hover:bg-[#DEEBE5] text-[#236B50] text-xs font-bold transition-all cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Restore from Backup</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileRestore}
                  accept=".json"
                  className="hidden"
                />
              </div>
            </div>

            {/* Notification messages */}
            {backupSuccessMessage && (
              <div className="mt-4 p-3.5 rounded-2xl bg-[#E8F5EE] border border-[#C5E5D5] text-[#1D6047] text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{backupSuccessMessage}</span>
              </div>
            )}

            {restoreMessage && (
              <div className={`mt-4 p-3.5 rounded-2xl border text-xs flex items-center space-x-2 ${
                restoreMessage.success
                  ? 'bg-[#E8F5EE] border-[#C5E5D5] text-[#1D6047]'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}>
                {restoreMessage.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{restoreMessage.text}</span>
              </div>
            )}

            {/* Snapshot History Table */}
            <div className="mt-6 space-y-3">
              <h3 className="text-xs font-bold text-[#192A24] uppercase tracking-wider">
                Recent Encrypted Snapshot History
              </h3>

              <div className="border border-[#E2ECE7] rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAF9] text-[#5A6F66] border-b border-[#E2ECE7] font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Encryption Type</th>
                      <th className="py-3 px-4">SHA-256 Checksum</th>
                      <th className="py-3 px-4">Payload Size</th>
                      <th className="py-3 px-4">Initiated By</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2ECE7]">
                    {backups.map(b => (
                      <tr key={b.id} className="hover:bg-[#F6FAF8] transition-colors">
                        <td className="py-3 px-4 font-mono text-[#192A24] font-semibold">{b.timestamp}</td>
                        <td className="py-3 px-4 text-[#5A6F66] font-medium">{b.encryptionAlgorithm}</td>
                        <td className="py-3 px-4 font-mono text-xs text-[#236B50]">
                          {b.sha256Hash.substring(0, 16)}...
                        </td>
                        <td className="py-3 px-4 font-mono text-[#5A6F66]">
                          {(b.sizeBytes / 1024).toFixed(1)} KB
                        </td>
                        <td className="py-3 px-4 text-[#192A24] font-medium">{b.initiatedBy}</td>
                        <td className="py-3 px-4">
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#E8F5EE] text-[#1D6047] border border-[#C5E5D5]">
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {isGM && activeSubTab === 'users_rbac' && (
        <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="font-extrabold text-[#192A24] text-base">Role-Based Access Control (RBAC) Matrix</h3>
            <p className="text-xs text-[#5A6F66]">
              Granular permission enforcement across General Management, Banquet Sales, Executive Chefs, and Accounts.
            </p>
          </div>

          <div className="border border-[#E2ECE7] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAF9] text-[#5A6F66] border-b border-[#E2ECE7] font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Role & User Profile</th>
                    <th className="py-3 px-4 text-center">View Profit %</th>
                    <th className="py-3 px-4 text-center">Manage Bookings</th>
                    <th className="py-3 px-4 text-center text-amber-900 font-extrabold">Enter Ingredients & Usage (Chef Only)</th>
                    <th className="py-3 px-4 text-center">Food Inventory</th>
                    <th className="py-3 px-4 text-center">Issue Invoices</th>
                    <th className="py-3 px-4 text-center">Cloud Backups</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2ECE7]">
                  {allUsers.map(user => (
                    <tr key={user.id} className="hover:bg-[#F6FAF8] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover border border-[#D5E5DE]" />
                          <div>
                            <div className="font-bold text-[#192A24]">{user.name}</div>
                            <div className="text-[11px] text-[#5A6F66]">{user.title}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {user.permissions.canViewProfits ? <span className="text-[#236B50] font-bold">✓</span> : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {user.permissions.canManageBookings ? <span className="text-[#236B50] font-bold">✓</span> : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {user.permissions.canLogChefUsage ? <span className="text-[#236B50] font-bold">✓</span> : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {user.permissions.canManageInventory ? <span className="text-[#236B50] font-bold">✓</span> : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {user.permissions.canGenerateInvoices ? <span className="text-[#236B50] font-bold">✓</span> : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {user.permissions.canAccessBackups ? <span className="text-[#236B50] font-bold">✓</span> : <span className="text-slate-300">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
