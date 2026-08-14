(() => {
  const form = document.querySelector('#generator-form');
  const button = document.querySelector('#generate');
  const status = document.querySelector('#status');
  const resultCard = document.querySelector('#result-card');
  const result = document.querySelector('#result');
  const copy = document.querySelector('#copy');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    button.disabled = true;
    status.textContent = 'Génération en cours…';
    resultCard.hidden = true;
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      const response = await fetch('/api/generer-contenu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'La génération est temporairement indisponible.');
      result.textContent = data.text;
      result.style.whiteSpace = 'pre-wrap';
      resultCard.hidden = false;
      status.textContent = `${data.remaining} génération(s) restante(s) aujourd’hui.`;
    } catch (error) {
      status.textContent = `⚠️ ${error.message}`;
    } finally {
      button.disabled = false;
    }
  });

  copy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(result.textContent);
    copy.textContent = '✅ Copié';
    setTimeout(() => { copy.textContent = 'Copier le contenu'; }, 1800);
  });
})();
