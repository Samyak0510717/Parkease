const zoneGrid = document.getElementById('zoneGrid');
const openSpaces = document.getElementById('openSpaces');
const liveZones = document.getElementById('liveZones');
const startingRate = document.getElementById('startingRate');
const accountPhone = document.getElementById('accountPhone');
const accountName = document.getElementById('accountName');

const ZONE_PHOTOS = {
  1: 'images/parking-2.jpg',
  2: 'images/parking-1.jpg',
  3: 'images/parking-3.jpg',
  4: 'images/parking-4.jpg'
};

function renderZones(zones) {
  zoneGrid.innerHTML = zones.map((zone) => {
    const photo = ZONE_PHOTOS[zone.id] || 'images/parking-2.jpg';
    return `
    <a class="zone-card" href="booking.html?zone=${encodeURIComponent(zone.id)}">
      <div class="zone-card-thumb">
        <img src="${photo}" alt="${zone.name}">
        <span class="thumb-badge">📸 Live Photo</span>
      </div>
      <div class="zone-card-content">
        <div>
          <div class="zone-name">${zone.name}</div>
          <div class="location">${zone.location || 'Kathmandu Valley'}</div>
        </div>
        <div class="zone-card-foot">
          <span class="free ${zone.freeSlots <= 3 ? 'low' : ''}">${zone.freeSlots} of ${zone.totalSlots} spaces free</span>
          <span class="book-action">Book Bay &rarr;</span>
        </div>
      </div>
    </a>
  `}).join('');
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
  ['parkease_token', 'parkease_email', 'parkease_phone', 'parkease_name'].forEach((key) => localStorage.removeItem(key));
  window.location.href = 'driver-login.html';
});

loadDashboard().catch(() => {
  zoneGrid.innerHTML = '<div class="loading">Live zones are temporarily unavailable. Please refresh in a moment.</div>';
});