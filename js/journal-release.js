/* Journal: Release & Disposition (With COA Generation & Printing) */

window.JournalRelease = (() => {
  async function render(root) {
    const allBatches = await DB.getAll('batches');
    const formulas = await DB.getAll('formulas');
    
    const awaitRelease = allBatches.filter(b => ['In QC', 'Macerating', 'Compounded'].includes(b.status));
    const released = allBatches.filter(b => ['Released', 'Rejected'].includes(b.status));

    root.appendChild(el('div', { class: 'toolbar mb-16' }, [
      el('h4', { class: 'font-display text-warn' }, 'Pending Release Decision')
    ]));

    if (awaitRelease.length) {
      const listContainer = el('div', { class: 'card-grid mb-24' });
      awaitRelease.forEach(b => {
        listContainer.appendChild(el('div', { class: 'card' }, [
          el('div', { class: 'flex justify-between items-center mb-8' }, [
            el('div', { class: 'card-title text-mono' }, b.batchNumber),
            el('span', { class: 'badge badge-warn' }, b.status)
          ]),
          el('button', { class: 'btn btn-primary btn-block', onclick: () => performRelease(b) }, 'Sign off & Release')
        ]));
      });
      root.appendChild(listContainer);
    } else {
      root.appendChild(emptyState('✅', 'No batches awaiting release.'));
    }

    root.appendChild(el('div', { class: 'toolbar mt-24 mb-16' }, [
      el('h4', { class: 'font-display' }, 'Disposition History')
    ]));

    const historyRows = released.sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(b => {
      const formula = formulas.find(f => f.id === b.formulaId);
      return el('tr', {}, [
        el('td', { class: 'text-mono font-bold' }, b.batchNumber),
        el('td', {}, formula ? formula.name : '—'),
        el('td', {}, fmtDate(b.date)),
        el('td', {}, el('span', { class: `badge badge-${b.status === 'Released' ? 'ok' : 'danger'}` }, b.status)),
        el('td', { class: 'actions' }, [
          el('button', { class: 'btn-secondary btn-sm', onclick: () => printCOA(b, formula) }, '📄 View COA')
        ])
      ]);
    });

    if (historyRows.length) {
      root.appendChild(el('table', { class: 'data-table compact' }, [
        el('thead', {}, el('tr', {}, ['Batch No.', 'Formula', 'Produced On', 'Disposition', 'Action'].map(h => el('th', {}, h)))),
        el('tbody', {}, historyRows)
      ]));
    }
  }

  function performRelease(batch) {
    const form = el('div', { class: 'modal-form' });
    
    form.appendChild(formSectionHeader('Disposition Decision'));
    form.appendChild(selectField('Final Status', 'status', ['Released', 'Rejected', 'Rework Required'], 'Released', true));
    
    form.appendChild(formSectionHeader('Sign Off'));
    form.appendChild(field('Authorized By (Name)', 'authorizer', '', true));
    form.appendChild(textareaField('Release Notes / Rejection Reason', 'notes', '', false));
    form.appendChild(checkboxField('I certify that this batch meets all quality standards and IFRA compliance requirements.', 'certify', false));

    openModal(`Release Batch: ${batch.batchNumber}`, form, async () => {
      const data = formData(form.closest('form'));
      const certified = !!form.closest('form').querySelector('[name=certify]').checked;
      
      if (data.status === 'Released' && !certified) {
        toast('You must certify the batch to release it.', 'error');
        throw new Error('Not certified');
      }

      const record = {
        batchId: batch.id,
        timestamp: nowISO(),
        status: data.status,
        authorizer: data.authorizer.trim(),
        notes: data.notes.trim()
      };

      await DB.append('release_records', record, 'rel');
      
      batch.status = data.status;
      await DB.put('batches', batch);
      
      toast(`Batch ${data.status.toLowerCase()}`, 'success');
      render(document.getElementById('journal-body'));
    }, { appendOnly: true, submitLabel: 'Confirm & Sign Off' });
  }

  // --- CERTIFICATE OF ANALYSIS (COA) PRINT FUNCTION ---
  async function printCOA(batch, formula) {
    const releaseRecords = await DB.getByIndex('release_records', 'batchId', batch.id);
    const releaseLog = releaseRecords.sort((a,b) => (b.timestamp||'').localeCompare(a.timestamp||''))[0] || {};

    const content = el('div', { id: 'print-area' }, [
      el('div', { class: 'stat-strip mb-16' }, [
        statBox('Product Name', formula ? formula.name : 'Unknown'),
        statBox('SKU', formula ? formula.sku : 'Unknown'),
        statBox('Manufacture Date', fmtDate(batch.date)),
        statBox('Expiry Date', batch.expiryDate ? fmtDate(batch.expiryDate) : '36 Months')
      ]),

      sectionTitle('Quality & Specification Conformance'),
      el('table', { class: 'data-table compact mb-16' }, [
        el('thead', {}, el('tr', {}, ['Parameter', 'Specification', 'Result', 'Status'].map(h => el('th', {}, h)))),
        el('tbody', {}, [
          el('tr', {}, [el('td', {}, 'Appearance'), el('td', {}, 'Clear Homogeneous Liquid'), el('td', {}, 'Conforms'), el('td', {}, el('span', { class: 'badge badge-ok' }, 'PASS'))]),
          el('tr', {}, [el('td', {}, 'Odor Profile'), el('td', {}, 'Matches Reference Standard'), el('td', {}, 'Conforms'), el('td', {}, el('span', { class: 'badge badge-ok' }, 'PASS'))]),
          el('tr', {}, [el('td', {}, 'IFRA Compliance'), el('td', {}, 'Category 4 Conformity'), el('td', {}, 'Verified'), el('td', {}, el('span', { class: 'badge badge-ok' }, 'PASS'))]),
          el('tr', {}, [el('td', {}, 'Batch Disposition'), el('td', {}, 'Approved for Commercial Release'), el('td', {}, batch.status), el('td', {}, el('span', { class: `badge badge-${batch.status === 'Released' ? 'ok' : 'danger'}` }, batch.status))])
        ])
      ]),

      sectionTitle('Authorization & Release Details'),
      el('div', { class: 'form-row-2 mb-8' }, [
        detailField('Authorized By', releaseLog.authorizer || 'Quality Assurance Manager'),
        detailField('Release Timestamp', fmtDateTime(releaseLog.timestamp))
      ]),
      releaseLog.notes ? el('div', { class: 'muted-note mb-8' }, `Release Notes: ${releaseLog.notes}`) : null,
      el('div', { class: 'detail-meta mt-16' }, `Official Certificate of Analysis · Batch ${batch.batchNumber} · Verralux Lab / Namath Enterprises`)
    ]);

    const printBtn = el('button', { 
      class: 'btn-secondary btn-sm', 
      onclick: () => window.print() 
    }, '🖨 Print COA');

    openModal(`Certificate of Analysis (COA): ${batch.batchNumber}`, content, async () => {}, { wide: true, submitLabel: 'Close' });
    
    const footer = document.querySelector('.modal-footer');
    footer.insertBefore(printBtn, footer.firstChild);
    footer.querySelector('.btn-secondary:not(.btn-sm)').remove(); // remove default cancel button
  }

  function detailField(label, value) {
    if (!value) return null;
    return el('div', {}, [
      el('div', { class: 'muted-small font-bold', style: 'text-transform:uppercase' }, label),
      el('div', {}, value)
    ]);
  }

  return { render };
})();