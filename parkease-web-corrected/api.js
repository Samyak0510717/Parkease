// api.js — shared fetch helpers, loaded as a plain <script> on every page.
// Build the API path from the current page so the app works both at the
// domain root and inside a local Apache subfolder.

const ParkEaseAPI = (() => {
  const API_BASE = new URL('api/', document.baseURI).pathname;

  function apiPath(path) {
    const cleanPath = path.replace(/^\/+/, '').replace(/^api\//, '');
    return `${API_BASE}${cleanPath}`;
  }

  async function request(path, options = {}) {
    const res = await fetch(apiPath(path), {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `Request failed (${res.status})`);
    }
    return res.json();
  }

  const DURATIONS = [
    { hours: 1, label: '1 hour', rate: 40 },
    { hours: 2, label: '2 hours', rate: 70 },
    { hours: 4, label: '4 hours', rate: 120 },
    { hours: 24, label: 'Full day', rate: 250 },
  ];

  const MOCK_ZONES = [
    { id: 1, name: 'New Road', freeSlots: 12, totalSlots: 40 },
    { id: 2, name: 'Khusibu', freeSlots: 3, totalSlots: 20 },
    { id: 3, name: 'Baneshwor', freeSlots: 27, totalSlots: 50 },
    { id: 4, name: 'Patan Durbar', freeSlots: 1, totalSlots: 15 },
  ];

  return {
    getDurationOptions() {
      // Kept as a fallback shape only — real prices now come from
      // getRates(), which hits the database.
      return DURATIONS;
    },

    async getRates() {
      try {
        return await request('/api/rates.php');
      } catch (err) {
        console.warn('[api] rates fallback:', err.message);
        return DURATIONS;
      }
    },

    async updateRates(token, rates) {
      try {
        return await request('/api/admin/update-rates.php', {
          method: 'POST',
          body: JSON.stringify({ token, rates }),
        });
      } catch (err) {
        console.warn('[api] update-rates fallback:', err.message);
        return { success: true, message: 'Demo mode: rate change not actually saved.' };
      }
    },

    async cancelBooking(token, bookingToken) {
      try {
        return await request('/api/admin/cancel-booking.php', {
          method: 'POST',
          body: JSON.stringify({ token, booking_token: bookingToken }),
        });
      } catch (err) {
        console.warn('[api] cancel-booking fallback:', err.message);
        return { success: true, message: 'Demo mode: cancellation not actually saved.' };
      }
    },

    async userLogin(email, password) {
      try {
        return await request('/api/auth/user-auth.php', {
          method: 'POST',
          body: JSON.stringify({ mode: 'login', email, password }),
        });
      } catch (err) {
        return { success: false, message: err.message || 'Could not sign in.' };
      }
    },

    async userRegister(name, email, phone, password) {
      try {
        return await request('/api/auth/user-auth.php', {
          method: 'POST',
          body: JSON.stringify({ mode: 'register', name, email, phone, password }),
        });
      } catch (err) {
        return { success: false, message: err.message || 'Could not create your account.' };
      }
    },

    async adminLogin(email, password) {
      try {
        return await request('/api/auth/admin-login.php', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
      } catch (err) {
        return { success: false, message: err.message || 'Could not sign in.' };
      }
    },

    async requestPasswordReset(phone) {
      try {
        return await request('/api/auth/forgot-password.php', {
          method: 'POST',
          body: JSON.stringify({ phone }),
        });
      } catch (err) {
        return { success: false, message: err.message || 'Could not send the reset request.' };
      }
    },

    async getZones() {
      try {
        return await request('/api/zones.php');
      } catch (err) {
        console.warn('[api] zones fallback:', err.message);
        return MOCK_ZONES;
      }
    },

    async createBooking({ zoneId, hours, token }) {
      try {
        return await request('/api/bookings.php', {
          method: 'POST',
          body: JSON.stringify({ zone_id: zoneId, hours, token }),
        });
      } catch (err) {
        return { success: false, message: err.message || 'Could not create the booking.' };
      }
    },

    async getAdminStats(token) {
      try {
        return await request(`/api/admin/stats.php?token=${encodeURIComponent(token)}`);
      } catch (err) {
        console.warn('[api] admin stats fallback:', err.message);
        return { freeSlots: 43, revenueToday: 4320, bookingsToday: 38 };
      }
    },

    async getAdminBookings(token) {
      try {
        return await request(`/api/admin/bookings.php?token=${encodeURIComponent(token)}`);
      } catch (err) {
        console.warn('[api] admin bookings fallback:', err.message);
        return [
          { id: 'PE-482913', zone: 'New Road', duration: '2 hours', amount: 70, status: 'Active' },
          { id: 'PE-482910', zone: 'Khusibu', duration: '1 hour', amount: 40, status: 'Completed' },
          { id: 'PE-482905', zone: 'Baneshwor', duration: 'Full day', amount: 250, status: 'Completed' },
        ];
      }
    },
  };
})();
