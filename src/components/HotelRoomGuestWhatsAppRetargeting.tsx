import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  Upload, 
  Send, 
  Sparkles, 
  Download, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileSpreadsheet, 
  Image as ImageIcon, 
  Phone, 
  User, 
  Building, 
  Tag, 
  Copy, 
  Check, 
  ChevronRight, 
  ExternalLink, 
  RefreshCw, 
  Plus, 
  X, 
  Layers, 
  DollarSign, 
  Calendar,
  Percent,
  Sliders,
  Code2,
  FileCode,
  Save,
  RotateCcw,
  CheckCheck,
  ShieldCheck,
  Info
} from 'lucide-react';
import { 
  HotelRoomGuest, 
  WhatsAppRetargetingOffer, 
  GuestSegmentCategory, 
  RetargetingStatus, 
  UserProfile, 
  WhatsAppMessageTemplate 
} from '../types';
import { 
  INITIAL_HOTEL_ROOM_GUESTS, 
  INITIAL_WHATSAPP_OFFERS, 
  INITIAL_WHATSAPP_TEMPLATES 
} from '../data/initialData';
import { StorageService } from '../services/storage';
import { formatCurrency } from '../utils/costCalculations';

interface HotelRoomGuestWhatsAppRetargetingProps {
  currentUser: UserProfile;
}

// Available Dynamic Placeholders for Template Editor
const DYNAMIC_PLACEHOLDERS = [
  { tag: '{guest_name}', label: 'Guest Name', desc: 'e.g. Sheikh Mansoor Al-Ketbi' },
  { tag: '{room_number}', label: 'Room #', desc: 'e.g. 801' },
  { tag: '{room_type}', label: 'Room Type', desc: 'e.g. Royal Penthouse Suite' },
  { tag: '{offer_headline}', label: 'Offer Headline', desc: 'Main promotional hook' },
  { tag: '{offer_description}', label: 'Offer Description', desc: 'Full offer narrative' },
  { tag: '{offer_perks}', label: 'Offer Perks', desc: 'Bullet list of privileges' },
  { tag: '{offer_title}', label: 'Offer Title', desc: 'Short package title' },
  { tag: '{promo_code}', label: 'Promo Code', desc: 'e.g. CPH-FREEHALL-GUEST' },
  { tag: '{discount_value}', label: 'Discount Value', desc: 'e.g. Free Hall (Save 1,500 AED)' },
  { tag: '{valid_until}', label: 'Valid Until', desc: 'e.g. 31 Dec 2026' },
  { tag: '{photo_url}', label: 'Photo Flyer URL', desc: 'High-res image link' },
  { tag: '{hotel_phone}', label: 'Hotel Phone', desc: '+971 6 572 2444' },
  { tag: '{nights}', label: 'Nights Stayed', desc: 'e.g. 4' },
  { tag: '{check_in_date}', label: 'Check-in Date', desc: 'e.g. 2026-10-02' },
  { tag: '{check_out_date}', label: 'Check-out Date', desc: 'e.g. 2026-10-06' },
  { tag: '{guest_category}', label: 'Guest Segment', desc: 'e.g. VIP, Corporate' },
  { tag: '{city_country}', label: 'City / Origin', desc: 'e.g. Abu Dhabi, UAE' },
];

/**
 * Sanitizes message string to eliminate broken symbols (like replacement char )
 * and fixes WhatsApp asterisk markdown parsing issues.
 */
export function sanitizeWhatsAppText(raw: string, formattingMode: 'clean' | 'whatsapp_bold'): string {
  if (!raw) return '';

  let cleaned = raw
    .normalize('NFC')
    // Remove Unicode variation selectors (\uFE00 - \uFE0F) that break into  in URL decoders
    .replace(/[\uFE00-\uFE0F]/g, '')
    // Remove zero-width characters and replacement characters
    .replace(/[\u200B-\u200D\uFEFF\uFFFD]/g, '');

  if (formattingMode === 'clean') {
    // Strip all asterisks completely so no raw stars appear in WhatsApp
    cleaned = cleaned.replace(/\*/g, '');
  } else {
    // Ensure asterisks have proper spacing for WhatsApp bold parser:
    // 1. Remove double adjacent asterisks: **text** -> *text*
    cleaned = cleaned.replace(/\*{2,}/g, '*');
    // 2. Fix patterns like *Title:* *Code* -> *Title:* Code or Title: *Code*
    cleaned = cleaned.replace(/\*([^*]+):\*\s*\*([^*]+)\*/g, '$1: *$2*');
    // 3. Ensure no trailing asterisks attached to colons without space: e.g. *Code:*Value -> *Code:* Value
    cleaned = cleaned.replace(/\*([^*]+):\*([^\s])/g, '*$1:* $2');
  }

  return cleaned.trim();
}

export const HotelRoomGuestWhatsAppRetargeting: React.FC<HotelRoomGuestWhatsAppRetargetingProps> = ({
  currentUser,
}) => {
  // 1. Data states
  const [guests, setGuests] = useState<HotelRoomGuest[]>(() => StorageService.getHotelRoomGuests());
  const [offers, setOffers] = useState<WhatsAppRetargetingOffer[]>(() => StorageService.getWhatsAppOffers());
  const [templates, setTemplates] = useState<WhatsAppMessageTemplate[]>(() => StorageService.getWhatsAppTemplates());

  // 2. Selection states
  const [selectedOfferId, setSelectedOfferId] = useState<string>(offers[0]?.id || 'off_free_hall');
  const selectedOffer = useMemo(() => {
    return offers.find(o => o.id === selectedOfferId) || offers[0];
  }, [offers, selectedOfferId]);

  const [activeGuestId, setActiveGuestId] = useState<string>(guests[0]?.id || '');
  const activeGuest = useMemo(() => {
    return guests.find(g => g.id === activeGuestId) || guests[0] || null;
  }, [guests, activeGuestId]);

  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(new Set());

  // 3. Template Editor States
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    templates.find(t => t.isDefault)?.id || templates[0]?.id || 'tpl_banquet_celebration'
  );
  const activeTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateId) || templates[0];
  }, [templates, selectedTemplateId]);

  const [customTemplateText, setCustomTemplateText] = useState<string>(activeTemplate?.content || '');
  const [showTemplateEditor, setShowTemplateEditor] = useState<boolean>(true);
  const [formattingMode, setFormattingMode] = useState<'clean' | 'whatsapp_bold'>('clean');
  const [autoCopyOnSend, setAutoCopyOnSend] = useState<boolean>(true);

  // Sync customTemplateText when switching templates
  useEffect(() => {
    if (activeTemplate) {
      setCustomTemplateText(activeTemplate.content);
    }
  }, [selectedTemplateId]);

  // Ref to template textarea for placeholder insertion at cursor position
  const templateTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 4. Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // 5. Modals & Notifications
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showAddGuestModal, setShowAddGuestModal] = useState<boolean>(false);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  // 6. CSV/Excel Import Raw Text
  const [importRawText, setImportRawText] = useState<string>('');
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 7. New Guest Form State
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestPhone, setNewGuestPhone] = useState('');
  const [newGuestRoom, setNewGuestRoom] = useState('');
  const [newGuestRoomType, setNewGuestRoomType] = useState('Executive King Room');
  const [newGuestCheckIn, setNewGuestCheckIn] = useState('2026-10-15');
  const [newGuestCheckOut, setNewGuestCheckOut] = useState('2026-10-18');
  const [newGuestCategory, setNewGuestCategory] = useState<GuestSegmentCategory>('VIP');
  const [newGuestCity, setNewGuestCity] = useState('Dubai, UAE');
  const [newGuestSpend, setNewGuestSpend] = useState<number>(3000);

  // Save changes to storage whenever guests update
  const updateGuestsList = (newList: HotelRoomGuest[]) => {
    setGuests(newList);
    StorageService.saveHotelRoomGuests(newList);
  };

  // Helper to sanitize international phone number for WhatsApp wa.me link
  const sanitizePhoneNumber = (raw: string): string => {
    let cleaned = raw.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('05') && cleaned.length === 10) {
      cleaned = '971' + cleaned.substring(1);
    } else if (cleaned.startsWith('00')) {
      cleaned = cleaned.substring(2);
    }
    return cleaned;
  };

  /**
   * Compiles the dynamic template by replacing all {placeholders} with real guest & offer data,
   * then applies Unicode and formatting sanitization to prevent broken characters & raw stars.
   */
  const compileMessage = (
    templateStr: string,
    guest: HotelRoomGuest | null,
    offer: WhatsAppRetargetingOffer | null,
    mode: 'clean' | 'whatsapp_bold'
  ): string => {
    if (!guest || !offer) return '';

    const perkBullet = mode === 'clean' ? '- ' : '• ';
    const perksText = offer.perks.map(p => `${perkBullet}${p}`).join('\n');

    let output = templateStr
      .replace(/{guest_name}/g, guest.name)
      .replace(/{room_number}/g, guest.roomNumber)
      .replace(/{room_type}/g, guest.roomType || 'Executive Suite')
      .replace(/{check_in_date}/g, guest.checkInDate || 'October 2026')
      .replace(/{check_out_date}/g, guest.checkOutDate || 'October 2026')
      .replace(/{nights}/g, String(guest.nights || 3))
      .replace(/{total_spend}/g, `${formatCurrency(guest.totalSpendAED)}`)
      .replace(/{guest_category}/g, guest.guestCategory || 'Valued Guest')
      .replace(/{city_country}/g, guest.cityOrCountry || 'GCC / UAE')
      .replace(/{offer_title}/g, offer.title)
      .replace(/{offer_headline}/g, offer.headline)
      .replace(/{offer_description}/g, offer.description)
      .replace(/{offer_perks}/g, perksText)
      .replace(/{promo_code}/g, offer.promoCode)
      .replace(/{discount_value}/g, offer.discountValue)
      .replace(/{valid_until}/g, offer.validUntil)
      .replace(/{photo_url}/g, offer.photoUrl)
      .replace(/{hotel_phone}/g, '+971 6 572 2444');

    return sanitizeWhatsAppText(output, mode);
  };

  // Real-time compiled preview for active guest
  const previewMessage = useMemo(() => {
    return compileMessage(customTemplateText, activeGuest, selectedOffer, formattingMode);
  }, [customTemplateText, activeGuest, selectedOffer, formattingMode]);

  // Insert dynamic placeholder at cursor position in template editor
  const handleInsertPlaceholder = (tag: string) => {
    const textarea = templateTextareaRef.current;
    if (!textarea) {
      setCustomTemplateText(prev => prev + ' ' + tag);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = customTemplateText;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    const nextText = before + tag + after;
    setCustomTemplateText(nextText);

    // Reposition cursor right after inserted tag
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  // Save modified template
  const handleSaveTemplate = () => {
    const updated = templates.map(t => {
      if (t.id === selectedTemplateId) {
        return { ...t, content: customTemplateText };
      }
      return t;
    });
    setTemplates(updated);
    StorageService.saveWhatsAppTemplates(updated);
    setCopiedNotification('✓ Template saved successfully!');
    setTimeout(() => setCopiedNotification(null), 3000);
  };

  // Reset template to default pre-defined content
  const handleResetTemplate = () => {
    const initial = INITIAL_WHATSAPP_TEMPLATES.find(t => t.id === selectedTemplateId);
    if (initial) {
      setCustomTemplateText(initial.content);
      setCopiedNotification('Reset to pre-defined template default.');
      setTimeout(() => setCopiedNotification(null), 2500);
    }
  };

  // Primary Action: Click to open WhatsApp chat
  const handleSendWhatsApp = (guest: HotelRoomGuest) => {
    const cleanPhone = guest.cleanPhone || sanitizePhoneNumber(guest.phone);
    const message = compileMessage(customTemplateText, guest, selectedOffer, formattingMode);

    // Auto copy clean text to clipboard
    if (autoCopyOnSend) {
      navigator.clipboard.writeText(message);
      setCopiedNotification(`Opening WhatsApp for ${guest.name}! Clean message also copied to clipboard.`);
      setTimeout(() => setCopiedNotification(null), 4000);
    }

    const encoded = encodeURIComponent(message);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encoded}`;

    // Mark guest as sent
    const updated = guests.map(g => {
      if (g.id === guest.id) {
        return {
          ...g,
          status: 'sent' as RetargetingStatus,
          lastSentAt: new Date().toISOString(),
        };
      }
      return g;
    });
    updateGuestsList(updated);

    // Open WhatsApp Web or Mobile
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // Copy message text to clipboard
  const handleCopyMessage = () => {
    if (!previewMessage) return;
    navigator.clipboard.writeText(previewMessage);
    setCopiedNotification('Message copied to clipboard! Pristine text with 0 broken characters.');
    setTimeout(() => setCopiedNotification(null), 3000);
  };

  // Copy Photo URL to clipboard
  const handleCopyPhotoUrl = () => {
    if (!selectedOffer?.photoUrl) return;
    navigator.clipboard.writeText(selectedOffer.photoUrl);
    setCopiedNotification('Offer flyer photo URL copied to clipboard!');
    setTimeout(() => setCopiedNotification(null), 3000);
  };

  // Manual status update
  const handleUpdateStatus = (guestId: string, status: RetargetingStatus) => {
    const updated = guests.map(g => {
      if (g.id === guestId) {
        return { ...g, status, lastSentAt: status === 'sent' ? new Date().toISOString() : g.lastSentAt };
      }
      return g;
    });
    updateGuestsList(updated);
  };

  // Bulk Selection Handlers
  const handleToggleSelectAll = () => {
    if (selectedGuestIds.size === filteredGuests.length) {
      setSelectedGuestIds(new Set());
    } else {
      setSelectedGuestIds(new Set(filteredGuests.map(g => g.id)));
    }
  };

  const handleToggleSelectGuest = (id: string) => {
    const next = new Set(selectedGuestIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedGuestIds(next);
  };

  // Step through selected bulk queue
  const handleStepNextGuest = () => {
    const currentIndex = guests.findIndex(g => g.id === activeGuestId);
    if (currentIndex >= 0 && currentIndex < guests.length - 1) {
      setActiveGuestId(guests[currentIndex + 1].id);
    } else {
      setActiveGuestId(guests[0]?.id || '');
    }
  };

  // Parse CSV or Excel pasted text
  const handleParseCsvOrExcel = () => {
    if (!importRawText.trim()) {
      setImportStatusMessage('Please paste CSV or tab-separated text from Excel.');
      return;
    }

    try {
      const lines = importRawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return;

      const newParsedGuests: HotelRoomGuest[] = [];

      lines.forEach((line, index) => {
        if (index === 0 && (line.toLowerCase().includes('name') || line.toLowerCase().includes('phone') || line.toLowerCase().includes('room'))) {
          return;
        }

        const parts = line.includes('\t') ? line.split('\t') : line.split(',');
        if (parts.length >= 2) {
          const name = parts[0]?.replace(/"/g, '').trim();
          const phone = parts[1]?.replace(/"/g, '').trim();
          const roomNumber = parts[2]?.replace(/"/g, '').trim() || '401';
          const roomType = parts[3]?.replace(/"/g, '').trim() || 'Executive Room';
          const checkIn = parts[4]?.replace(/"/g, '').trim() || '2026-10-12';
          const checkOut = parts[5]?.replace(/"/g, '').trim() || '2026-10-15';
          const spend = parseFloat(parts[6]?.replace(/[^0-9.]/g, '') || '2500') || 2500;
          const categoryRaw = parts[7]?.replace(/"/g, '').trim();

          let category: GuestSegmentCategory = 'VIP';
          if (categoryRaw?.toLowerCase().includes('corp')) category = 'Corporate Business';
          else if (categoryRaw?.toLowerCase().includes('family')) category = 'Family Leisure';
          else if (categoryRaw?.toLowerCase().includes('stay')) category = 'Weekend Staycation';
          else if (categoryRaw?.toLowerCase().includes('freq')) category = 'Frequent Stay';
          else if (categoryRaw?.toLowerCase().includes('honey')) category = 'Honeymoon & Couples';

          if (name && phone) {
            newParsedGuests.push({
              id: `gst_imp_${Date.now()}_${index}`,
              name,
              phone,
              cleanPhone: sanitizePhoneNumber(phone),
              roomNumber,
              roomType,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              nights: 3,
              totalSpendAED: spend,
              guestCategory: category,
              cityOrCountry: 'UAE / GCC',
              status: 'pending',
              notes: 'Imported from PMS room folio export.',
            });
          }
        }
      });

      if (newParsedGuests.length > 0) {
        const merged = [...newParsedGuests, ...guests];
        updateGuestsList(merged);
        setImportStatusMessage(`✓ Successfully imported ${newParsedGuests.length} hotel room guests! Ready for WhatsApp retargeting.`);
        setImportRawText('');
        setTimeout(() => setShowImportModal(false), 1500);
      } else {
        setImportStatusMessage('Could not detect valid Name and Phone columns. Please check your data format.');
      }
    } catch (e: any) {
      setImportStatusMessage(`Error parsing data: ${e.message}`);
    }
  };

  // Handle file upload (.csv or .txt)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportRawText(content);
        setImportStatusMessage(`Loaded file "${file.name}" (${(file.size / 1024).toFixed(1)} KB). Click "Extract & Import Room Guests" to process.`);
      }
    };
    reader.readAsText(file);
  };

  // Add single guest
  const handleAddSingleGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuestName.trim() || !newGuestPhone.trim()) return;

    const guest: HotelRoomGuest = {
      id: `gst_manual_${Date.now()}`,
      name: newGuestName.trim(),
      phone: newGuestPhone.trim(),
      cleanPhone: sanitizePhoneNumber(newGuestPhone),
      roomNumber: newGuestRoom.trim() || '502',
      roomType: newGuestRoomType,
      checkInDate: newGuestCheckIn,
      checkOutDate: newGuestCheckOut,
      nights: 3,
      totalSpendAED: newGuestSpend || 2500,
      guestCategory: newGuestCategory,
      cityOrCountry: newGuestCity.trim() || 'Dubai, UAE',
      status: 'pending',
      notes: 'Added via manual guest entry.',
    };

    updateGuestsList([guest, ...guests]);
    setActiveGuestId(guest.id);
    setShowAddGuestModal(false);
    setNewGuestName('');
    setNewGuestPhone('');
    setNewGuestRoom('');
  };

  // Reset to default 12 PMS room guests
  const handleResetSampleData = () => {
    if (window.confirm('Reset guest list to default PMS hotel room guests for Crystal Plaza?')) {
      updateGuestsList(INITIAL_HOTEL_ROOM_GUESTS);
      setActiveGuestId(INITIAL_HOTEL_ROOM_GUESTS[0]?.id || '');
    }
  };

  // Export retargeting campaign to CSV with UTF-8 BOM to prevent broken characters in Excel
  const handleExportCsv = () => {
    const headers = [
      'Guest Name', 
      'Phone', 
      'Clean Phone', 
      'Room Number', 
      'Room Type', 
      'Check-in', 
      'Check-out', 
      'Total Spend (AED)', 
      'Guest Category', 
      'Retargeting Status', 
      'Last Sent At', 
      'Notes'
    ];
    const rows = guests.map(g => [
      `"${g.name}"`,
      `"${g.phone}"`,
      `"${g.cleanPhone}"`,
      `"${g.roomNumber}"`,
      `"${g.roomType || ''}"`,
      `"${g.checkInDate}"`,
      `"${g.checkOutDate}"`,
      g.totalSpendAED,
      `"${g.guestCategory}"`,
      `"${g.status}"`,
      `"${g.lastSentAt || ''}"`,
      `"${(g.notes || '').replace(/"/g, '""')}"`,
    ]);

    // Prepend UTF-8 BOM \uFEFF to guarantee Excel displays all names & symbols correctly without 
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Crystal_Plaza_WhatsApp_Retargeting_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered guests
  const filteredGuests = useMemo(() => {
    return guests.filter(g => {
      const matchSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          g.phone.includes(searchTerm) ||
                          g.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (g.cityOrCountry && g.cityOrCountry.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCat = selectedCategory === 'all' || g.guestCategory === selectedCategory;
      const matchStatus = selectedStatus === 'all' || g.status === selectedStatus;
      return matchSearch && matchCat && matchStatus;
    });
  }, [guests, searchTerm, selectedCategory, selectedStatus]);

  // Aggregate Metrics
  const totalGuests = guests.length;
  const sentCount = guests.filter(g => g.status === 'sent' || g.status === 'responded' || g.status === 'converted').length;
  const pendingCount = guests.filter(g => g.status === 'pending').length;
  const respondedCount = guests.filter(g => g.status === 'responded' || g.status === 'converted').length;
  const convertedCount = guests.filter(g => g.status === 'converted').length;
  const totalSpendPipeline = guests.reduce((sum, g) => sum + g.totalSpendAED, 0);

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans']">
      {/* Toast Notification Banner */}
      {copiedNotification && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-[#192A24] text-white shadow-2xl flex items-center space-x-3 border border-[#236B50] animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{copiedNotification}</span>
        </div>
      )}

      {/* =====================================================================
          1. TOP EXECUTIVE HEADER & RETARGETING KPI METRICS
          ===================================================================== */}
      <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E2ECE7]">
          <div>
            <div className="flex items-center space-x-2 text-[#236B50] text-xs font-black uppercase tracking-wider">
              <MessageSquare className="w-4 h-4 text-[#236B50]" />
              <span>Marketing WhatsApp Retargeting Suite</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#192A24] mt-0.5 tracking-tight">
              Hotel Room Guests Retargeting & Direct WhatsApp Campaigns
            </h2>
            <p className="text-xs text-[#5A6F66] mt-0.5">
              Extract guest folios from PMS Excel/CSV, customize WhatsApp message templates with dynamic placeholders, and dispatch click-to-chat with zero broken characters.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-[#236B50] hover:bg-[#1C5740] text-white font-extrabold text-xs shadow-md transition-all flex items-center space-x-2 cursor-pointer active:scale-98"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Import from Excel / CSV</span>
            </button>

            <button
              onClick={() => setShowAddGuestModal(true)}
              className="px-3.5 py-2.5 rounded-2xl bg-[#F0F7F4] hover:bg-[#E3EFE9] text-[#236B50] font-bold text-xs border border-[#C5E0D4] transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Guest</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-3.5 py-2.5 rounded-2xl bg-white hover:bg-[#F6FAF8] text-[#3D5A4E] font-bold text-xs border border-[#D5E5DE] transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV (UTF-8)</span>
            </button>

            <button
              onClick={handleResetSampleData}
              title="Reset to 12 Crystal Plaza PMS Room Guests"
              className="p-2.5 rounded-2xl bg-white hover:bg-[#F6FAF8] text-[#5A6F66] hover:text-[#192A24] border border-[#D5E5DE] transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Retargeting Performance Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-2xl bg-[#F8FAF9] border border-[#E2ECE7] flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6F66]">
              Room Guests Loaded
            </span>
            <div className="mt-2">
              <div className="text-2xl font-black text-[#192A24]">{totalGuests}</div>
              <div className="text-[10px] text-[#5A6F66] mt-0.5">From PMS Folio Sheets</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8FAF9] border border-[#E2ECE7] flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#236B50]">
              WhatsApp Sent
            </span>
            <div className="mt-2">
              <div className="text-2xl font-black text-[#236B50]">{sentCount}</div>
              <div className="text-[10px] text-emerald-700 font-bold mt-0.5">
                {totalGuests > 0 ? `${((sentCount / totalGuests) * 100).toFixed(0)}% reached` : '0%'}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8FAF9] border border-[#E2ECE7] flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Pending Outreach
            </span>
            <div className="mt-2">
              <div className="text-2xl font-black text-amber-700">{pendingCount}</div>
              <div className="text-[10px] text-amber-800 font-bold mt-0.5">Ready to message</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8FAF9] border border-[#E2ECE7] flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
              Inquiries / Responded
            </span>
            <div className="mt-2">
              <div className="text-2xl font-black text-blue-700">{respondedCount}</div>
              <div className="text-[10px] text-blue-800 font-bold mt-0.5">
                {sentCount > 0 ? `${((respondedCount / sentCount) * 100).toFixed(0)}% response rate` : '0%'}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#EBF5F0] via-white to-[#E3F2EB] border border-[#B8DFC9] flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#236B50]">
              Converted Bookings
            </span>
            <div className="mt-2">
              <div className="text-2xl font-black text-[#236B50]">{convertedCount}</div>
              <div className="text-[10px] text-emerald-800 font-extrabold mt-0.5">Direct banquet sales</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8FAF9] border border-[#E2ECE7] flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6F66]">
              Past Stay Value
            </span>
            <div className="mt-2">
              <div className="text-xl font-black text-[#192A24]">{formatCurrency(totalSpendPipeline)}</div>
              <div className="text-[10px] text-[#5A6F66] mt-0.5">High-affinity guests</div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. CAMPAIGN OFFER SELECTOR & PROMOTIONAL FLYER ATTACHMENTS
          ===================================================================== */}
      <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2ECE7]">
          <div>
            <div className="flex items-center space-x-2 text-[#236B50] text-xs font-black uppercase tracking-wider">
              <ImageIcon className="w-4 h-4 text-[#236B50]" />
              <span>Step 1: Choose Promotional Offer & High-Resolution Flyer</span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-[#192A24] mt-0.5">
              Select What to Retarget Your Hotel Room Guests With
            </h3>
          </div>
          <span className="text-xs font-bold text-[#5A6F66]">
            Active Offer: <strong className="text-[#236B50]">{selectedOffer?.title}</strong>
          </span>
        </div>

        {/* Offer Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {offers.map(offer => {
            const isSelected = offer.id === selectedOfferId;
            return (
              <div
                key={offer.id}
                onClick={() => setSelectedOfferId(offer.id)}
                className={`group rounded-2xl p-3.5 border-2 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                  isSelected
                    ? 'border-[#236B50] bg-[#F6FAF8] shadow-md ring-2 ring-[#236B50]/20'
                    : 'border-[#E2ECE7] bg-white hover:border-[#B8DFC9] hover:bg-[#F9FCFA]'
                }`}
              >
                <div className="relative h-28 w-full rounded-xl overflow-hidden mb-2.5 bg-slate-100">
                  <img
                    src={offer.photoUrl}
                    alt={offer.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-xs text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                    {offer.badge}
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#236B50] text-white flex items-center justify-center shadow-md">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-extrabold text-sm text-[#192A24] leading-tight line-clamp-1">
                    {offer.title}
                  </h4>
                  <p className="text-[11px] text-[#5A6F66] mt-1 line-clamp-2">
                    {offer.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#E2ECE7] flex items-center justify-between text-[10px]">
                  <span className="font-bold text-[#236B50]">
                    {offer.discountValue}
                  </span>
                  <span className="font-mono bg-[#EBF3EF] px-1.5 py-0.5 rounded text-[#236B50] font-black">
                    {offer.promoCode}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          3. PRE-DEFINED WHATSAPP MESSAGE TEMPLATE EDITOR (WITH PLACEHOLDERS)
             Fixes broken characters & asterisks with custom dynamic tags
          ===================================================================== */}
      <div className="bg-white border border-[#E2ECE7] rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2ECE7]">
          <div>
            <div className="flex items-center space-x-2 text-[#236B50] text-xs font-black uppercase tracking-wider">
              <FileCode className="w-4 h-4 text-[#236B50]" />
              <span>Step 2: WhatsApp Message Template & Placeholder Editor</span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-[#192A24] mt-0.5">
              Customize Pre-Defined Templates & Dynamic Placeholders
            </h3>
            <p className="text-xs text-[#5A6F66]">
              Choose a pre-defined template or insert tags like <code className="text-[#236B50] font-mono font-bold bg-[#EBF3EF] px-1 py-0.5 rounded">&#123;guest_name&#125;</code> and <code className="text-[#236B50] font-mono font-bold bg-[#EBF3EF] px-1 py-0.5 rounded">&#123;offer_description&#125;</code>.
            </p>
          </div>

          {/* Formatting Mode Selector */}
          <div className="flex items-center space-x-2 bg-[#F8FAF9] p-1.5 rounded-2xl border border-[#D5E5DE]">
            <span className="text-[11px] font-bold text-[#5A6F66] pl-1">Formatting:</span>
            <button
              type="button"
              onClick={() => setFormattingMode('clean')}
              className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                formattingMode === 'clean'
                  ? 'bg-[#236B50] text-white shadow-xs'
                  : 'text-[#3D5A4E] hover:text-[#192A24]'
              }`}
            >
              Clean Text (No Stars / No Glitches)
            </button>
            <button
              type="button"
              onClick={() => setFormattingMode('whatsapp_bold')}
              className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                formattingMode === 'whatsapp_bold'
                  ? 'bg-[#236B50] text-white shadow-xs'
                  : 'text-[#3D5A4E] hover:text-[#192A24]'
              }`}
            >
              WhatsApp Bold (*asterisks*)
            </button>
          </div>
        </div>

        {/* Template Selector Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {templates.map(tpl => {
            const isSelected = tpl.id === selectedTemplateId;
            return (
              <button
                key={tpl.id}
                onClick={() => setSelectedTemplateId(tpl.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-[#236B50] text-white shadow-xs ring-2 ring-[#236B50]/30'
                    : 'bg-[#F0F7F4] text-[#3D5A4E] hover:bg-[#E3EFE9]'
                }`}
              >
                <span>{tpl.name}</span>
                {tpl.isDefault && (
                  <span className="text-[9px] bg-white/20 px-1 py-0.2 rounded font-mono">Default</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Click-to-Insert Dynamic Placeholders Bar */}
        <div className="bg-[#F8FAF9] rounded-2xl p-3.5 border border-[#E2ECE7] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-[#192A24] flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5 text-[#236B50]" />
              <span>Click to Insert Dynamic Placeholder Tags:</span>
            </span>
            <span className="text-[11px] text-[#5A6F66]">
              Tags automatically resolve for each individual room guest upon dispatch.
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {DYNAMIC_PLACEHOLDERS.map(item => (
              <button
                key={item.tag}
                type="button"
                onClick={() => handleInsertPlaceholder(item.tag)}
                title={item.desc}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#EBF5F0] border border-[#D5E5DE] hover:border-[#236B50] text-[#192A24] hover:text-[#236B50] font-mono text-[11px] font-bold shadow-2xs transition-all flex items-center space-x-1 cursor-pointer active:scale-95"
              >
                <span>{item.tag}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Live Template Textarea Editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label className="font-bold text-[#3D5A4E]">
              Template Body Editor (Auto-Sanitized for WhatsApp Web):
            </label>
            <div className="flex items-center space-x-3 text-[11px] text-[#5A6F66]">
              <span>{customTemplateText.length} characters</span>
              <button
                type="button"
                onClick={handleResetTemplate}
                className="text-[#5A6F66] hover:text-[#192A24] flex items-center space-x-1 cursor-pointer font-bold"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Default</span>
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                className="text-[#236B50] hover:text-[#1C5740] flex items-center space-x-1 cursor-pointer font-extrabold"
              >
                <Save className="w-3 h-3" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>

          <textarea
            ref={templateTextareaRef}
            rows={7}
            value={customTemplateText}
            onChange={(e) => setCustomTemplateText(e.target.value)}
            className="w-full p-3.5 rounded-2xl border border-[#D5E5DE] focus:border-[#236B50] outline-none font-mono text-xs text-[#192A24] bg-white leading-relaxed resize-y shadow-2xs"
          />
        </div>
      </div>

      {/* =====================================================================
          4. MAIN TWO-COLUMN WORKSPACE:
             LEFT: EXTRACTED ROOM GUESTS DIRECTORY & BULK ACTIONS
             RIGHT: LIVE PERSONALIZED WHATSAPP STUDIO & PREVIEW
          ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ===================================================================
            COLUMN 1 (7 Cols): GUESTS EXTRACTED FROM EXCEL / CSV
            =================================================================== */}
        <div className="lg:col-span-7 bg-white border border-[#E2ECE7] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#192A24] flex items-center space-x-2">
                  <span>Extracted Room Guests</span>
                  <span className="text-xs bg-[#EBF3EF] text-[#236B50] font-mono px-2 py-0.5 rounded-full">
                    {filteredGuests.length} Available
                  </span>
                </h3>
                <p className="text-xs text-[#5A6F66]">
                  Click on any guest row to populate their data into the WhatsApp preview.
                </p>
              </div>

              {selectedGuestIds.size > 0 && (
                <div className="flex items-center space-x-2 bg-[#EBF5F0] border border-[#B8DFC9] px-3 py-1.5 rounded-xl">
                  <span className="text-xs font-bold text-[#236B50]">
                    {selectedGuestIds.size} Selected
                  </span>
                  <button
                    onClick={() => {
                      const firstSelected = guests.find(g => selectedGuestIds.has(g.id));
                      if (firstSelected) {
                        handleSendWhatsApp(firstSelected);
                      }
                    }}
                    className="px-2.5 py-1 bg-[#236B50] hover:bg-[#1C5740] text-white rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    <span>Launch WhatsApp</span>
                  </button>
                </div>
              )}
            </div>

            {/* Search & Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
              <div className="sm:col-span-6 relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, phone, room #, city..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#D5E5DE] focus:border-[#236B50] outline-none text-xs bg-[#FBFDFB]"
                />
              </div>

              <div className="sm:col-span-3">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-[#D5E5DE] focus:border-[#236B50] outline-none text-xs bg-white text-[#3D5A4E] font-medium"
                >
                  <option value="all">All Segments</option>
                  <option value="VIP">VIP Guests</option>
                  <option value="Corporate Business">Corporate Business</option>
                  <option value="Family Leisure">Family Leisure</option>
                  <option value="Frequent Stay">Frequent Stay</option>
                  <option value="Weekend Staycation">Staycation</option>
                  <option value="Honeymoon & Couples">Honeymoon & Couples</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-[#D5E5DE] focus:border-[#236B50] outline-none text-xs bg-white text-[#3D5A4E] font-medium"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="sent">Sent</option>
                  <option value="responded">Responded</option>
                  <option value="converted">Converted</option>
                </select>
              </div>
            </div>
          </div>

          {/* Room Guests Table */}
          <div className="border border-[#E2ECE7] rounded-2xl overflow-hidden shadow-2xs">
            <div className="max-h-[580px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAF9] text-[#3D5A4E] font-extrabold border-b border-[#E2ECE7] text-[10px] uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-8 text-center">
                      <input
                        type="checkbox"
                        checked={selectedGuestIds.size === filteredGuests.length && filteredGuests.length > 0}
                        onChange={handleToggleSelectAll}
                        className="rounded accent-[#236B50] cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3">Guest & Room</th>
                    <th className="py-2.5 px-3">Contact & City</th>
                    <th className="py-2.5 px-3">Segment</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2ECE7]">
                  {filteredGuests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#5A6F66] text-xs">
                        No guests match your search criteria. Try adjusting filters or import more guests.
                      </td>
                    </tr>
                  ) : (
                    filteredGuests.map(guest => {
                      const isActive = guest.id === activeGuestId;
                      const isChecked = selectedGuestIds.has(guest.id);

                      return (
                        <tr
                          key={guest.id}
                          onClick={() => setActiveGuestId(guest.id)}
                          className={`transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-[#EBF5F0] font-semibold'
                              : 'hover:bg-[#F9FCFA]'
                          }`}
                        >
                          <td 
                            className="py-3 px-3 text-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSelectGuest(guest.id);
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="rounded accent-[#236B50] cursor-pointer"
                            />
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-bold text-[#192A24] flex items-center space-x-1.5">
                              <span>{guest.name}</span>
                              {isActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#236B50]"></span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#5A6F66] flex items-center space-x-1 mt-0.5">
                              <Building className="w-3 h-3 text-[#236B50]" />
                              <span>Room {guest.roomNumber}</span>
                              <span className="text-slate-300">·</span>
                              <span className="truncate max-w-[120px]">{guest.roomType || 'Deluxe'}</span>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-mono font-bold text-[#192A24] text-[11px] flex items-center space-x-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{guest.phone}</span>
                            </div>
                            <div className="text-[10px] text-[#5A6F66]">
                              {guest.cityOrCountry || 'GCC / International'}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block ${
                              guest.guestCategory === 'VIP'
                                ? 'bg-amber-100 text-amber-900'
                                : guest.guestCategory === 'Corporate Business'
                                ? 'bg-blue-100 text-blue-900'
                                : guest.guestCategory === 'Frequent Stay'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-slate-100 text-slate-800'
                            }`}>
                              {guest.guestCategory}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                              guest.status === 'converted'
                                ? 'bg-[#236B50] text-white'
                                : guest.status === 'responded'
                                ? 'bg-blue-600 text-white'
                                : guest.status === 'sent'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {guest.status === 'converted' ? '✓ Converted' : guest.status === 'responded' ? 'Inquired' : guest.status === 'sent' ? 'Sent' : 'Pending'}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveGuestId(guest.id);
                                handleSendWhatsApp(guest);
                              }}
                              title="Send Clean WhatsApp Message"
                              className="px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-white font-black text-[11px] shadow-xs flex items-center space-x-1 ml-auto cursor-pointer active:scale-95 transition-all"
                            >
                              <MessageSquare className="w-3 h-3 fill-white" />
                              <span>Send</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick status updates for selected */}
          {selectedGuestIds.size > 0 && (
            <div className="p-3 bg-[#F8FAF9] rounded-2xl border border-[#E2ECE7] flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[#3D5A4E]">
                Bulk Action for {selectedGuestIds.size} Guests:
              </span>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => {
                    const updated = guests.map(g => selectedGuestIds.has(g.id) ? { ...g, status: 'sent' as RetargetingStatus, lastSentAt: new Date().toISOString() } : g);
                    updateGuestsList(updated);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-bold hover:bg-emerald-200 cursor-pointer"
                >
                  Mark as Sent
                </button>
                <button
                  onClick={() => {
                    const updated = guests.map(g => selectedGuestIds.has(g.id) ? { ...g, status: 'responded' as RetargetingStatus } : g);
                    updateGuestsList(updated);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 font-bold hover:bg-blue-200 cursor-pointer"
                >
                  Mark as Inquired
                </button>
                <button
                  onClick={() => {
                    const updated = guests.map(g => selectedGuestIds.has(g.id) ? { ...g, status: 'converted' as RetargetingStatus } : g);
                    updateGuestsList(updated);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#236B50] text-white font-bold hover:bg-[#1C5740] cursor-pointer"
                >
                  Mark as Converted
                </button>
              </div>
            </div>
          )}
        </div>


        {/* ===================================================================
            COLUMN 2 (5 Cols): WHATSAPP MESSAGE STUDIO & LIVE PREVIEW
            Greeting First -> Offer Photo -> Offer Description -> Send
            =================================================================== */}
        <div className="lg:col-span-5 bg-white border border-[#E2ECE7] rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
          
          <div className="pb-3 border-b border-[#E2ECE7] flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-1.5 text-[#236B50] text-[11px] font-black uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Zero-Glitch WhatsApp Output</span>
              </div>
              <h3 className="text-base font-black text-[#192A24] mt-0.5">
                Live Chat Simulation
              </h3>
            </div>

            <button
              onClick={handleStepNextGuest}
              className="px-3 py-1 rounded-xl bg-[#F0F7F4] hover:bg-[#E3EFE9] text-[#236B50] font-bold text-xs flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <span>Next Guest</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Active Target Guest Banner */}
          {activeGuest ? (
            <div className="p-3.5 rounded-2xl bg-[#F6FAF8] border border-[#D5E5DE] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-[#236B50] tracking-wide block">
                  Targeted In-House Guest:
                </span>
                <div className="font-extrabold text-sm text-[#192A24] flex items-center space-x-1.5">
                  <span>{activeGuest.name}</span>
                  <span className="text-[11px] font-normal text-[#5A6F66]">
                    (Room {activeGuest.roomNumber})
                  </span>
                </div>
                <div className="font-mono text-xs text-[#3D5A4E] mt-0.5">
                  {activeGuest.phone}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Segment</span>
                <span className="text-xs font-black text-[#236B50]">{activeGuest.guestCategory}</span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
              No guest selected. Select a guest from the table to preview message.
            </div>
          )}

          {/* Encoding & Formatting Notice */}
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-950 flex items-start space-x-2">
            <CheckCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-black text-emerald-900">Encoding Protection Active:</strong>
              Text is automatically NFC normalized and sanitized of rogue surrogate characters, preventing replacement marks () and raw star formatting glitches in WhatsApp Web.
            </div>
          </div>

          {/* ===================================================================
              AUTHENTIC WHATSAPP CHAT SIMULATOR & PREVIEW BUBBLE
              =================================================================== */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-[#236B50] tracking-wider">
                Simulated WhatsApp Chat Preview
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyPhotoUrl}
                  title="Copy Offer Flyer URL"
                  className="text-[10px] font-bold text-[#5A6F66] hover:text-[#192A24] flex items-center space-x-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Photo URL</span>
                </button>
                <button
                  onClick={handleCopyMessage}
                  title="Copy Clean Message"
                  className="text-[10px] font-bold text-[#236B50] hover:text-[#1C5740] flex items-center space-x-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Message Text</span>
                </button>
              </div>
            </div>

            {/* WhatsApp Phone Mock Container */}
            <div className="bg-[#EFEAE2] rounded-3xl p-4 border border-[#D5E5DE] shadow-inner space-y-3 font-sans">
              
              {/* WhatsApp Chat Header */}
              <div className="bg-[#075E54] text-white px-3.5 py-2.5 rounded-2xl flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                    CP
                  </div>
                  <div>
                    <div className="font-bold text-xs leading-none">
                      Crystal Plaza Hotel & Banquets
                    </div>
                    <div className="text-[9px] text-emerald-200 mt-0.5">
                      To: {activeGuest ? activeGuest.name : 'Guest'} ({activeGuest?.cleanPhone || ''})
                    </div>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              </div>

              {/* Chat Message Bubble */}
              <div className="bg-[#DCF8C6] border border-[#C5E5D5] rounded-2xl p-3.5 text-xs text-slate-900 shadow-sm space-y-2 relative">
                
                {/* Embedded Offer Flyer Image */}
                {selectedOffer?.photoUrl && (
                  <div className="rounded-xl overflow-hidden border border-emerald-300/60 shadow-xs relative">
                    <img
                      src={selectedOffer.photoUrl}
                      alt={selectedOffer.title}
                      className="w-full h-36 object-cover"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-white">
                      <div className="text-[10px] font-black uppercase text-amber-300">
                        {selectedOffer.badge}
                      </div>
                      <div className="font-extrabold text-xs leading-tight">
                        {selectedOffer.headline}
                      </div>
                    </div>
                  </div>
                )}

                {/* Formatted Text Message */}
                <div className="whitespace-pre-line leading-relaxed text-[11px] text-slate-800 font-sans">
                  {previewMessage}
                </div>

                {/* Message Meta: Timestamp & Double Blue Ticks */}
                <div className="flex justify-end items-center space-x-1 text-[9px] text-slate-500 pt-1">
                  <span>10:45 AM</span>
                  <span className="text-blue-600 font-bold">✓✓</span>
                </div>
              </div>
            </div>
          </div>

          {/* ===================================================================
              ACTION TRIGGER: SEND ON WHATSAPP & STATUS CONTROLS
              =================================================================== */}
          <div className="space-y-3 pt-2">
            <button
              onClick={() => activeGuest && handleSendWhatsApp(activeGuest)}
              disabled={!activeGuest}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20BD5A] text-white font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 active:scale-98"
            >
              <MessageSquare className="w-5 h-5 fill-white" />
              <span>Send WhatsApp to {activeGuest ? activeGuest.name.split(' ')[0] : 'Guest'}</span>
              <ExternalLink className="w-4 h-4 ml-1 opacity-80" />
            </button>

            {/* Manual Status Buttons for Active Guest */}
            {activeGuest && (
              <div className="p-3 bg-[#F8FAF9] rounded-2xl border border-[#E2ECE7] flex items-center justify-between text-xs">
                <span className="font-bold text-[#5A6F66]">
                  Update {activeGuest.name.split(' ')[0]}'s Status:
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleUpdateStatus(activeGuest.id, 'sent')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                      activeGuest.status === 'sent' ? 'bg-[#236B50] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Sent
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(activeGuest.id, 'responded')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                      activeGuest.status === 'responded' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Inquired
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(activeGuest.id, 'converted')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                      activeGuest.status === 'converted' ? 'bg-[#236B50] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Converted
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* =====================================================================
          MODAL: IMPORT GUESTS FROM EXCEL OR CSV
          ===================================================================== */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full border border-[#D5E5DE] shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2ECE7]">
              <div>
                <div className="flex items-center space-x-2 text-[#236B50] text-xs font-black uppercase">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>PMS Room Folio Data Extraction</span>
                </div>
                <h3 className="text-lg font-black text-[#192A24] mt-0.5">
                  Import Hotel Room Guests from Excel or CSV
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportStatusMessage(null);
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F6FAF8] border border-[#D5E5DE] text-xs text-[#3D5A4E] space-y-1">
              <div className="font-extrabold text-[#192A24] flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#236B50]" />
                <span>Compatible with Excel Copy-Paste & CSV File Upload</span>
              </div>
              <p className="text-[#5A6F66]">
                You can copy columns directly from your hotel PMS (Opera, Protel, RoomRaccoon) or upload a CSV file with columns: <strong>Guest Name, Phone Number, Room Number, Room Type, Check-in, Check-out, Spend, Category</strong>.
              </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl border-2 border-dashed border-[#B8DFC9] bg-[#FBFDFB]">
              <div className="flex items-center space-x-2 text-xs text-[#3D5A4E]">
                <Upload className="w-4 h-4 text-[#236B50]" />
                <span>Upload .csv or .xlsx text file from computer:</span>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv, .txt, .tsv"
                onChange={handleFileUpload}
                className="text-xs file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-[#236B50] file:text-white file:font-bold file:cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-[#3D5A4E]">
                  Or Paste Excel Data (Tab or Comma Separated)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const sample = `Guest Name\tPhone Number\tRoom Number\tRoom Type\tCheck-In\tCheck-Out\tTotal Spend (AED)\tCategory
Dr. Tariq Mansoor\t+971508821990\t705\tExecutive Suite\t2026-10-14\t2026-10-18\t4500\tVIP
Fatima Al-Falasi\t+971524451234\t312\tDeluxe King\t2026-10-15\t2026-10-17\t2200\tFamily Leisure
Hassan Al-Zahra\t+971559981122\t518\tExecutive Room\t2026-10-10\t2026-10-14\t3100\tCorporate Business`;
                    setImportRawText(sample);
                  }}
                  className="text-[11px] text-[#236B50] font-bold hover:underline cursor-pointer"
                >
                  Load Sample Paste Text
                </button>
              </div>

              <textarea
                rows={6}
                value={importRawText}
                onChange={(e) => setImportRawText(e.target.value)}
                placeholder="Name&#9;Phone&#9;Room&#9;Room Type&#9;Check-In&#9;Check-Out&#9;Spend&#9;Category&#10;John Smith&#9;+971501234567&#9;402&#9;Deluxe Suite&#9;2026-10-12&#9;2026-10-15&#9;3500&#9;VIP"
                className="w-full p-3 rounded-2xl border border-[#D5E5DE] focus:border-[#236B50] outline-none font-mono text-xs bg-white resize-y"
              />
            </div>

            {importStatusMessage && (
              <div className={`p-3 rounded-xl text-xs font-bold ${
                importStatusMessage.startsWith('✓') ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-amber-50 text-amber-900 border border-amber-200'
              }`}>
                {importStatusMessage}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E2ECE7]">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleParseCsvOrExcel}
                className="px-5 py-2.5 rounded-xl bg-[#236B50] hover:bg-[#1C5740] text-white font-black text-xs shadow-md cursor-pointer flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Extract & Import Room Guests</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: QUICK ADD SINGLE ROOM GUEST
          ===================================================================== */}
      {showAddGuestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-[#D5E5DE] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2ECE7]">
              <div>
                <div className="flex items-center space-x-2 text-[#236B50] text-xs font-black uppercase">
                  <User className="w-4 h-4" />
                  <span>Manual Guest Entry</span>
                </div>
                <h3 className="text-lg font-black text-[#192A24] mt-0.5">
                  Add Hotel Room Guest
                </h3>
              </div>
              <button
                onClick={() => setShowAddGuestModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSingleGuest} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[#3D5A4E] font-bold mb-1">Guest Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sheikh Rashid Al-Nuaimi"
                    value={newGuestName}
                    onChange={(e) => setNewGuestName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#D5E5DE] focus:border-[#236B50] outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[#3D5A4E] font-bold mb-1">Phone Number (WhatsApp) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +971 50 123 4567"
                    value={newGuestPhone}
                    onChange={(e) => setNewGuestPhone(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#D5E5DE] focus:border-[#236B50] outline-none text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[#3D5A4E] font-bold mb-1">Room Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 502"
                    value={newGuestRoom}
                    onChange={(e) => setNewGuestRoom(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#D5E5DE] focus:border-[#236B50] outline-none text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[#3D5A4E] font-bold mb-1">Room Category</label>
                  <select
                    value={newGuestRoomType}
                    onChange={(e) => setNewGuestRoomType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D5E5DE] focus:border-[#236B50] outline-none text-xs bg-white"
                  >
                    <option value="Executive King Room">Executive King Room</option>
                    <option value="Deluxe Suite">Deluxe Suite</option>
                    <option value="Royal Penthouse Suite">Royal Penthouse Suite</option>
                    <option value="Standard Twin Room">Standard Twin Room</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#3D5A4E] font-bold mb-1">Guest Segment</label>
                  <select
                    value={newGuestCategory}
                    onChange={(e) => setNewGuestCategory(e.target.value as GuestSegmentCategory)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D5E5DE] focus:border-[#236B50] outline-none text-xs bg-white"
                  >
                    <option value="VIP">VIP Guest</option>
                    <option value="Corporate Business">Corporate Business</option>
                    <option value="Family Leisure">Family Leisure</option>
                    <option value="Frequent Stay">Frequent Stay</option>
                    <option value="Weekend Staycation">Weekend Staycation</option>
                    <option value="Honeymoon & Couples">Honeymoon & Couples</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#3D5A4E] font-bold mb-1">Check-in Date</label>
                  <input
                    type="date"
                    value={newGuestCheckIn}
                    onChange={(e) => setNewGuestCheckIn(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D5E5DE] focus:border-[#236B50] outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[#3D5A4E] font-bold mb-1">Check-out Date</label>
                  <input
                    type="date"
                    value={newGuestCheckOut}
                    onChange={(e) => setNewGuestCheckOut(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D5E5DE] focus:border-[#236B50] outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[#3D5A4E] font-bold mb-1">Total Room Spend (AED)</label>
                  <input
                    type="number"
                    value={newGuestSpend}
                    onChange={(e) => setNewGuestSpend(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D5E5DE] focus:border-[#236B50] outline-none text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[#3D5A4E] font-bold mb-1">City / Country</label>
                  <input
                    type="text"
                    value={newGuestCity}
                    onChange={(e) => setNewGuestCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D5E5DE] focus:border-[#236B50] outline-none text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#E2ECE7]">
                <button
                  type="button"
                  onClick={() => setShowAddGuestModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#236B50] hover:bg-[#1C5740] text-white font-black text-xs shadow-md cursor-pointer flex items-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save Room Guest</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
