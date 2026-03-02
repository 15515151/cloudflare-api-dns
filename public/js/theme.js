(function () {
  const STORAGE_KEY = 'theme';

  function getTheme() {
    return localStorage.getItem(STORAGE_KEY) || 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function toggleTheme(e) {
    const current = getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    const x = e.clientX, y = e.clientY;
    const r = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const doSwitch = () => {
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
    };

    if (!document.startViewTransition) {
      doSwitch();
      return;
    }

    const style = document.createElement('style');
    style.textContent = `
      ::view-transition-old(root) { animation: none; }
      ::view-transition-new(root) {
        animation: theme-reveal 0.7s ease-in-out;
      }
      @keyframes theme-reveal {
        from { clip-path: circle(0px at ${x}px ${y}px); }
        to   { clip-path: circle(${r * 1.05}px at ${x}px ${y}px); }
      }
    `;
    document.head.appendChild(style);
    const transition = document.startViewTransition(doSwitch);
    transition.finished.finally(() => style.remove());
  }

  applyTheme(getTheme());

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getTheme());
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.addEventListener('click', toggleTheme);
  });
})();
