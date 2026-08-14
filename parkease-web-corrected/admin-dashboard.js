const token = localStorage.getItem('parkease_admin_token');
if (!token) {
  window.location.href = 'admin-login.html';
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('parkease_admin_token');
  window.location.href = 'admin-login.html';
});

let currentRates = [];

async function loadStats() {
  const stats = await ParkEaseAPI.getAdminStats(token);
  document.getElementById('statFreeSlots').textContent = stats.freeSlots;
  document.getElementById('statRevenue').textContent = `NPR ${stats.revenueToday.toLocaleString()}`;
  document.getElementById('statBookings').textContent = stats.bookingsToday;
}

async function loadBookings() {
  const bookings = await ParkEaseAPI.getAdminBookings(token);
  const body = document.getElementById('bookingsBody');

  if (bookings.length === 0) {
    body.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--ink-soft);">No bookings yet today.</td></tr>`;
    return;
  }

  body.innerHTML = bookings.map((b) => `
    <tr>
      <td style="font-family:monospace;">${b.id}</td>
      <td>${b.zone}</td>
      <td>${b.duration}</td>
      <td>NPR ${b.amount}</td>
      <td><span class="status-pill ${b.status.toLowerCase()}">${b.status}</span></td>
      <td>
        ${b.status === 'Active'
          ? `<button class="logout-btn cancel-btn" data-token="${b.id}" style="padding:5px 12px; font-size:12.5px;">Cancel</button>`
          : '—'}
      </td>
    </tr>
  `).join('');

  body.querySelectorAll('.cancel-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Cancelling…';
      const res = await ParkEaseAPI.cancelBooking(token, btn.dataset.token);
      if (res.success) {
        await Promise.all([loadStats(), loadBookings()]); // refresh both — cancelling frees a slot
      } else {
        alert(res.message || 'Could not cancel booking.');
        btn.disabled = false;
        btn.textContent = 'Cancel';
      }
    });
  });
}

async function loadRates() {
  currentRates = await ParkEaseAPI.getRates();
  const card = document.getElementById('rateCard');
  card.innerHTML = currentRates.map((r) => `
    <div class="rate-row">
      <span>${r.label}</span>
      <div>NPR <input type="number" min="0" value="${r.rate}" data-hours="${r.hours}"></div>
    </div>
  `).join('');
}

document.getElementById('saveRatesBtn').addEventListener('click', async () => {
  const inputs = document.querySelectorAll('#rateCard input');
  const updated = Array.from(inputs).map((input) => ({
    hours: Number(input.dataset.hours),
    rate: Number(input.value),
  }));

  const banner = document.getElementById('rateBanner');
  const btn = document.getElementById('saveRatesBtn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const res = await ParkEaseAPI.updateRates(token, updated);

  btn.disabled = false;
  btn.textContent = 'Save price changes';
  banner.className = `status-banner show ${res.success ? 'info' : 'error'}`;
  banner.textContent = res.message || (res.success ? 'Rates saved.' : 'Could not save rates.');
});

loadStats();
loadBookings();
loadRates();
