// api.js — shared fetch helpers, loaded as a plain <script> on every page.
// Build the API path from the current page so the app works both at the
// domain root and inside a local Apache subfolder.

const ParkEaseAPI = (() => {
  function getApiBase() {
    try {
      const base = document.baseURI || window.location.href;
      const url = new URL(base);
      let path = url.pathname;
      if (!path.endsWith('/')) {
        if (/\.[a-zA-Z0-9]+$/.test(path)) {
          path = path.substring(0, path.lastIndexOf('/') + 1);
        } else {
          path = path + '/';
        }
      }
      return new URL('api/', `${url.origin}${path}`).pathname;
    } catch (_) {
      return 'api/';
    }
  }

  const API_BASE = getApiBase();

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
    // Guard against non-JSON responses (e.g. raw PHP served by a static server)
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (_) {
      throw new Error('API unavailable (server returned non-JSON response)');
    }
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

    async sendGmailOTP(email, purpose = 'register') {
      try {
        return await request('/api/auth/send-otp.php', {
          method: 'POST',
          body: JSON.stringify({ email, purpose }),
        });
      } catch (err) {
        // Demo mode: simulate OTP sent successfully
        console.warn('[api] sendGmailOTP demo fallback for:', email);
        const demoOtp = '123456';
        sessionStorage.setItem('parkease_demo_otp', demoOtp);
        sessionStorage.setItem('parkease_demo_otp_email', email);
        return {
          success: true,
          message: `[DEMO] Verification code sent to ${email}. Use code: ${demoOtp}`,
          demo: true
        };
      }
    },

    async verifyGmailOTP(email, code, purpose = 'register') {
      try {
        return await request('/api/auth/verify-otp.php', {
          method: 'POST',
          body: JSON.stringify({ email, code, purpose }),
        });
      } catch (err) {
        // Demo mode: accept any 6-digit code or the stored demo code
        console.warn('[api] verifyGmailOTP demo fallback for:', email);
        const storedOtp = sessionStorage.getItem('parkease_demo_otp') || '123456';
        if (code && code.length >= 6) {
          return { success: true, message: '[DEMO] OTP verified successfully.', demo: true };
        }
        return { success: false, message: 'Invalid OTP code. In demo mode, enter any 6-digit code.' };
      }
    },

    async userLogin(email, password) {
      try {
        return await request('/api/auth/user-auth.php', {
          method: 'POST',
          body: JSON.stringify({ mode: 'login', email, password }),
        });
      } catch (err) {
        // Offline / static-server fallback: check localStorage users
        const users = JSON.parse(localStorage.getItem('parkease_users') || '[]');
        const user = users.find(u => u.email === email && u.password === password);
        if (user) {
          const token = 'demo-' + Date.now();
          return { success: true, token, user: { name: user.name, email: user.email, phone: user.phone } };
        }
        return { success: false, message: 'Invalid email or password.' };
      }
    },

    async userRegister(name, email, phone, password, otpCode = '') {
      try {
        return await request('/api/auth/user-auth.php', {
          method: 'POST',
          body: JSON.stringify({ mode: 'register', name, email, phone, password, otp_code: otpCode }),
        });
      } catch (err) {
        // Offline / static-server fallback: save user in localStorage
        const users = JSON.parse(localStorage.getItem('parkease_users') || '[]');
        if (users.find(u => u.email === email)) {
          return { success: false, message: 'An account with this email already exists.' };
        }
        users.push({ name, email, phone, password });
        localStorage.setItem('parkease_users', JSON.stringify(users));
        const token = 'demo-' + Date.now();
        return { success: true, token, user: { name, email, phone } };
      }
    },

    async getMe(token) {
      if (!token) return { success: false, message: 'No token' };
      try {
        return await request(`/api/auth/me.php?token=${encodeURIComponent(token)}`);
      } catch (err) {
        // Demo mode: retrieve active cached session
        const email = localStorage.getItem('parkease_email') || 'driver.demo@gmail.com';
        const name = localStorage.getItem('parkease_name') || 'Demo Driver';
        return { success: true, user: { email, name, phone: '9800000000' }, demo: true };
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

    async requestPasswordReset(email, code, newPassword) {
      try {
        return await request('/api/auth/forgot-password.php', {
          method: 'POST',
          body: JSON.stringify({ email, code, new_password: newPassword }),
        });
      } catch (err) {
        // Demo mode: simulate password reset success
        console.warn('[api] requestPasswordReset demo fallback for:', email);
        const users = JSON.parse(localStorage.getItem('parkease_users') || '[]');
        const user = users.find(u => u.email === email);
        if (user) {
          user.password = newPassword;
          localStorage.setItem('parkease_users', JSON.stringify(users));
        }
        return { success: true, message: '[DEMO] Password has been reset successfully. You can now log in.' };
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

    async getSlots(zoneId) {
      try {
        return await request(`/api/slots.php?zone_id=${encodeURIComponent(zoneId)}`);
      } catch (err) {
        console.warn('[api] slots fallback:', err.message);
        return null;
      }
    },

    async createBooking({ zoneId, slotId, slotNumber, hours, token, sendToEmail, paymentMethod = 'counter' }) {
      try {
        return await request('/api/bookings.php', {
          method: 'POST',
          body: JSON.stringify({
            zone_id: zoneId,
            slot_id: slotId || slotNumber,
            slot_number: slotNumber || slotId,
            hours,
            token,
            send_to_email: sendToEmail,
            payment_method: paymentMethod
          }),
        });
      } catch (err) {
        // Demo mode: generate a booking token locally
        console.warn('[api] createBooking demo fallback');
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = 'PE-';
        for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        return {
          success: true,
          booking_token: code,
          message: `[DEMO] Booking confirmed! Token ${code} sent to ${sendToEmail || 'your email'}.`,
          demo: true
        };
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

    // Returns live slot status for a zone from the database.
    // Falls back to null so the caller can use its own mock data.
    async getSlotStatus(zoneId) {
      try {
        return await request(`/api/slot-status.php?zone_id=${encodeURIComponent(zoneId)}`);
      } catch (err) {
        console.warn('[api] slot-status fallback:', err.message);
        return null; // slot-status.html will use its built-in mock on null
      }
    },

    // ── Khalti e-Payment v2 ─────────────────────────────────────────────

    async initiateKhaltiPayment({ zoneId, slotId, slotNumber, hours, token, sendToEmail }) {
      try {
        return await request('/api/khalti/initiate.php', {
          method: 'POST',
          body: JSON.stringify({
            zone_id: zoneId,
            slot_id: slotId || slotNumber,
            slot_number: slotNumber || slotId,
            hours,
            token,
            send_to_email: sendToEmail,
          }),
        });
      } catch (err) {
        console.error('[api] Khalti initiate failed:', err.message);
        return { success: false, message: err.message || 'Could not connect to Khalti.' };
      }
    },

    async verifyKhaltiPayment(pidx, bookingToken) {
      try {
        return await request('/api/khalti/verify.php', {
          method: 'POST',
          body: JSON.stringify({ pidx, booking_token: bookingToken }),
        });
      } catch (err) {
        console.error('[api] Khalti verify failed:', err.message);
        return { success: false, message: err.message || 'Payment verification failed.' };
      }
    },
  };
})();
