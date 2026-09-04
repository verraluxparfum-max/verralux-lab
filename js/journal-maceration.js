/* Journal: Maceration Timeline (Periodic Check-ins) */

window.JournalMaceration = (() => {
  async function render(root) {
    const allBatches = await DB.getAll('batches');
    const allCheckins = await DB.getAll('maceration_checkins');
    
    // Only batches that are Compounded or In Process (Macerating)
    const active = allBatches.filter(b => ['Compounded', 'Macerating', 'In Process'].includes(b.status));

    root.appendChild(el('div', { class: 'toolbar mb-16' }, [
      el('h4', { class: 'font-display' }, 'Maceration Timeline')
    ]));

    if (!active.length) {
      root.appendChild(emptyState('⏳', 'No batches currently macerating. Complete compounding on an active batch first.'));
      return;
    }

    const listContainer = el('div', { class: 'card-grid' });
    
    active.forEach(b => {
      const checks = allCheckins.filter(c => c.batchId === b.id).sort((x, y) => x.timestamp.localeCompare(y.timestamp));
      const daysSinceStart = daysBetween(b.date, todayISO());
      
      const card = el('div', { class: 'card' }, [
        el('div', { class: 'card-head' }, [
          el('div', { class: 'card-title text-mono' }, b.batchNumber),
          el('span', { class: 'badge badge-info' }, `Day ${daysSinceStart}`)
        ]),
        el('div', { class: 'card-sub' }, `Check-ins logged: ${checks.length}`),
        
        checks.length ? el('div', { class: 'mt-8 mb-12', style: 'border-left:2px solid var(--line); padding-left:10px;' }, [
          el('div', { class: 'muted-small font-bold mb-4' }, 'LATEST CHECK-IN:'),
          el('div', { class: 'truncate' }, `Color: ${checks[checks.length-1].color || '—'} | Clarity: ${checks[checks.length-1].clarity || '—'}`),
          checks[checks.length-1].notes ? el('div', { class: 'muted-small truncate mt-4' }, checks[checks.length-1].notes) : null
        ]) : null,
        
        el('div', { class: 'card-actions mt-12 flex gap-8' }, [
          el('button', { class: 'btn btn-primary btn-sm flex-1', style: 'background:var(--sage)', onclick: () => addCheckin(b, daysSinceStart) }, 'Log Check-in'),
          checks.length ? el('button', { class: 'btn-secondary btn-sm', onclick: () => viewTimeline(b, checks) }, 'History') : null
        ])
      ]);
      listContainer.appendChild(card);
    });

    root.appendChild(listContainer);
  }

  function addCheckin(batch, currentDay) {
    const form = el('div', { class: 'modal-form' });
    
    form.appendChild(formSectionHeader(`Day ${currentDay} Observation`));
    
    form.appendChild(el('div', { class: 'form-row-2' }, [
      field('Color (Visual)', 'color', '', false, 'text', 'e.g., Pale Yellow, Amber'),
      selectField('Clarity', 'clarity', ['Crystal Clear', 'Slight Haze', 'Turbid / Cloudy', 'Separation'], 'Crystal Clear', true)
    ]));
    
    form.appendChild(el('div', { class: 'form-row-2' }, [
      selectField('Precipitate Observed?', 'precipitate', ['No', 'Light Sediment', 'Heavy Sediment'], 'No'),
      field('Storage Temp (°C)', 'temp', '', false, 'number')
    ]));
    
    form.appendChild(textareaField('Olfactive Evolution / Notes', 'notes', '', false, 'How is the scent maturing? Any harsh notes rounding off?'));
    
    form.appendChild(selectField('Next Action', 'action', [
      'Continue Maceration', 
      'Ready for Filtration/QC',
      'Requires Cold Stabilization'
    ], 'Continue Maceration', true));

    openModal(`Log Check-in: ${batch.batchNumber}`, form, async () => {
      const data = formData(form.closest('form'));
      
      const record = {
        batchId: batch.id,
        timestamp: nowISO(),
        day: currentDay,
        color: data.color.trim(),
        clarity: data.clarity,
        precipitate: data.precipitate,
        temp: parseFloat(data.temp) || null,
        notes: data.notes.trim(),
        action: data.action
      };

      await DB.append('maceration_checkins', record, 'mac');
      
      if (batch.status === 'Compounded') {
        batch.status = 'Macerating';
        await DB.put('batches', batch);
      }
      
      toast('Observation permanently logged', 'success');
      render(document.getElementById('journal-body'));
    }, { appendOnly: true, submitLabel: 'Lock Observation' });
  }

  // --- UPDATED VIEW FUNCTION WITH PRINT SUPPORT ---
  function viewTimeline(batch, checks) {
    const content = el('div', { class: 'timeline-view', id: 'print-area' }, 
      checks.map(c => el('div', { class: 'mb-16 pb-16', style: 'border-bottom:1px dashed var(--line)' }, [
        el('div', { class: 'flex justify-between items-center mb-8' }, [
          el('strong', {}, `Day ${c.day} Check-in`),
          el('span', { class: 'muted-small text-mono' }, fmtDateTime(c.timestamp))
        ]),
        el('div', { class: 'form-row-2 mb-8' }, [
          detailField('Color', c.color),
          detailField('Clarity', c.clarity),
          detailField('Precipitate', c.precipitate),
          detailField('Storage Temp', c.temp ? `${c.temp}°C` : null)
        ]),
        c.notes ? el('div', { class: 'muted-note mb-8' }, c.notes) : null,
        el('div', { class: 'badge badge-info mt-4' }, `Action: ${c.action}`)
      ]))
    );

    // Create the Print Button
    const printBtn = el('button', { 
      class: 'btn-secondary btn-sm', 
      onclick: () => window.print() 
    }, '🖨 Print Timeline');

    openModal(`Maceration Log: ${batch.batchNumber}`, content, async () => {}, { wide: true, submitLabel: 'Close' });
    
    // Inject the print button into the modal footer
    const footer = document.querySelector('.modal-footer');
    footer.insertBefore(printBtn, footer.firstChild);
    footer.querySelector('.btn-secondary:not(.btn-sm)').remove(); // remove default cancel
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