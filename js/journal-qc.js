/* Journal: QC & Testing (IFRA, Stability, Sensory) */

window.JournalQC = (() => {
  async function render(root) {
    const allBatches = await DB.getAll('batches');
    const allTests = await DB.getAll('qc_tests');
    
    // Batches ready for QC or currently in QC
    const active = allBatches.filter(b => ['Macerating', 'In QC', 'Filtration'].includes(b.status));

    if (!active.length) {
      root.appendChild(emptyState('🔬', 'No batches currently in Quality Control phase.'));
      return;
    }

    const listContainer = el('div', { class: 'card-grid' });
    
    active.forEach(b => {
      const tests = allTests.filter(t => t.batchId === b.id);
      
      const card = el('div', { class: 'card' }, [
        el('div', { class: 'card-head' }, [
          el('div', { class: 'card-title text-mono' }, b.batchNumber),
          el('span', { class: 'badge badge-neutral' }, `${tests.length} tests logged`)
        ]),
        
        el('div', { class: 'card-actions mt-16 flex-wrap gap-8' }, [
          el('button', { class: 'btn-secondary btn-sm', onclick: () => addTest(b, 'Organoleptic') }, 'Organoleptic'),
          el('button', { class: 'btn-secondary btn-sm', onclick: () => addTest(b, 'Stability') }, 'Stability'),
          el('button', { class: 'btn-secondary btn-sm', onclick: () => addTest(b, 'Olfactory') }, 'Olfactory Panel'),
          tests.length ? el('button', { class: 'btn-ghost btn-sm', onclick: () => viewTests(b, tests) }, 'View Results') : null
        ])
      ]);
      listContainer.appendChild(card);
    });

    root.appendChild(listContainer);
  }

  function addTest(batch, type) {
    const form = el('div', { class: 'modal-form' });
    form.appendChild(formSectionHeader(`${type} Test`));
    
    if (type === 'Organoleptic') {
      form.appendChild(selectField('Appearance', 'appearance', ['Pass (Clear)', 'Fail (Turbid)', 'Fail (Color mismatch)'], 'Pass (Clear)', true));
      form.appendChild(selectField('Odor Profile', 'odor', ['Pass (Matches standard)', 'Fail (Off-notes)'], 'Pass (Matches standard)', true));
      form.appendChild(field('pH / Refractive Index (Optional)', 'metric', ''));
    } 
    else if (type === 'Stability') {
      form.appendChild(selectField('Test Protocol', 'protocol', ['45°C Accelerated (14 Days)', 'Freeze/Thaw Cycle', 'UV Light Exposure'], '45°C Accelerated (14 Days)', true));
      form.appendChild(selectField('Result', 'result', ['Pass', 'Fail (Separation)', 'Fail (Discoloration)'], 'Pass', true));
    }
    else if (type === 'Olfactory') {
      form.appendChild(el('div', { class: 'form-row-2' }, [
        field('Projection (1-10)', 'projection', '', true, 'number'),
        field('Longevity (1-10)', 'longevity', '', true, 'number')
      ]));
      form.appendChild(selectField('Accuracy to Brief/Reference', 'accuracy', ['Perfect Match', 'Acceptable', 'Needs Rework'], 'Acceptable', true));
      form.appendChild(field('Evaluator Name', 'evaluator', '', true));
    }

    form.appendChild(textareaField('Inspector Notes', 'notes', ''));

    openModal(`Log ${type} Test`, form, async () => {
      const data = formData(form.closest('form'));
      const record = {
        batchId: batch.id,
        testType: type,
        timestamp: nowISO(),
        data: data // Save all arbitrary form data fields dynamically
      };

      await DB.append('qc_tests', record, 'qct');
      
      batch.status = 'In QC';
      await DB.put('batches', batch);
      
      toast('Test result permanently logged', 'success');
      render(document.getElementById('journal-body'));
    }, { appendOnly: true, submitLabel: 'Lock Test Result' });
  }

  function viewTests(batch, tests) {
    const content = el('div', {}, 
      tests.map(t => el('div', { class: 'mb-16 pb-16', style: 'border-bottom:1px dashed var(--line)' }, [
        el('div', { class: 'flex justify-between items-center mb-8' }, [
          el('strong', { class: 'text-amber' }, t.testType),
          el('span', { class: 'muted-small text-mono' }, fmtDateTime(t.timestamp))
        ]),
        el('div', { class: 'muted-note mb-4' }, JSON.stringify(t.data, null, 2).replace(/[{}""]/g, '').replace(/,/g, '\n')),
      ]))
    );
    openModal(`QC Record: ${batch.batchNumber}`, content, async () => {}, { submitLabel: 'Close' });
    document.querySelector('.modal-footer .btn-secondary').remove();
  }

  return { render };
})();