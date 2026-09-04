/* Reports Module — Lab Analytics, Stock Valuation & Overview Reports */

window.Reports = (() => {
  async function render(root) {
    window.App.setViewTitle('Lab Reports');
    root.innerHTML = '';

    // Load data from all stores
    const [
      ingredients,
      accords,
      references,
      cloneTrials,
      originalComps,
      formulaLocks,
      batches,
      checkins,
      qcTests
    ] = await Promise.all([
      DB.getAll('ingredients'),
      DB.getAll('accords'),
      DB.getAll('reference_perfumes'),
      DB.getAll('clone_trials'),
      DB.getAll('original_compositions'),
      DB.getAll('formula_locks'),
      DB.getAll('batches'),
      DB.getAll('maceration_checkins'),
      DB.getAll('qc_tests')
    ]);

    // Top action bar
    root.appendChild(el('div', { class: 'toolbar mb-16' }, [
      el('h4', { class: 'font-display', style: 'flex:1' }, 'Analytics & Summary'),
      el('button', { class: 'btn-secondary btn-sm', onclick: () => window.print() }, '🖨 Print Summary')
    ]));

    // --- SECTION 1: INVENTORY & PALETTE VALUATION ---
    root.appendChild(sectionTitle('Palette & Inventory Valuation'));

    const totalStockValue = ingredients.reduce((s, i) => s + (i.currentStock || 0) * (i.avgCost || 0), 0);
    const lowStockCount = ingredients.filter(i => i.reorderLevel != null && (i.currentStock || 0) <= i.reorderLevel).length;
    const aromaChemCount = ingredients.filter(i => i.type === 'Aroma Chemical').length;
    const naturalCount = ingredients.filter(i => ['Essential Oil', 'Absolute', 'CO2 Extract', 'Resinoid'].includes(i.type)).length;

    root.appendChild(el('div', { class: 'stat-grid' }, [
      statBox('Total Ingredients', String(ingredients.length)),
      statBox('Raw Material Value', fmtMoney(totalStockValue)),
      statBox('Aroma Chemicals', String(aromaChemCount)),
      statBox('Naturals & Absolutes', String(naturalCount)),
      statBox('Accords Built', String(accords.length)),
      statBox('Low Stock Items', String(lowStockCount), lowStockCount > 0 ? 'negative' : 'positive'),
    ]));

    // --- SECTION 2: R&D EXPERIMENTATION METRICS ---
    root.appendChild(sectionTitle('R&D & Formulation Progress'));

    const totalTrials = cloneTrials.length + originalComps.length;
    const lockedCount = formulaLocks.length;

    root.appendChild(el('div', { class: 'stat-grid' }, [
      statBox('Study Targets', String(references.length)),
      statBox('Clone Trial Series', String(cloneTrials.length)),
      statBox('Original Projects', String(originalComps.length)),
      statBox('Locked Formulas', String(lockedCount), 'positive'),
    ]));

    // --- SECTION 3: PRODUCTION & BATCH SUMMARY ---
    root.appendChild(sectionTitle('Production & Batch Journal'));

    const releasedBatches = batches.filter(b => b.status === 'Released');
    const maceratingBatches = batches.filter(b => ['Compounded', 'Macerating', 'In Process'].includes(b.status));
    const rejectedBatches = batches.filter(b => b.status === 'Rejected');
    const totalVolumeProduced = batches.reduce((s, b) => s + (b.quantityProduced || 0), 0);
    const totalProductionCost = batches.reduce((s, b) => s + (b.costPerUnit || 0) * (b.quantityProduced || 0), 0);

    root.appendChild(el('div', { class: 'stat-grid' }, [
      statBox('Total Batches', String(batches.length)),
      statBox('Currently Macerating', String(maceratingBatches.length)),
      statBox('Released Batches', String(releasedBatches.length), 'positive'),
      statBox('Rejected Batches', String(rejectedBatches.length), rejectedBatches.length > 0 ? 'negative' : null),
      statBox('Volume Produced', fmtNum(totalVolumeProduced, 0) + ' ml/g'),
      statBox('Production Value', fmtMoney(totalProductionCost)),
    ]));

    // --- SECTION 4: LOW STOCK WARNING TABLE ---
    const lowStockItems = ingredients.filter(i => i.reorderLevel != null && (i.currentStock || 0) <= i.reorderLevel);
    if (lowStockItems.length) {
      root.appendChild(sectionTitle('⚠️ Low Stock Raw Materials'));
      
      const rows = lowStockItems.map(i => el('tr', { class: 'row-warn' }, [
        el('td', { class: 'font-bold' }, i.name),
        el('td', {}, el('span', { class: 'badge badge-info' }, i.type)),
        el('td', { class: 'num' }, `${fmtNum(i.currentStock, 2)} ${i.unit}`),
        el('td', { class: 'num' }, `${fmtNum(i.reorderLevel, 2)} ${i.unit}`),
        el('td', { class: 'num font-bold', style: 'color:var(--danger)' }, `${fmtNum(Math.max(0, i.reorderLevel - i.currentStock), 2)} ${i.unit}`)
      ]));

      root.appendChild(el('table', { class: 'data-table compact' }, [
        el('thead', {}, el('tr', {}, ['Material', 'Type', 'Current', 'Reorder Lvl', 'Shortfall'].map(h => el('th', {}, h)))),
        el('tbody', {}, rows)
      ]));
    }

    // --- SECTION 5: LOCKED FORMULAS FOR PRODUCTION ---
    if (formulaLocks.length) {
      root.appendChild(sectionTitle('🔒 Production Formula Registry'));

      const lockRows = formulaLocks.sort((a,b) => (b.lockedAt||'').localeCompare(a.lockedAt||'')).map(l => el('tr', {}, [
        el('td', { class: 'font-bold' }, l.name),
        el('td', {}, el('code', {}, l.sku)),
        el('td', {}, el('span', { class: 'badge badge-neutral' }, l.sourceType || 'R&D')),
        el('td', {}, fmtDate(l.lockedAt)),
        el('td', { class: 'num' }, `${(l.ingredients || []).length} items`)
      ]));

      root.appendChild(el('table', { class: 'data-table compact' }, [
        el('thead', {}, el('tr', {}, ['Name', 'SKU', 'Source', 'Locked On', 'Ingredients'].map(h => el('th', {}, h)))),
        el('tbody', {}, lockRows)
      ]));
    }
  }

  return { render };
})();