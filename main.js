/**
 * SafeSpot – Main Utilities & UI Helpers
 * Toast notifications, modals, and common formatting functions.
 */

// Toast Notification System
function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '✅',
    danger: '⚠️',
    warning: '🔔',
    info: 'ℹ️'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span style="font-size: 1.2rem;">${icons[type] || 'ℹ️'}</span>
    <span style="flex: 1;">${message}</span>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, 4000);
}

// Modal Toggle Handlers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Theme Toggle System (Light / Dark)
function initTheme() {
  const savedTheme = localStorage.getItem('safespot_theme') || 
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setTheme(savedTheme, false);

  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      setTheme(next, true);
    });
  }
}

function setTheme(theme, showNotification = true) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('safespot_theme', theme);

  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.innerHTML = theme === 'dark' ? '<span>☀️</span>' : '<span>🌙</span>';
    toggleBtn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  }

  // Synchronize map tiles if on home map view
  const mapElement = document.getElementById('map');
  if (mapElement && typeof switchBaseLayer === 'function') {
    if (theme === 'dark' && window.currentBasemapKey !== 'satellite' && window.currentBasemapKey !== 'topo') {
      switchBaseLayer('dark', false);
    } else if (theme === 'light' && window.currentBasemapKey === 'dark') {
      switchBaseLayer('streets', false);
    }
  }

  if (showNotification) {
    showToast(`${theme === 'dark' ? '🌙 Dark' : '☀️ Light'} theme enabled`, 'info');
  }
}

// Global modal close on click outside or ESC key
document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => {
        m.classList.remove('active');
        document.body.style.overflow = '';
      });
    }
  });
});

// Category Formatting Helper
function getCategoryMeta(category) {
  const map = {
    lighting: { label: 'Poor Lighting', icon: '💡', color: '#f59e0b' },
    pothole: { label: 'Road / Pothole', icon: '🚧', color: '#ea580c' },
    harassment: { label: 'Unsafe Area', icon: '⚠️', color: '#e11d48' },
    obstruction: { label: 'Obstruction', icon: '🛑', color: '#8b5cf6' },
    flood: { label: 'Waterlogging', icon: '💧', color: '#0284c7' },
    electrical: { label: 'Electrical Hazard', icon: '⚡', color: '#eab308' },
    traffic: { label: 'Traffic / Signal', icon: '🚸', color: '#06b6d4' },
    animal: { label: 'Stray Animal', icon: '🐕', color: '#84cc16' },
    other: { label: 'Other Hazard', icon: '📍', color: '#64748b' }
  };
  return map[category] || { label: category, icon: '📍', color: '#64748b' };
}

// Date Formatter
function formatDate(isoString) {
  if (!isoString) return 'Just now';
  try {
    const d = new Date(isoString.replace(' ', 'T'));
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (e) {
    return isoString;
  }
}
