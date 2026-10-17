const bookBtn = document.getElementById('bookBtn');
if (bookBtn) {
  bookBtn.addEventListener('click', () => {
    const zoneSelect = document.getElementById('zoneSelect');
    const durationSelect = document.getElementById('durationSelect');
    const result = document.getElementById('bookResult');
    if (zoneSelect && durationSelect && result) {
      const zone = zoneSelect.value.split(' — ')[0];
      const durationText = durationSelect.selectedOptions[0].text;
      result.textContent = `✓ Slot reserved in ${zone} for ${durationText}. Confirmation token sent to your Gmail.`;
    }
  });
}

