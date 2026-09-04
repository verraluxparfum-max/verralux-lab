/* App Shell — Initialization, Router, Navigation, Seeding */

const App = (() => {
  let currentRoute = 'library';

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
      
      // Load last route or default
      const savedRoute = localStorage.getItem('vlj_last_route') || 'library';
      await navigate(ROUTES[savedRoute] ? savedRoute : 'library');
    } catch (err) {
      document.getElementById('view').innerHTML = emptyState('❌', 'Database initialization failed. Please try clearing site data.');
      console.error(err);
    }
  }

  async function runFirstTimeSetup() {
    const isSeeded = await DB.get('seed_status', 'initial_seed');
    if (isSeeded) return;

    console.log('Running first-time setup...');
    
    // Seed Ingredients
    if (window.SEED_INGREDIENTS) {
      for (const ing of window.SEED_INGREDIENTS) {
        // Find IFRA limits if available
        const ifra = window.SEED_IFRA?.find(i => i.name.toLowerCase() === ing.name.toLowerCase() || (i.cas && ing.cas === i.cas));
        
        await DB.add('ingredients', {
          ...ing,
          currentStock: 0,
          ifraLimitCat4: ifra ? ifra.cat4_limit : null,
          ifraNote: ifra ? ifra.note : null
        }, 'ing');
      }
    }

    // Seed Settings
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
    backBtn.addEventListener('click', () => {
      // Allow modules to handle their own back stack
      const mod = ROUTES[currentRoute].module();
      if (mod.handleBack) {
        mod.handleBack();
      }
    });
  }

  function wireMenu() {
    const menuBtn = document.getElementById('btn-menu');
    const host = document.getElementById('menu-host');
    
    menuBtn.addEventListener('click', () => {
      // Build top-right popover menu
      host.innerHTML = '';
      const backdrop = el('div', { class: 'menu-backdrop', onclick: () => host.innerHTML = '' });
      
      const popover = el('div', { class: 'menu-popover' }, [
        el('button', { class: 'menu-item', onclick: async () => { host.innerHTML = ''; await exportData(); } }, '💾 Backup Data'),
        el('label', { class: 'menu-item' }, [
          '📂 Restore Data',
          el('input', { type: 'file', accept: '.json', style: 'display:none', onchange: (e) => { host.innerHTML = ''; importData(e); } })
        ]),
        el('div', { class: 'menu-divider' }),
        el('button', { class: 'menu-item', onclick: () => { host.innerHTML = ''; toggleTheme(); } }, '🌙 Toggle Dark Mode'),
      ]);

      backdrop.appendChild(popover);
      host.appendChild(backdrop);
    });
  }

  async function navigate(route) {
    if (!ROUTES[route]) return;
    
    currentRoute = route;
    localStorage.setItem('vlj_last_route', route);
    
    // Update UI tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.route === route);
    });
    
    document.getElementById('view-title').textContent = ROUTES[route].title;
    
    // Render view
    const view = document.getElementById('view');
    view.innerHTML = '';
    view.appendChild(loadingView());
    
    // Short delay for visual feedback + letting thread clear
    await new Promise(r => setTimeout(r, 40));
    
    view.innerHTML = '';
    
    const mod = ROUTES[route].module();
    await mod.render(view);
    
    // Reset back button state
    updateBackButton(false);
  }

  function updateBackButton(show) {
    const btn = document.getElementById('btn-back');
    if (show) btn.classList.add('show');
    else btn.classList.remove('show');
  }

  function setViewTitle(title) {
    document.getElementById('view-title').textContent = title;
  }

  // --- Data Management ---
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
      'RESTORE BACKUP\n\nDo you want to wipe existing data first?\n\nIf you click "Wipe", all current data is deleted. If you click "Merge", new records are added but old ones remain.',
      'Wipe First', 'Merge Data', true
    );

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const count = await DB.importAll(data, { wipeFirst: wipe });
      toast(`Imported ${count} records`, 'success');
      navigate(currentRoute);
    } catch (err) {
      toast(err.message, 'error');
    }
    e.target.value = '';
  }

  function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('vlj_theme', isDark ? 'dark' : 'light');
  }

  // Apply saved theme on boot
  if (localStorage.getItem('vlj_theme') === 'dark') {
    document.body.classList.add('dark-mode');
  }

  return { init, navigate, updateBackButton, setViewTitle };
})();

window.App = App;
window.addEventListener('DOMContentLoaded', () => App.init());

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}