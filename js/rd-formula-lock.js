/* R&D: Formula Lock 
   Bridges R&D winners into the main ERP Formulas table for Production */

window.RDFormulaLock = (() => {
  async function render(root) {
    const locked = await DB.getAll('formula_locks');

    root.appendChild(el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn btn-primary', onclick: () => openLockWizard() }, '🔒 Lock New Formula')
    ]));

    root.appendChild(el('div', { class: 'muted-note mb-16' }, 
      'When an R&D experiment is finished and approved, "Lock" it here. This converts trial parts into precise percentages and sends it to the Production Formulas library.'));

    if (!locked.length) {
      root.appendChild(emptyState('🔒', 'No formulas locked for production yet. Finish an R&D trial and lock the winner here.'));
      return;
    }

    const rows = locked.sort((a,b) => b.lockedAt.localeCompare(a.lockedAt)).map(l => {
      return el('tr', {}, [
        el('td', {}, el('strong', {}, l.name)),
        el('td', {}, el('code', {}, l.sku)),
        el('td', {}, el('span', { class: 'badge badge-info' }, l.sourceType)),
        el('td', {}, fmtDate(l.lockedAt)),
        el('td', { class: 'num' }, `${(l.ingredients || []).length} items`),
        el('td', { class: 'actions' }, [
          el('button', { class: 'btn-ghost', onclick: () => toast('To edit a locked formula, go to the Inventory > Formulas tab.', 'info') }, 'View in Production')
        ])
      ]);
    });

    root.appendChild(el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, ['Perfume Name', 'SKU', 'Source', 'Locked On', 'Ingredients', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, rows)
    ]));
  }

  async function openLockWizard() {
    // Fetch all potential winners
    const cloneTests = await DB.getAll('clone_trial_tests');
    const compIters = await DB.getAll('composition_iterations');
    
    const cloneWinners = cloneTests.filter(t => t.isWinner);
    const compWinners = compIters.filter(i => i.isWinner);

    if (!cloneWinners.length && !compWinners.length) {
      toast('No winning trials found. Mark a trial or iteration as a "Winner" first.', 'error');
      return;
    }

    const comps = await DB.getAll('original_compositions');
    const trials = await DB.getAll('clone_trials');
    const materials = await DB.getAll('materials');

    const form = el('div', { class: 'modal-form' });
    
    form.appendChild(formSectionHeader('1. Select Winning R&D Trial'));
    
    const sourceOptions = [el('option', { value: '' }, '— select winner —')];
    
    if (compWinners.length) {
      const grp = el('optgroup', { label: 'Original Compositions' });
      compWinners.forEach(w => {
        const parent = comps.find(c => c.id === w.compositionId);
        if (parent) grp.appendChild(el('option', { value: `comp_${w.id}` }, `${parent.name} (Iteration v${w.version})`));
      });
      sourceOptions.push(grp);
    }

    if (cloneWinners.length) {
      const grp = el('optgroup', { label: 'Clone Dilution Trials' });
      cloneWinners.forEach(w => {
        const parent = trials.find(t => t.id === w.trialId);
        const oil = parent ? materials.find(m => m.id === parent.cloneOilId) : null;
        if (parent && oil) grp.appendChild(el('option', { value: `clone_${w.id}` }, `${oil.name} at ${w.concentration}%`));
      });
      sourceOptions.push(grp);
    }

    form.appendChild(el('div', { class: 'form-group' }, [
      el('select', { name: 'sourceId', required: 'required' }, sourceOptions)
    ]));

    form.appendChild(formSectionHeader('2. Production Identity'));
    form.appendChild(field('Final Perfume Name *', 'name', '', true));
    form.appendChild(field('Official SKU Code *', 'sku', '', true));
    
    form.appendChild(el('div', { class: 'form-row-2' }, [
      field('Standard Batch Size', 'batchSize', 1000, true, 'number'),
      selectField('Unit', 'batchUnit', ['ml', 'g', 'kg'], 'ml')
    ]));

    openModal('Lock Formula for Production', form, async () => {
      const data = formData(form.closest('form'));
      const sourceVal = data.sourceId;
      if (!sourceVal) throw new Error('Select a source');

      let finalIngredients = [];
      let sourceType = '';

      // Compile formula to normalized percentages
      if (sourceVal.startsWith('comp_')) {
        sourceType = 'Original Composition';
        const iterId = sourceVal.split('_')[1];
        const iter = compWinners.find(i => i.id === iterId);
        const totalParts = iter.ingredients.reduce((s, i) => s + i.parts, 0);
        
        finalIngredients = iter.ingredients.map(i => ({
          materialId: i.materialId,
          pct: parseFloat(((i.parts / totalParts) * 100).toFixed(4)) // normalize parts to %
        }));
      } 
      else if (sourceVal.startsWith('clone_')) {
        sourceType = 'Clone Dilution';
        const testId = sourceVal.split('_')[1];
        const test = cloneWinners.find(t => t.id === testId);
        const parent = trials.find(t => t.id === test.trialId);
        
        // Find alcohol/carrier in DB to create the other half of the formula
        const carrierMat = materials.find(m => m.name.toLowerCase().includes(parent.carrier.toLowerCase().split(' ')[0]));
        
        finalIngredients.push({ materialId: parent.cloneOilId, pct: test.concentration });
        if (carrierMat) {
          finalIngredients.push({ materialId: carrierMat.id, pct: 100 - test.concentration });
        } else {
          toast(`Warning: Could not find carrier "${parent.carrier}" in materials. Formula will equal ${test.concentration}% only.`, 'warn');
        }
      }

      const formulaRecord = {
        id: genId('frm'), // force a 'frm' ID so it matches ERP formulas
        name: data.name.trim(),
        sku: data.sku.trim(),
        batchSize: parseFloat(data.batchSize),
        batchUnit: data.batchUnit,
        ingredients: finalIngredients,
        createdAt: new Date().toISOString()
      };

      // 1. Save to main Formulas table (Makes it available in Inventory > Formulas)
      await DB.put('formulas', formulaRecord);

      // 2. Save lock record for R&D history
      await DB.add('formula_locks', {
        formulaId: formulaRecord.id,
        name: formulaRecord.name,
        sku: formulaRecord.sku,
        sourceType,
        sourceId: sourceVal,
        ingredients: finalIngredients,
        lockedAt: todayISO()
      }, 'lck');

      toast(`Formula ${formulaRecord.name} locked & sent to Production!`, 'success');
      render(document.getElementById('rd-body'));
    });
  }

  return { render };
})();