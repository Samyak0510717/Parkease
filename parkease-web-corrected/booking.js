const zoneGrid      = document.getElementById('zoneGrid');
const durationGrid  = document.getElementById('durationGrid');
const payGrid       = document.getElementById('payGrid');
const summaryCard   = document.getElementById('summaryCard');
const errorBanner   = document.getElementById('errorBanner');
const confirmBtn    = document.getElementById('confirmBtn');
const selectView    = document.getElementById('selectView');
const confirmView   = document.getElementById('confirmView');
const loggedInState    = document.getElementById('loggedInState');
const loggedOutState   = document.getElementById('loggedOutState');
const loggedAccountEmail = document.getElementById('loggedAccountEmail');

const demoEmailInput   = document.getElementById('demoEmailInput');
const switchDemoUserBtn = document.getElementById('switchDemoUserBtn');

let activeUser = null;

function isValidGmail(val) {
  return /^[^\s@]+@gmail\.com$/i.test((val || '').trim());
}

async function checkAuthSession() {
  const token = localStorage.getItem('parkease_token');
  const cachedEmail = localStorage.getItem('parkease_email') || '';

  if (token && cachedEmail) {
    if (loggedAccountEmail) loggedAccountEmail.textContent = cachedEmail;
    if (loggedInState) loggedInState.style.display = 'block';
    if (loggedOutState) loggedOutState.style.display = 'none';
    try {
      const meRes = await ParkEaseAPI.getMe(token);
      if (meRes.success && meRes.user && meRes.user.email) {
        activeUser = meRes.user;
        if (loggedAccountEmail) loggedAccountEmail.textContent = meRes.user.email;
        localStorage.setItem('parkease_email', meRes.user.email);
        if (meRes.user.name) localStorage.setItem('parkease_name', meRes.user.name);
      }
    } catch {
      // Offline / demo fallback
    }
  } else {
    if (loggedInState) loggedInState.style.display = 'none';
    if (loggedOutState) loggedOutState.style.display = 'block';
  }
}

if (switchDemoUserBtn) {
  switchDemoUserBtn.addEventListener('click', () => {
    if (loggedInState) loggedInState.style.display = 'none';
    if (loggedOutState) loggedOutState.style.display = 'block';
    if (demoEmailInput) {
      demoEmailInput.focus();
      demoEmailInput.select();
    }
  });
}

let zones           = [];
let rates           = []; // fetched from /api/rates.php, falls back to DURATIONS
let selectedZone    = null;
let selectedHours   = null;
let selectedPayment = 'counter';
const requestedZoneId = new URLSearchParams(window.location.search).get('zone');

const PAYMENT_LABELS = { counter: 'Pay at Counter (Cash/QR)', cash: 'Cash on arrival', khalti: 'Paid via Khalti' };

// ── Mock slot data (fallback when API unavailable) ──────────────────────────
const ZONE_SLOT_MOCKS = {
  1: { totalSlots: 40, occupied: [2, 6, 12, 15, 18, 25, 31, 37], reserved: [8, 19, 34] },
  2: { totalSlots: 20, occupied: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 20], reserved: [2, 6] },
  3: { totalSlots: 50, occupied: [4, 7, 14, 21, 28, 35, 42], reserved: [10, 22, 38, 49] },
  4: { totalSlots: 15, occupied: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15], reserved: [12] },
};

// Selected slot state
let selectedSlotId     = null;
let selectedSlotNumber = null;
let selectedSlotLabel  = null;
let currentSlots       = []; // [{id, slot_id, label, slot_number, status}]

// ── Zone rendering ──────────────────────────────────────────────────────────

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
      // Reset slot selection when zone changes
      selectedSlotId = null;
      selectedSlotNumber = null;
      selectedSlotLabel = null;
      loadSlotGrid(selectedZone.id);
      // Hide lower steps until slot is chosen
      hideLowerSteps();
      updateSummary();
    });
  });

  if (requestedZoneId) {
    const requested = zoneGrid.querySelector(`[data-id="${requestedZoneId}"]`);
    if (requested) requested.click();
  }
}

// ── Slot grid ───────────────────────────────────────────────────────────────

function normStatus(s) {
  return s === 'free' ? 'available' : s;
}

function buildMockSlots(zoneId) {
  const m = ZONE_SLOT_MOCKS[zoneId];
  if (!m) return [];
  const slots = [];
  const prefix = String.fromCharCode(64 + (((zoneId - 1) % 26) + 1));
  for (let n = 1; n <= m.totalSlots; n++) {
    let s = 'free';
    if (m.occupied.indexOf(n) !== -1) s = 'occupied';
    else if (m.reserved.indexOf(n) !== -1) s = 'reserved';
    slots.push({ id: n, slot_id: n, label: prefix + n, slot_number: n, status: s });
  }
  return slots;
}

function showSlotSkeleton(count) {
  const container = document.getElementById('slotGridContainer');
  const cells = Array.from({ length: count }, () => '<div class="sk-cell"></div>').join('');
  container.innerHTML = `<div class="slot-skeleton">${cells}</div>`;
}

function renderSlotStats(slots) {
  let free = 0, occ = 0, res = 0;
  slots.forEach((s) => {
    const st = normStatus(s.status);
    if (st === 'free' || st === 'available') free++;
    else if (st === 'occupied') occ++;
    else if (st === 'reserved') res++;
  });
  document.getElementById('slotStats').innerHTML =
    `<div class="slot-stat free">🟢 ${free} Available</div>` +
    `<div class="slot-stat occupied">🔴 ${occ} Occupied</div>` +
    (res > 0 ? `<div class="slot-stat reserved">🟡 ${res} Reserved</div>` : '');
}

function renderSlotGrid(slots) {
  const container = document.getElementById('slotGridContainer');
  const html = slots.map((s) => {
    const sid    = s.id || s.slot_id;
    const snum   = s.slot_number || sid;
    const label  = s.label || (`Slot ${snum}`);
    const status = normStatus(s.status);
    const isSel  = selectedSlotId === sid;
    const cls    = isSel ? 'selected' : status;
    const statusText = { available: 'Available', occupied: 'Occupied', reserved: 'Reserved' }[status] || status;
    const tip    = `${label} · ${isSel ? 'Selected ✓' : statusText}`;
    return `<div class="bslot ${cls}" data-slot-id="${sid}" data-slot-num="${snum}" data-label="${label}" data-status="${status}">` +
           label +
           `<span class="tip">${tip}</span></div>`;
  }).join('');
  container.innerHTML = `<div class="booking-slot-grid">${html}</div>`;

  // Attach click only to available or currently selected
  container.querySelectorAll('.bslot').forEach((el) => {
    const status = el.dataset.status;
    if (status !== 'available') return; // occupied/reserved → not clickable
    el.addEventListener('click', () => {
      const sid = Number(el.dataset.slotId);
      const snum = Number(el.dataset.slotNum);
      const label = el.dataset.label;
      if (selectedSlotId === sid) {
        // Deselect
        selectedSlotId = null;
        selectedSlotNumber = null;
        selectedSlotLabel = null;
        hideLowerSteps();
      } else {
        selectedSlotId = sid;
        selectedSlotNumber = snum;
        selectedSlotLabel = label;
        showLowerSteps();
      }
      renderSlotGrid(currentSlots);
      updateSelectedCallout();
      updateSummary();
    });
  });

  // Allow deselect by clicking the already-selected slot
  container.querySelectorAll('.bslot.selected').forEach((el) => {
    el.addEventListener('click', () => {
      selectedSlotId = null;
      selectedSlotNumber = null;
      selectedSlotLabel = null;
      hideLowerSteps();
      renderSlotGrid(currentSlots);
      updateSelectedCallout();
      updateSummary();
    });
  });

  renderSlotStats(slots);
  updateSelectedCallout();
}

async function loadSlotGrid(zoneId) {
  const section = document.getElementById('slotPickerSection');
  section.style.display = 'block';

  const mock = ZONE_SLOT_MOCKS[zoneId];
  showSlotSkeleton(mock ? mock.totalSlots : 20);

  document.getElementById('slotPickerTitle').textContent =
    (selectedZone ? selectedZone.name : '') + ' — tap a green slot to select it';

  // Try live slots API first
  let data = null;
  try { data = await ParkEaseAPI.getSlots(zoneId); } catch (_) {}

  if (Array.isArray(data) && data.length > 0) {
    currentSlots = data;
  } else {
    // Try getSlotStatus fallback
    try {
      const statusData = await ParkEaseAPI.getSlotStatus(zoneId);
      if (statusData && statusData.slots) {
        const prefix = String.fromCharCode(64 + (((zoneId - 1) % 26) + 1));
        currentSlots = statusData.slots.map(s => ({
          id: s.slot_id,
          slot_id: s.slot_id,
          label: prefix + s.slot_number,
          slot_number: s.slot_number,
          status: s.status
        }));
      } else {
        currentSlots = buildMockSlots(zoneId);
      }
    } catch (_) {
      currentSlots = buildMockSlots(zoneId);
    }
  }

  renderSlotGrid(currentSlots);
}

function updateSelectedCallout() {
  const callout = document.getElementById('selectedSlotCallout');
  const textEl  = document.getElementById('selectedSlotText');
  if (selectedSlotLabel !== null) {
    textEl.textContent = `Slot ${selectedSlotLabel} selected — tap to deselect`;
    callout.classList.add('show');
  } else {
    callout.classList.remove('show');
  }
}

document.getElementById('clearSlotBtn').addEventListener('click', () => {
  selectedSlotId = null;
  selectedSlotNumber = null;
  selectedSlotLabel = null;
  renderSlotGrid(currentSlots);
  hideLowerSteps();
  updateSummary();
});

// ── Progressive reveal helpers ───────────────────────────────────────────────

function showLowerSteps() {
  document.getElementById('durationLabel').style.display = '';
  document.getElementById('durationGrid').style.display  = '';
  document.getElementById('payLabel').style.display      = '';
  document.getElementById('payGrid').style.display       = '';
}

function hideLowerSteps() {
  document.getElementById('durationLabel').style.display = 'none';
  document.getElementById('durationGrid').style.display  = 'none';
  document.getElementById('payLabel').style.display      = 'none';
  document.getElementById('payGrid').style.display       = 'none';
  selectedHours = null;
  durationGrid.querySelectorAll('.duration-card').forEach((b) => b.classList.remove('selected'));
  summaryCard.style.display = 'none';
}

// ── Duration rendering ──────────────────────────────────────────────────────

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

// ── Payment selection (Counter / Cash only) ───────────────────────────────────

payGrid.querySelectorAll('.pay-card').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedPayment = btn.dataset.method;
    payGrid.querySelectorAll('.pay-card').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    updateSummary();
  });
});

// ── Summary card ────────────────────────────────────────────────────────────

function updateSummary() {
  if (!selectedZone || !selectedSlotLabel || !selectedHours) {
    summaryCard.style.display = 'none';
    return;
  }
  const d = rates.find((x) => x.hours === selectedHours);
  document.getElementById('sumZone').textContent     = selectedZone.name;
  document.getElementById('sumSlot').textContent     = `Slot ${selectedSlotLabel}`;
  document.getElementById('sumDuration').textContent = d.label;
  document.getElementById('sumPayment').textContent  = PAYMENT_LABELS[selectedPayment] || 'Pay at Counter';
  document.getElementById('sumTotal').textContent    = `NPR ${d.rate}`;
  summaryCard.style.display = 'block';
}

// ── Confirm booking ─────────────────────────────────────────────────────────

confirmBtn.addEventListener('click', async () => {
  errorBanner.classList.remove('show');

  if (!selectedZone) {
    errorBanner.textContent = 'Select a parking zone first.';
    errorBanner.classList.add('show');
    return;
  }
  if (!selectedSlotId && !selectedSlotNumber) {
    errorBanner.textContent = 'Please select an available (green) parking slot.';
    errorBanner.classList.add('show');
    return;
  }
  if (!selectedHours) {
    errorBanner.textContent = 'Select a parking duration before confirming.';
    errorBanner.classList.add('show');
    return;
  }

  // Determine user email: either logged-in user or demo input
  let userEmail = '';
  if (loggedInState && loggedInState.style.display !== 'none') {
    userEmail = (activeUser && activeUser.email) || localStorage.getItem('parkease_email') || '';
  }
  if (!userEmail && demoEmailInput) {
    userEmail = demoEmailInput.value.trim();
  }
  if (!userEmail) {
    userEmail = 'driver.demo@gmail.com';
  }

  if (!isValidGmail(userEmail)) {
    errorBanner.textContent = 'Please enter a valid @gmail.com address (e.g. driver.demo@gmail.com) for your entry token.';
    errorBanner.classList.add('show');
    return;
  }

  let token = localStorage.getItem('parkease_token');
  if (!token) {
    token = 'demo_token_' + Date.now();
    localStorage.setItem('parkease_token', token);
    localStorage.setItem('parkease_email', userEmail);
  }

  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Reserving & Sending Token…';

  const res = await ParkEaseAPI.createBooking({
    zoneId: selectedZone.id,
    slotId: selectedSlotId,
    slotNumber: selectedSlotNumber,
    hours: selectedHours,
    token,
    sendToEmail: userEmail,
    paymentMethod: selectedPayment,
  });

  confirmBtn.disabled = false;
  confirmBtn.textContent = 'Confirm & Reserve Slot →';

  if (res.success) {
    // Mark the booked slot as occupied (red) in local data
    const bookedSlot = currentSlots.find(s => (s.id || s.slot_id) === selectedSlotId || s.slot_number === selectedSlotNumber);
    if (bookedSlot) bookedSlot.status = 'occupied';
    const bookedLabel = selectedSlotLabel || `Slot ${selectedSlotNumber}`;
    const bookedZoneName = selectedZone.name;
    const bookedHours = selectedHours;
    const bookedRate = rates.find(r => Number(r.hours) === bookedHours);
    const bookedAmount = bookedRate ? bookedRate.rate : (bookedHours * 40);
    selectedSlotId = null;
    selectedSlotNumber = null;
    selectedSlotLabel = null;
    renderSlotGrid(currentSlots);

    // Brief delay so user sees the slot turn red before switching views
    await new Promise(r => setTimeout(r, 600));

    showConfirmationView(res, userEmail, bookedZoneName, bookedLabel, bookedHours, bookedAmount, selectedPayment);
  } else {
    errorBanner.textContent = res.message || 'Booking failed. Try again.';
    errorBanner.classList.add('show');
  }
});

// Copy token code to clipboard
function copyTokenCode() {
  const tokenEl = document.getElementById('displayTokenCode');
  const msgEl = document.getElementById('copySuccessMsg');
  if (tokenEl) {
    navigator.clipboard.writeText(tokenEl.textContent).then(() => {
      if (msgEl) { msgEl.style.display = 'block'; setTimeout(() => { msgEl.style.display = 'none'; }, 2000); }
    }).catch(() => {
      // Fallback for older browsers
      const range = document.createRange();
      range.selectNode(tokenEl);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      document.execCommand('copy');
      window.getSelection().removeAllRanges();
      if (msgEl) { msgEl.style.display = 'block'; setTimeout(() => { msgEl.style.display = 'none'; }, 2000); }
    });
  }
}

// ── Shared confirmation view helper ──────────────────────────────────────────

function showConfirmationView(res, userEmail, zoneName, slotLabel, hours, amount, payMethod) {
  selectView.style.display = 'none';
  confirmView.style.display = 'block';

  const recipient = res.recipient || userEmail;
  const bookingToken = res.booking_token || res.token || 'PE-' + Math.random().toString(36).substr(2, 6).toUpperCase();

  const sentEmailEl = document.getElementById('sentEmail');
  const sentBadgeEl = document.getElementById('sentBadge');
  if (sentEmailEl) sentEmailEl.textContent = recipient;
  if (sentBadgeEl) sentBadgeEl.style.display = 'flex';

  const tokenCodeEl = document.getElementById('displayTokenCode');
  if (tokenCodeEl) tokenCodeEl.textContent = bookingToken;

  const confirmZoneEl = document.getElementById('confirmZoneName');
  const confirmSlotEl = document.getElementById('confirmSlotName');
  const confirmDurationEl = document.getElementById('confirmDuration');
  const confirmAmountEl = document.getElementById('confirmTotalAmount');
  const confirmPayEl = document.getElementById('confirmPaymentMethod');
  if (confirmZoneEl) confirmZoneEl.textContent = zoneName;
  if (confirmSlotEl) confirmSlotEl.textContent = slotLabel;
  if (confirmDurationEl) confirmDurationEl.textContent = hours === 24 ? 'Full day (24h)' : `${hours} hour(s)`;
  if (confirmAmountEl) confirmAmountEl.textContent = `NPR ${amount}`;
  if (confirmPayEl) confirmPayEl.textContent = PAYMENT_LABELS[payMethod] || 'Pay at Counter';
}

// ── Khalti: intercept confirm when Khalti is selected ────────────────────────

const originalConfirmClick = confirmBtn.onclick; // preserve
const confirmBtnParent = confirmBtn.parentNode;

// We wrap the confirm button click to check for Khalti
confirmBtn.addEventListener('click', async (e) => {
  if (selectedPayment !== 'khalti') return; // let the default handler above run

  // Prevent the default (counter) handler from also firing
  e.stopImmediatePropagation();
  errorBanner.classList.remove('show');

  if (!selectedZone) { errorBanner.textContent = 'Select a parking zone first.'; errorBanner.classList.add('show'); return; }
  if (!selectedSlotId && !selectedSlotNumber) { errorBanner.textContent = 'Please select an available parking slot.'; errorBanner.classList.add('show'); return; }
  if (!selectedHours) { errorBanner.textContent = 'Select a parking duration before confirming.'; errorBanner.classList.add('show'); return; }

  let userEmail = '';
  if (loggedInState && loggedInState.style.display !== 'none') {
    userEmail = (activeUser && activeUser.email) || localStorage.getItem('parkease_email') || '';
  }
  if (!userEmail && demoEmailInput) userEmail = demoEmailInput.value.trim();
  if (!userEmail) userEmail = 'driver.demo@gmail.com';

  if (!isValidGmail(userEmail)) {
    errorBanner.textContent = 'Please enter a valid @gmail.com address for your entry token.';
    errorBanner.classList.add('show');
    return;
  }

  let token = localStorage.getItem('parkease_token');
  if (!token) {
    token = 'demo_token_' + Date.now();
    localStorage.setItem('parkease_token', token);
    localStorage.setItem('parkease_email', userEmail);
  }

  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Connecting to Khalti…';

  const res = await ParkEaseAPI.initiateKhaltiPayment({
    zoneId: selectedZone.id,
    slotId: selectedSlotId,
    slotNumber: selectedSlotNumber,
    hours: selectedHours,
    token,
    sendToEmail: userEmail,
  });

  if (res.success && res.payment_url) {
    // Save context so we can populate confirmation after return
    sessionStorage.setItem('parkease_khalti_ctx', JSON.stringify({
      bookingToken: res.booking_token,
      zoneName: selectedZone.name,
      slotLabel: selectedSlotLabel,
      hours: selectedHours,
      amount: res.amount,
      email: userEmail,
    }));
    // Redirect to Khalti payment page
    window.location.href = res.payment_url;
  } else {
    errorBanner.textContent = res.message || 'Could not connect to Khalti. Please try again.';
    errorBanner.classList.add('show');
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirm & Reserve Slot →';
  }
}, true); // useCapture = true so this fires BEFORE the default handler

// ── Khalti: detect return from payment page ──────────────────────────────────

async function handleKhaltiReturn() {
  const params = new URLSearchParams(window.location.search);
  const pidx = params.get('pidx');
  if (!pidx) return false;

  // Show loading overlay
  const overlay = document.getElementById('khaltiVerifyOverlay');
  if (overlay) overlay.style.display = 'flex';

  const khaltiStatus = params.get('status') || '';
  const bookingToken = params.get('purchase_order_id') || '';
  const ctx = JSON.parse(sessionStorage.getItem('parkease_khalti_ctx') || '{}');

  // Clean URL so refresh doesn't re-verify
  window.history.replaceState({}, document.title, window.location.pathname);
  sessionStorage.removeItem('parkease_khalti_ctx');

  if (khaltiStatus === 'Completed') {
    const res = await ParkEaseAPI.verifyKhaltiPayment(pidx, bookingToken || ctx.bookingToken || '');

    if (overlay) overlay.style.display = 'none';

    if (res.success) {
      selectView.style.display = 'none';
      showConfirmationView(
        res,
        res.recipient || ctx.email || '',
        res.zone_name || ctx.zoneName || '',
        res.slot_label || ctx.slotLabel || '',
        res.hours || ctx.hours || 0,
        res.amount || ctx.amount || 0,
        'khalti'
      );
      return true;
    } else {
      errorBanner.textContent = res.message || 'Payment verification failed.';
      errorBanner.classList.add('show');
      return true;
    }
  } else {
    // User canceled or payment failed
    if (overlay) overlay.style.display = 'none';
    errorBanner.textContent = `Khalti payment was not completed (status: ${khaltiStatus || 'unknown'}). Your slot has been released.`;
    errorBanner.classList.add('show');

    // Try to verify to trigger cleanup
    if (bookingToken || ctx.bookingToken) {
      await ParkEaseAPI.verifyKhaltiPayment(pidx, bookingToken || ctx.bookingToken || '');
    }
    return true;
  }
}

// ── Init ────────────────────────────────────────────────────────────────────

(async function init() {
  // Check for Khalti return FIRST
  const isKhaltiReturn = await handleKhaltiReturn();
  if (isKhaltiReturn) return; // Don't load normal booking UI

  await checkAuthSession();
  [zones, rates] = await Promise.all([ParkEaseAPI.getZones(), ParkEaseAPI.getRates()]);
  renderZones();
  renderDurations();
})();
