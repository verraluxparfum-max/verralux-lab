/* App Shell — Initialization, Router, Navigation, Seeding, PWA Installer */

const App = (() => {
  let currentRoute = 'library';
  let deferredInstallPrompt = null;

  const ROUTES = {
    library:  { title: 'Library', module: () => window.Library },
    rd:       { title: 'R&D Workbench', module: () => window.RD },
    journal:  { title: 'Production Journal', module: () => window.Journal },
    reports:  { title: 'Reports', module: () => window.Reports },
    settings: { title: 'Settings', module: () => window.Settings }
  };

  async function init() {
    try {
      await openDB();
      await runFirstTimeSetup();
      wireNavigation();
      wireMenu();
      wirePWAInstall();
      
      // Load last route or default
      const savedRoute = localStorage.getItem('vlj_last_route') || 'library';
      await navigate(ROUTES[savedRoute] ? savedRoute : 'library');
    } catch (err) {
      document.getElementById('view').innerHTML = emptyState('❌', 'Database initialization failed. Please try clearing site data.');
      console.error('App init error:', err);
    }
  }

  async function runFirstTimeSetup() {
    const isSeeded = await DB.get('seed_status', 'initial_seed');
    if (isSeeded) return;

    console.log('Running first-time setup and seeding database...');
    
    // Seed Raw Materials
    if (window.SEED_INGREDIENTS && Array.isArray(window.SEED_INGREDIENTS)) {
      for (const ing of window.SEED_INGREDIENTS) {
        // Find IFRA limits if available
        const ifra = window.SEED_IFRA?.find(i => 
          i.name.toLowerCase() === ing.name.toLowerCase() || (i.cas && ing.cas === i.cas)
        );
        
        await DB.add('ingredients', {
          ...ing,
          currentStock: 0,
          ifraLimitCat4: ifra ? ifra.cat4_limit : null,
          ifraNote: ifra ? ifra.note : null
        }, 'ing');
      }
    }

    // Seed Initial App Settings
    await DB.put('app_settings', { key: 'default_currency', value: '₹' });
    await DB.put('app_settings', { key: 'lab_name', value: 'Verralux Parfum' });

    await DB.put('seed_status', { key: 'initial_seed', value: true, date: nowISO() });
  }

  function wireNavigation() {
    const navBtns = document.querySelectorAll('.tab-btn');
    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        navigate(btn.dataset.route);
      });
    });

    const backBtn = document.getElementById('btn-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        // Allow modules to handle their own back stack
        const mod = ROUTES[currentRoute].module();
        if (mod && mod.handleBack) {
          mod.handleBack();
        }
      });
    }
  }

  function wirePWAInstall() {
    // Listen for Chrome PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
    });

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      toast('Verralux Lab App installed on home screen!', 'success');
    });
  }

  function wireMenu() {
    const menuBtn = document.getElementById('btn-menu');
    const host = document.getElementById('menu-host');
    if (!menuBtn || !host) return;
    
    menuBtn.addEventListener('click', () => {
      host.innerHTML = '';
      const backdrop = el('div', { class: 'menu-backdrop', onclick: () => host.innerHTML = '' });
      
      const menuItems = [];

      // If PWA install prompt is available (Chrome Android), display Install button
      if (deferredInstallPrompt) {
        menuItems.push(el('button', { 
          class: 'menu-item', 
          style: 'color:var(--amber); font-weight:700;',
          onclick: async () => { 
            host.innerHTML = ''; 
            deferredInstallPrompt.prompt();
            const { outcome } = await deferredInstallPrompt.userChoice;
            if (outcome === 'accepted') {
              toast('Installing Verralux Lab App...', 'info');
              deferredInstallPrompt = null;
            }
          } 
        }, '📲 Install App on Android'));
        menuItems.push(el('div', { class: 'menu-divider' }));
      }

      menuItems.push(el('button', { 
        class: 'menu-item', 
        onclick: async () => { host.innerHTML = ''; await exportData(); } 
      }, '💾 Backup Data'));

      menuItems.push(el('label', { class: 'menu-item' }, [
        '📂 Restore Data',
        el('input', { 
          type: 'file', 
          accept: '.json', 
          style: 'display:none', 
          onchange: (e) => { host.innerHTML = ''; importData(e); } 
        })
      ]));

      menuItems.push(el('div', { class: 'menu-divider' }));

      menuItems.push(el('button', { 
        class: 'menu-item', 
        onclick: () => { host.innerHTML = ''; toggleTheme(); } 
      }, '🌙 Toggle Dark Mode'));

      const popover = el('div', { class: 'menu-popover' }, menuItems);
      backdrop.appendChild(popover);
      host.appendChild(backdrop);
    });
  }

  async function navigate(route) {
    if (!ROUTES[route]) return;
    
    currentRoute = route;
    localStorage.setItem('vlj_last_route', route);
    
    // Update active tab highlighting
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.route === route);
    });
    
    document.getElementById('view-title').textContent = ROUTES[route].title;
    
    // Render view with a smooth transition
    const view = document.getElementById('view');
    view.innerHTML = '';
    view.appendChild(loadingView());
    
    // Short delay to allow DOM thread clearing and animation frame update
    await new Promise(r => setTimeout(r, 40));
    
    view.innerHTML = '';
    
    const mod = ROUTES[route].module();
    if (mod && mod.render) {
      await mod.render(view);
    } else {
      view.innerHTML = emptyState('⚙️', 'Module loading...');
    }
    
    // Reset back button state
    updateBackButton(false);
  }

  function updateBackButton(show) {
    const btn = document.getElementById('btn-back');
    if (btn) {
      if (show) btn.classList.add('show');
      else btn.classList.remove('show');
    }
  }

  function setViewTitle(title) {
    const titleEl = document.getElementById('view-title');
    if (titleEl) titleEl.textContent = title;
  }

  // --- Data Export & Backup ---
  async function exportData() {
    try {
      const data = await DB.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `verralux-lab-backup-${todayISO()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Backup saved successfully', 'success');
    } catch (err) {
      toast('Backup failed: ' + err.message, 'error');
    }
  }

  async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const wipe = await confirmDialog(
      'RESTORE BACKUP\n\nDo you want to wipe existing data first?\n\nIf you click "Wipe First", all current local data will be replaced. If you click "Merge Data", new records will be merged with existing entries.',
      'Wipe First', 'Merge Data', true
    );

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const count = await DB.importAll(data, { wipeFirst: wipe });
      toast(`Imported ${count} records successfully`, 'success');
      navigate(currentRoute);
    } catch (err) {
      toast('Import failed: ' + err.message, 'error');
    }
    e.target.value = '';
  }

  // --- Dark Mode ---
  function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('vlj_theme', isDark ? 'dark' : 'light');
    toast(`Switched to ${isDark ? 'Dark' : 'Light'} Mode`, 'info');
  }

  // Apply saved theme preference on startup
  if (localStorage.getItem('vlj_theme') === 'dark') {
    document.body.classList.add('dark-mode');
  }

  return { init, navigate, updateBackButton, setViewTitle };
})();

window.App = App;
window.addEventListener('DOMContentLoaded', () => App.init());

// Service Worker Registration for Offline Use
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('Service Worker registration failed:', err);
    });
  });
}