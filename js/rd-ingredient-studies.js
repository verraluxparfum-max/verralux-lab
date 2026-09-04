/* R&D: Ingredient Studies (Single-Material Deep Dives & Dilution Testing) */

window.RDIngredientStudies = (() => {
  async function render(root) {
    root.innerHTML = '';

    const studies = await DB.getAll('ingredient_studies');
    const ingredients = await DB.getAll('ingredients');

    root.appendChild(el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn btn-primary', onclick: () => openStudyForm(ingredients) }, '+ New Ingredient Study')
    ]));

    root.appendChild(el('div', { class: 'muted-note mb-16' }, 
      'Log single-material evaluations: test materials at 1%, 10%, 100% dilutions, track substantivity hours on paper, and record best pairings.'));

    if (!studies.length) {
      // FIXED: Use appendChild instead of innerHTML assignment
      root.appendChild(emptyState('🔬', 'No ingredient studies yet. Select an aroma chemical or natural from your library to log a single-material evaluation.'));
      return;
    }

    const listContainer = el('div', { class: 'card-grid' });

    for (const s of studies.sort((a, b) => (b.date || '').localeCompare(a.date || ''))) {
      const ing = ingredients.find(i => i.id === s.ingredientId);

      const card = el('div', { class: 'card', onclick: () => viewStudyDetail(s, ing) }, [
        el('div', { class: 'card-head' }, [
          el('div', { class: 'card-title' }, ing ? ing.name : 'Unknown Ingredient'),
          el('span', { class: 'badge badge-info' }, ing ? ing.type : 'Material')
        ]),
        el('div', { class: 'card-sub' }, [
          el('div', {}, `Substantivity: ${s.substantivityHours ? `${s.substantivityHours} hrs on paper` : 'Not recorded'}`),
          el('div', { class: 'muted-small mt-4' }, `Evaluated: ${fmtDate(s.date)}`)
        ]),
        s.verdict ? el('div', { class: 'muted-note mt-8 truncate' }, `Verdict: ${s.verdict}`) : null
      ]);

      listContainer.appendChild(card);
    }

    root.appendChild(listContainer);
  }

  function viewStudyDetail(study, ing) {
    const content = el('div', {}, [
      el('div', { class: 'stat-strip mb-16' }, [
        statBox('Material', ing ? ing.name : 'Unknown'),
        statBox('Volatility', ing ? (ing.volatility || '—') : '—'),
        statBox('Substantivity', study.substantivityHours ? `${study.substantivityHours} hrs` : '—')
      ]),

      study.dilutionNotes ? el('div', { class: 'mb-16' }, [
        formSectionHeader('Dilution Swatch Notes'),
        el('div', { class: 'muted-note mt-8', style: 'white-space:pre-wrap;' }, study.dilutionNotes)
      ]) : null,

      study.bestPairings ? el('div', { class: 'mb-16' }, [
        formSectionHeader('Best Pairings'),
        el('div', { class: 'mt-8' }, study.bestPairings)
      ]) : null,

      study.clashes ? el('div', { class: 'mb-16' }, [
        formSectionHeader('Combinations to Avoid'),
        el('div', { class: 'mt-8 text-danger' }, study.clashes)
      ]) : null,

      study.verdict ? el('div', { class: 'mb-16' }, [
        formSectionHeader('Perfumer Verdict'),
        el('div', { class: 'mt-8 font-bold' }, study.verdict)
      ]) : null
    ]);

    const editBtn = el('button', { class: 'btn-secondary btn-sm', onclick: () => {
      document.querySelector('.modal-close').click();
      openStudyForm(null, study);
    }}, '✎ Edit Study');

    openModal(`Study: ${ing ? ing.name : 'Ingredient'}`, content, async () => {}, { wide: true, submitLabel: 'Close' });
    document.querySelector('.modal-footer').insertBefore(editBtn, document.querySelector('.modal-footer').firstChild);
  }

  async function openStudyForm(ingredientsList = null, existing = null) {
    const ingredients = ingredientsList || await DB.getAll('ingredients');
    
    // Exclude packaging materials
    const aromatics = ingredients.filter(i => !['Bottle', 'Cap/Closure', 'Atomizer', 'Box/Packaging', 'Sticker/Label'].includes(i.type));
    aromatics.sort((a,b) => (a.name||'').localeCompare(b.name||''));

    const form = el('div', { class: 'modal-form' });

    form.appendChild(formSectionHeader('Ingredient Selection'));
    form.appendChild(selectField('Ingredient / Material *', 'ingredientId', 
      aromatics.map(i => ({ value: i.id, label: `${i.name} (${i.type})` })), existing?.ingredientId, true));
    
    form.appendChild(field('Evaluation Date', 'date', existing?.date || todayISO(), true, 'date'));

    form.appendChild(formSectionHeader('Performance & Behavior'));
    form.appendChild(field('Substantivity on Paper (Hours)', 'substantivityHours', existing?.substantivityHours, false, 'number', 'e.g. 48 for Iso E Super, 400 for Ambroxan'));

    form.appendChild(textareaField('Dilution Swatch Notes (1%, 10%, 100%)', 'dilutionNotes', existing?.dilutionNotes, false, 'e.g., "100%: Sharp cedar/scratchy. 10%: Velvety transparent wood. 1%: Subtle radiance."'));

    form.appendChild(formSectionHeader('Combinations & Pairings'));
    form.appendChild(field('Best Pairings Discovered', 'bestPairings', existing?.bestPairings, false, 'text', 'e.g., Hedione, Vetiver, Ambroxan, Galaxolide'));
    form.appendChild(field('Avoid Combining With', 'clashes', existing?.clashes, false, 'text', 'e.g., Heavy Clove/Eugenol, strong aldehyde C12'));

    form.appendChild(textareaField('Perfumer Verdict / Key Takeaway', 'verdict', existing?.verdict, false, 'e.g., "Essential workhorse for volume. Keep formula usage between 15% and 30%."'));

    openModal(existing ? 'Edit Ingredient Study' : 'New Ingredient Study', form, async () => {
      const data = formData(form.closest('form'));
      
      const record = {
        ...(existing || {}),
        ingredientId: data.ingredientId,
        date: data.date,
        substantivityHours: parseFloat(data.substantivityHours) || null,
        dilutionNotes: data.dilutionNotes.trim(),
        bestPairings: data.bestPairings.trim(),
        clashes: data.clashes.trim(),
        verdict: data.verdict.trim()
      };

      await DB.add('ingredient_studies', record, 'ins');
      toast('Ingredient study saved', 'success');
      render(document.getElementById('rd-body'));
    }, { wide: true });

    if (existing) {
      const delBtn = el('button', { type: 'button', class: 'btn-icon danger', onclick: async () => {
        if (await confirmDialog('Delete this ingredient study?')) {
          await DB.delete('ingredient_studies', existing.id);
          toast('Study deleted', 'success');
          document.querySelector('.modal-close').click();
          render(document.getElementById('rd-body'));
        }
      }}, '✕');
      
      const footer = document.querySelector('.modal-footer');
      footer.insertBefore(delBtn, footer.firstChild);
    }
  }

  return { render };
})();