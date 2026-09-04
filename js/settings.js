/* Settings Module — App Configuration, Lab Branding, Data Management & Backup */

window.Settings = (() => {
  async function render(root) {
    window.App.setViewTitle('Settings');
    root.innerHTML = '';

    const labName = await DB.getSetting('lab_name', 'Verralux Parfum');
    const defaultCurrency = await DB.getSetting('default_currency', '₹');

    // Section 1: Lab Branding
    root.appendChild(formSectionHeader('Lab & Enterprise Profile'));
    
    const brandForm = el('div', { class: 'card mb-16' }, [
      field('Lab / Brand Name', 'lab_name', labName, true, 'text', 'Appears on printed Batch Records and COA documents.'),
      field('Default Currency Symbol', 'default_currency', defaultCurrency, true, 'text', 'e.g. ₹, $, €, £'),
      el('button', { class: 'btn btn-primary btn-sm mt-12', onclick: async (e) => {
        const nameVal = brandForm.querySelector('[name=lab_name]').value.trim();
        const currVal = brandForm.querySelector('[name=default_currency]').value.trim();
        
        if (nameVal) await DB.setSetting('lab_name', nameVal);
        if (currVal) await DB.setSetting('default_currency', currVal);
        
        toast('Lab profile updated', 'success');
      }}, 'Save Profile')
    ]);
    root.appendChild(brandForm);

    // Section 2: Data Management
    root.appendChild(formSectionHeader('Data Management & Backup'));

    const dataCard = el('div', { class: 'card mb-16' }, [
      el('div', { class: 'card-sub' }, 'All data is stored locally in your device IndexedDB. Back up regularly.'),
      
      el('div', { class: 'flex-col gap-8 mt-12' }, [
        el('button', { class: 'btn btn-secondary btn-block', onclick: () => exportData() }, '💾 Download Backup JSON'),
        
        el('label', { class: 'btn btn-secondary btn-block', style: 'cursor:pointer' }, [
          '📂 Restore / Import Backup JSON',
          el('input', { type: 'file', accept: '.json', style: 'display:none', onchange: (e) => importData(e) })
        ]),

        el('button', { class: 'btn-ghost', onclick: () => reseedMaterials() }, '🔄 Re-seed 150+ Default Aroma Materials')
      ])
    ]);
    root.appendChild(dataCard);

    // Section 3: Danger Zone
    root.appendChild(formSectionHeader('Danger Zone'));

    const dangerCard = el('div', { class: 'card mb-16', style: 'border-color:var(--danger-bg)' }, [
      el('div', { class: 'card-title text-danger' }, 'Wipe All Data'),
      el('div', { class: 'card-sub' }, 'Permanently delete all library ingredients, formulas, trials, and batch records.'),
      el('button', { class: 'btn btn-block mt-12', style: 'background:var(--danger)', onclick: () => wipeDatabase() }, '🔥 Reset / Wipe Database')
    ]);
    root.appendChild(dangerCard);

    // Section 4: App Info
    root.appendChild(formSectionHeader('Application Info'));
    root.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'flex justify-between items-center' }, [
        el('strong', {}, 'Verralux Lab Journal'),
        el('span', { class: 'badge badge-info' }, 'v1.0.0')
      ]),
      el('div', { class: 'muted-small mt-8' }, 'Local-first offline PWA lab notebook & GMP production journal.'),
      el('div', { class: 'muted-small mt-4' }, 'Storage Engine: IndexedDB (verralux_lab_journal)')
    ]));
  }

  // --- Handlers ---
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
      toast('Backup file downloaded', 'success');
    } catch (err) {
      toast('Backup failed: ' + err.message, 'error');
    }
  }

  async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const wipe = await confirmDialog(
      'RESTORE BACKUP\n\nDo you want to wipe existing data first?\n\nClick "Wipe First" to replace local data entirely, or "Merge Data" to combine records.',
      'Wipe First', 'Merge Data', true
    );

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const count = await DB.importAll(data, { wipeFirst: wipe });
      toast(`Restored ${count} records`, 'success');
      render(document.getElementById('view'));
    } catch (err) {
      toast('Import failed: ' + err.message, 'error');
    }
    e.target.value = '';
  }

  async function reseedMaterials() {
    const ok = await confirmDialog(
      'RE-SEED INGREDIENTS\n\nThis will re-inject the 150+ default aroma chemicals and naturals into your Library.\n\nExisting materials will not be deleted. Continue?',
      'Re-seed Materials', 'Cancel', false
    );
    if (!ok) return;

    if (window.SEED_INGREDIENTS) {
      let added = 0;
      for (const ing of window.SEED_INGREDIENTS) {
        const existing = await DB.getByIndex('ingredients', 'name', ing.name);
        if (!existing.length) {
          const ifra = window.SEED_IFRA?.find(i => i.name.toLowerCase() === ing.name.toLowerCase());
          await DB.add('ingredients', {
            ...ing,
            currentStock: 0,
            ifraLimitCat4: ifra ? ifra.cat4_limit : null,
            ifraNote: ifra ? ifra.note : null
          }, 'ing');
          added++;
        }
      }
      toast(`Re-seeded ${added} new materials into Library`, 'success');
    }
  }

  async function wipeDatabase() {
    const ok = await confirmDialog(
      '🔥 WIPE ALL DATA\n\nAre you ABSOLUTELY SURE?\n\nThis will permanently delete ALL ingredients, accords, trials, formulas, and batch records.\n\nThis action CANNOT be undone.',
      'Wipe Everything', 'Cancel', true
    );
    if (!ok) return;

    await DB.wipeAll();
    localStorage.removeItem('vlj_last_route');
    toast('Database completely wiped', 'info');
    
    // Reload app
    setTimeout(() => location.reload(), 1000);
  }

  return { render };
})();