document.getElementById('bookBtn').addEventListener('click', () => {
  const zone = document.getElementById('zoneSelect').value.split(' — ')[0];
  const durationText = document.getElementById('durationSelect').selectedOptions[0].text;
  const result = document.getElementById('bookResult');
  result.textContent = `✓ Slot reserved in ${zone} for ${durationText}. Confirmation token sent by SMS.`;
});
