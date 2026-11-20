import { 
  BookingEvent, 
  UserProfile, 
  PaymentRecord, 
  CancellationPolicyDetails, 
  NotificationItem, 
  AuditLog, 
  ChefPartyIngredientEntry, 
  CostingMethod 
} from '../types';

export class ApiService {
  private static getHeaders(currentUser?: UserProfile): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (currentUser) {
      headers['x-user-role'] = currentUser.role;
      headers['x-user-name'] = encodeURIComponent(currentUser.name);
      headers['x-user-id'] = currentUser.id;
    }
    return headers;
  }

  // Fetch bookings filtered server-side by caller role
  static async getBookings(currentUser?: UserProfile): Promise<BookingEvent[]> {
    try {
      const res = await fetch('/api/bookings', {
        headers: this.getHeaders(currentUser),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.bookings || [];
    } catch (e) {
      console.warn('API getBookings failed, falling back to local store', e);
      return [];
    }
  }

  // Create booking with Server-side "One party per date" validation
  static async createBooking(
    booking: Partial<BookingEvent>, 
    currentUser?: UserProfile
  ): Promise<{ success: boolean; booking?: BookingEvent; error?: string }> {
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: this.getHeaders(currentUser),
        body: JSON.stringify(booking),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to create booking' };
      }
      return { success: true, booking: data.booking };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error while booking' };
    }
  }

  // Cancel booking with Server-side mandatory reason & cancellation policy
  static async cancelBooking(
    bookingId: string, 
    policy: { reason: string; advanceAction?: string; refundAmount?: number; notes?: string },
    currentUser?: UserProfile
  ): Promise<{ success: boolean; booking?: BookingEvent; error?: string }> {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
        headers: this.getHeaders(currentUser),
        body: JSON.stringify(policy),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to cancel booking' };
      }
      return { success: true, booking: data.booking };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error while cancelling' };
    }
  }

  // Chef enters quantities and presses Finish (Lock & forward to Accounts)
  static async chefFinish(
    bookingId: string,
    entries: ChefPartyIngredientEntry[],
    chefNotes: string,
    costingMethod: CostingMethod,
    currentUser?: UserProfile
  ): Promise<{ success: boolean; booking?: BookingEvent; error?: string }> {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/chef-finish`, {
        method: 'PATCH',
        headers: this.getHeaders(currentUser),
        body: JSON.stringify({ entries, chefNotes, costingMethod }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to submit chef quantities' };
      }
      return { success: true, booking: data.booking };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error during chef finish' };
    }
  }

  // Accounts enters purchase prices (Server blocks if ANY line item is missing a price)
  static async accountsCosting(
    bookingId: string,
    entries: ChefPartyIngredientEntry[],
    arunNotes: string,
    currentUser?: UserProfile
  ): Promise<{ success: boolean; booking?: BookingEvent; error?: string; missingItemIds?: string[] }> {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/accounts-costing`, {
        method: 'PATCH',
        headers: this.getHeaders(currentUser),
        body: JSON.stringify({ entries, arunNotes }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { 
          success: false, 
          error: data.error || 'Costing blocked by server',
          missingItemIds: data.missingItemIds,
        };
      }
      return { success: true, booking: data.booking };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error during accounts costing' };
    }
  }

  // Record individual payment (Payment tracking)
  static async recordPayment(
    bookingId: string,
    payment: { amount: number; paymentType: string; paymentMode: string; notes?: string },
    currentUser?: UserProfile
  ): Promise<{ success: boolean; payment?: PaymentRecord; booking?: BookingEvent; error?: string }> {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/payments`, {
        method: 'POST',
        headers: this.getHeaders(currentUser),
        body: JSON.stringify(payment),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to record payment' };
      }
      return { success: true, payment: data.payment, booking: data.booking };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error while recording payment' };
    }
  }

  // Request unlock for locked record
  static async requestUnlock(
    bookingId: string,
    reason: string,
    currentUser?: UserProfile
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/request-unlock`, {
        method: 'POST',
        headers: this.getHeaders(currentUser),
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // GM approves unlock
  static async approveUnlock(
    bookingId: string,
    currentUser?: UserProfile
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/approve-unlock`, {
        method: 'POST',
        headers: this.getHeaders(currentUser),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // Notifications
  static async getNotifications(): Promise<NotificationItem[]> {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return [];
      const data = await res.json();
      return data.notifications || [];
    } catch {
      return [];
    }
  }

  static async markNotificationsRead(): Promise<void> {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
    } catch {}
  }

  // Audit Logs
  static async getAuditLogs(): Promise<AuditLog[]> {
    try {
      const res = await fetch('/api/audit-logs');
      if (!res.ok) return [];
      const data = await res.json();
      return data.logs || [];
    } catch {
      return [];
    }
  }
}
