/* Alternância de tema: Colorido (cores da ASVATH) ou Branco */
(() => {
  const btn = document.getElementById('theme-toggle');
  const label = document.getElementById('theme-label');
  if (!btn) return;
  const root = document.documentElement;
  const apply = (light) => {
    root.classList.toggle('theme-light', light);
    btn.setAttribute('aria-pressed', String(light));
    label.textContent = light ? 'Colorido' : 'Branco';
    try { localStorage.setItem('asvath-theme', light ? 'light' : 'color'); } catch (e) {}
  };
  apply(root.classList.contains('theme-light'));
  btn.addEventListener('click', () => apply(!root.classList.contains('theme-light')));
})();
