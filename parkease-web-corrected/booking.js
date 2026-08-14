const zoneGrid = document.getElementById('zoneGrid');
const durationGrid = document.getElementById('durationGrid');
const payGrid = document.getElementById('payGrid');
const summaryCard = document.getElementById('summaryCard');
const errorBanner = document.getElementById('errorBanner');
const confirmBtn = document.getElementById('confirmBtn');
const selectView = document.getElementById('selectView');
const confirmView = document.getElementById('confirmView');

let zones = [];
let rates = []; // fetched once from /api/rates.php (or fallback) at init
let selectedZone = null;
let selectedHours = null;
let selectedPayment = 'khalti';
const requestedZoneId = new URLSearchParams(window.location.search).get('zone');

const PAYMENT_LABELS = { khalti: 'Khalti', esewa: 'eSewa', cash: 'Cash on arrival' };

function renderZones() {
  zoneGrid.innerHTML = zones.map((z) => `
    <button class="zone-card" data-id="${z.id}">
      <div class="zname">${z.name}</div>
      <div class="zfree ${z.freeSlots <= 3 ? 'low' : ''}">${z.freeSlots} of ${z.totalSlots} slots free</div>
    </button>
  `).join('');

  zoneGrid.querySelectorAll('.zone-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedZone = zones.find((z) => z.id === Number(btn.dataset.id));
      zoneGrid.querySelectorAll('.zone-card').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      updateSummary();
    });
  });
  if (requestedZoneId) {
    const requested = zoneGrid.querySelector(`[data-id="${requestedZoneId}"]`);
    if (requested) requested.click();
  }
}

function renderDurations() {
  durationGrid.innerHTML = rates.map((d) => `
    <button class="duration-card" data-hours="${d.hours}">
      <div class="dlabel">${d.label}</div>
      <div class="drate">NPR ${d.rate}</div>
    </button>
  `).join('');

  durationGrid.querySelectorAll('.duration-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedHours = Number(btn.dataset.hours);
      durationGrid.querySelectorAll('.duration-card').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      updateSummary();
    });
  });
}

payGrid.querySelectorAll('.pay-card').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedPayment = btn.dataset.method;
    payGrid.querySelectorAll('.pay-card').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    updateSummary();
  });
});

function updateSummary() {
  if (!selectedZone || !selectedHours) {
    summaryCard.style.display = 'none';
    return;
  }
  const d = rates.find((x) => x.hours === selectedHours);
  document.getElementById('sumZone').textContent = selectedZone.name;
  document.getElementById('sumDuration').textContent = d.label;
  document.getElementById('sumPayment').textContent = PAYMENT_LABELS[selectedPayment];
  document.getElementById('sumTotal').textContent = `NPR ${d.rate}`;
  summaryCard.style.display = 'block';
}

confirmBtn.addEventListener('click', async () => {
  errorBanner.classList.remove('show');
  if (!selectedZone || !selectedHours) {
    errorBanner.textContent = 'Select a zone and duration before confirming.';
    errorBanner.classList.add('show');
    return;
  }

  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Reserving…';

  const token = localStorage.getItem('parkease_token') || 'guest';
  const res = await ParkEaseAPI.createBooking({ zoneId: selectedZone.id, hours: selectedHours, token });

  confirmBtn.disabled = false;
  confirmBtn.textContent = 'Confirm booking →';

  if (res.success) {
    document.getElementById('confirmText').textContent =
      res.smsSent
        ? `Show this token at ${selectedZone.name} entry. A confirmation was also sent by SMS.`
        : `Show this token at ${selectedZone.name} entry. The booking is confirmed, but SMS delivery is unavailable right now.`;
    document.getElementById('tokenBox').textContent = res.bookingToken;
    selectView.style.display = 'none';
    confirmView.style.display = 'block';
  } else {
    errorBanner.textContent = res.message || 'Booking failed. Try again.';
    errorBanner.classList.add('show');
  }
});

(async function init() {
  [zones, rates] = await Promise.all([ParkEaseAPI.getZones(), ParkEaseAPI.getRates()]);
  renderZones();
  renderDurations();
})();
