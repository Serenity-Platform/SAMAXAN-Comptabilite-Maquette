// SAMAXAN Comptabilité - Dark Mode Manager
// Gère le toggle light/dark avec persistence localStorage

class ThemeManager {
  constructor() {
    this.themeKey = 'samaxan-compta-theme';
    this.init();
  }
  
  init() {
    // Récupérer préférence sauvegardée ou système
    const savedTheme = localStorage.getItem(this.themeKey);
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    this.setTheme(theme, false); // false = pas d'animation initiale
    
    // Écouter changement préférence système
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(this.themeKey)) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
  
  setTheme(theme, animate = true) {
    if (animate) {
      document.documentElement.style.setProperty('--transition-speed', '0.2s');
    } else {
      document.documentElement.style.setProperty('--transition-speed', '0s');
    }
    
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.themeKey, theme);
    
    // Dispatch event pour autres composants
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    
    // Restaurer transition après
    if (!animate) {
      setTimeout(() => {
        document.documentElement.style.setProperty('--transition-speed', '0.2s');
      }, 50);
    }
  }
  
  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
    return next;
  }
  
  getCurrent() {
    return document.documentElement.getAttribute('data-theme');
  }
}

// Instance globale
const themeManager = new ThemeManager();

// Fonction helper pour toggle depuis HTML
function toggleTheme() {
  themeManager.toggle();
}

// Export pour usage module (optionnel)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { themeManager, toggleTheme };
}
