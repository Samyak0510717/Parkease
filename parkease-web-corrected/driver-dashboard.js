const zoneGrid = document.getElementById('zoneGrid');
const openSpaces = document.getElementById('openSpaces');
const liveZones = document.getElementById('liveZones');
const startingRate = document.getElementById('startingRate');
const accountPhone = document.getElementById('accountPhone');
const accountName = document.getElementById('accountName');

function renderZones(zones) {
  zoneGrid.innerHTML = zones.map((zone) => `
    <a class="zone-card" href="booking.html?zone=${encodeURIComponent(zone.id)}">
      <div><div class="zone-name">${zone.name}</div><div class="location">${zone.location || 'Kathmandu Valley'}</div></div>
      <div class="free ${zone.freeSlots <= 3 ? 'low' : ''}">${zone.freeSlots} of ${zone.totalSlots} spaces free</div>
    </a>
  `).join('');
}

async function loadDashboard() {
  const [zones, rates] = await Promise.all([ParkEaseAPI.getZones(), ParkEaseAPI.getRates()]);
  openSpaces.textContent = zones.reduce((sum, zone) => sum + Number(zone.freeSlots || 0), 0);
  liveZones.textContent = zones.length;
  const hourly = rates.find((rate) => Number(rate.hours) === 1) || rates[0];
  startingRate.textContent = hourly ? `NPR ${hourly.rate}` : '—';
  renderZones(zones);
}

accountPhone.textContent = localStorage.getItem('parkease_email') || '';
const savedName = localStorage.getItem('parkease_name');
accountName.textContent = savedName ? `, ${savedName.split(' ')[0]}` : '';

document.getElementById('logoutBtn').addEventListener('click', () => {
  ['parkease_token', 'parkease_phone', 'parkease_name'].forEach((key) => localStorage.removeItem(key));
  window.location.href = 'driver-login.html';
});

loadDashboard().catch(() => {
  zoneGrid.innerHTML = '<div class="loading">Live zones are temporarily unavailable. Please refresh in a moment.</div>';
});