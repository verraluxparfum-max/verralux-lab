/* R&D: Clone Trials (Dilution Ladders) */

window.RDCloneTrials = (() => {
  async function render(root) {
    const trials = await DB.getAll('clone_trials');
    const ingredients = await DB.getAll('ingredients');
    const references = await DB.getAll('reference_perfumes');

    root.appendChild(el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn btn-primary', onclick: () => openSeriesForm(ingredients, references) }, '+ New Dilution Trial Series')
    ]));

    if (!trials.length) {
      root.appendChild(emptyState('🧪', 'No clone trials yet. Start a dilution ladder to find the perfect concentration for a clone oil.'));
      return;
    }

    const listContainer = el('div', { class: 'card-grid' });
    
    for (const t of trials.sort((a,b) => b.date.localeCompare(a.date))) {
      const oil = ingredients.find(i => i.id === t.cloneOilId);
      const ref = references.find(r => r.id === t.referenceId);
      const tests = await DB.getByIndex('clone_trial_tests', 'trialId', t.id);
      
      const card = el('div', { class: 'card', onclick: () => viewSeriesDetail(t, oil, ref, tests, ingredients) }, [
        el('div', { class: 'card-head' }, [
          el('div', { class: 'card-title' }, oil ? oil.name : 'Unknown Oil'),
          el('span', { class: 'badge badge-purple' }, `${tests.length} tests`)
        ]),
        el('div', { class: 'card-sub' }, [
          el('div', {}, `Target: ${ref ? ref.name : 'N/A'} ${ref?.brand ? `(${ref.brand})` : ''}`),
          el('div', { class: 'muted-small mt-4' }, `Started: ${fmtDate(t.date)}`)
        ]),
        t.purpose ? el('div', { class: 'muted-note mt-8 truncate' }, t.purpose) : null
      ]);
      listContainer.appendChild(card);
    }

    root.appendChild(listContainer);
  }

  function openSeriesForm(ingredients, references, existing = null) {
    const cloneOils = ingredients.filter(i => i.type === 'Clone/Base Oil');
    const form = el('div', { class: 'modal-form' });

    form.appendChild(formSectionHeader('Trial Series Setup'));
    form.appendChild(selectField('Clone Oil to Test *', 'cloneOilId', 
      cloneOils.map(o => ({ value: o.id, label: o.name })), existing?.cloneOilId, true));
    form.appendChild(selectField('Target Reference Perfume', 'referenceId', 
      references.map(r => ({ value: r.id, label: `${r.name} (${r.brand})` })), existing?.referenceId));
    
    form.appendChild(el('div', { class: 'form-row-2' }, [
      field('Date Started', 'date', existing?.date || todayISO(), true, 'date'),
      selectField('Carrier', 'carrier', ['Perfumer\'s Alcohol', 'DPG', 'TEC', 'IPM'], existing?.carrier || 'Perfumer\'s Alcohol')
    ]));
    
    form.appendChild(textareaField('Hypothesis / Purpose', 'purpose', existing?.purpose, false, 'e.g., "Finding the best projection without alcohol burn."'));

    openModal(existing ? 'Edit Trial Series' : 'New Dilution Ladder', form, async () => {
      const data = formData(form.closest('form'));
      const record = {
        ...(existing || {}),
        cloneOilId: data.cloneOilId,
        referenceId: data.referenceId,
        date: data.date,
        carrier: data.carrier,
        purpose: data.purpose.trim()
      };
      await DB.add('clone_trials', record, 'dts');
      toast('Trial series saved', 'success');
      render(document.getElementById('rd-body'));
    }, { wide: true });
  }

  function viewSeriesDetail(series, oil, ref, tests, ingredients) {
    const content = el('div', {}, [
      el('div', { class: 'stat-strip mb-16' }, [
        statBox('Oil', oil ? oil.name : 'Unknown'),
        statBox('Target', ref ? ref.name : 'None'),
        statBox('Carrier', series.carrier || 'Alcohol'),
      ]),
      
      series.purpose ? el('div', { class: 'muted-note mb-16' }, series.purpose) : null,
      
      el('div', { class: 'flex justify-between items-center mb-12' }, [
        formSectionHeader('Dilution Tests'),
        el('button', { class: 'btn-ghost', onclick: () => {
          document.querySelector('.modal-close').click();
          openTestForm(series, null);
        }}, '+ Add Test %')
      ]),

      tests.length ? el('table', { class: 'data-table compact mb-16' }, [
        el('thead', {}, el('tr', {}, ['Conc. %', 'Mixed On', 'Accuracy', 'Projection', 'Winner', ''].map(h => el('th', {}, h)))),
        el('tbody', {}, tests.sort((a,b) => a.concentration - b.concentration).map(t => el('tr', { class: t.isWinner ? 'row-warn' : '' }, [
          el('td', { class: 'num font-bold' }, `${t.concentration}%`),
          el('td', {}, fmtDate(t.dateMixed)),
          el('td', {}, t.accuracy ? `${t.accuracy}/10` : '—'),
          el('td', {}, t.projection ? `${t.projection}/10` : '—'),
          el('td', {}, t.isWinner ? '👑 Yes' : ''),
          el('td', { class: 'actions' }, [
            el('button', { class: 'btn-icon', onclick: () => {
              document.querySelector('.modal-close').click();
              openTestForm(series, t);
            }}, '✎')
          ])
        ])))
      ]) : el('div', { class: 'empty-state p-12 mb-16' }, 'No dilutions mixed yet. Add a test (e.g. 20%).')
    ]);

    openModal(`Trial Series: ${oil?.name}`, content, async () => {}, { submitLabel: 'Close', wide: true });
  }

  function openTestForm(series, existing) {
    const form = el('div', { class: 'modal-form' });

    form.appendChild(formSectionHeader('Mix Details'));
    form.appendChild(el('div', { class: 'form-row-2' }, [
      field('Concentration (%) *', 'concentration', existing?.concentration, true, 'number'),
      field('Batch Size (ml/g)', 'batchSize', existing?.batchSize || 10, true, 'number')
    ]));
    form.appendChild(field('Date Mixed', 'dateMixed', existing?.dateMixed || todayISO(), true, 'date'));

    form.appendChild(formSectionHeader('Evaluation Results (24h+ later)'));
    form.appendChild(el('div', { class: 'form-row-2' }, [
      field('Accuracy vs Ref (1-10)', 'accuracy', existing?.accuracy, false, 'number'),
      field('Projection/Strength (1-10)', 'projection', existing?.projection, false, 'number')
    ]));
    form.appendChild(textareaField('Performance Notes', 'notes', existing?.notes, false, 'e.g., "Alcohol burn fades after 5 mins. Heart notes very close to original."'));
    form.appendChild(checkboxField('🏆 Mark as Winning Concentration', 'isWinner', existing?.isWinner));

    openModal(existing ? `Edit ${existing.concentration}% Test` : 'New Dilution Test', form, async () => {
      const data = formData(form.closest('form'));
      const isWinner = !!form.closest('form').querySelector('[name=isWinner]').checked;
      
      const record = {
        ...(existing || {}),
        trialId: series.id,
        concentration: parseFloat(data.concentration),
        batchSize: parseFloat(data.batchSize),
        dateMixed: data.dateMixed,
        accuracy: parseFloat(data.accuracy) || null,
        projection: parseFloat(data.projection) || null,
        notes: data.notes.trim(),
        isWinner
      };

      // If marked winner, unmark others in this series
      if (isWinner) {
        const tests = await DB.getByIndex('clone_trial_tests', 'trialId', series.id);
        for (const t of tests) {
          if (t.id !== record.id && t.isWinner) {
            t.isWinner = false;
            await DB.put('clone_trial_tests', t);
          }
        }
      }

      await DB.add('clone_trial_tests', record, 'dtt');
      toast(`Saved test for ${record.concentration}%`, 'success');
      render(document.getElementById('rd-body'));
    });
  }

  return { render };
})();