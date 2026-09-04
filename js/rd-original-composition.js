/* R&D: Original Compositions (Top-Down Iterative Building) */

window.RDOriginalComposition = (() => {
  async function render(root) {
    const comps = await DB.getAll('original_compositions');
    
    root.appendChild(el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn btn-primary', onclick: () => openBriefForm() }, '+ New Composition Brief')
    ]));

    if (!comps.length) {
      root.appendChild(emptyState('✨', 'No original compositions yet. Create a brief for a new perfume idea.'));
      return;
    }

    const listContainer = el('div', { class: 'card-grid' });
    
    for (const c of comps.sort((a,b) => b.date.localeCompare(a.date))) {
      const iterations = await DB.getByIndex('composition_iterations', 'compositionId', c.id);
      const latest = iterations.sort((a,b) => b.version - a.version)[0];

      const card = el('div', { class: 'card', onclick: () => viewDetail(c, iterations) }, [
        el('div', { class: 'card-head' }, [
          el('div', { class: 'card-title' }, c.name),
          el('span', { class: 'badge badge-info' }, c.targetConcentration || 'EDP')
        ]),
        el('div', { class: 'card-sub' }, [
          el('div', {}, `Iterations: ${iterations.length} (Latest: v${latest ? latest.version : 0})`),
          el('div', { class: 'muted-small mt-4' }, `Family: ${(c.targetFamily || []).join(', ') || 'Unspecified'}`)
        ]),
        c.brief ? el('div', { class: 'muted-note mt-8 truncate' }, c.brief) : null
      ]);
      listContainer.appendChild(card);
    }
    root.appendChild(listContainer);
  }

  function openBriefForm(existing = null) {
    const form = el('div', { class: 'modal-form' });

    form.appendChild(formSectionHeader('Composition Identity'));
    form.appendChild(field('Working Name *', 'name', existing?.name, true));
    form.appendChild(selectField('Target Concentration', 'targetConcentration', ['EDC', 'EDT', 'EDP', 'Parfum', 'Extrait'], existing?.targetConcentration || 'EDP'));
    
    form.appendChild(formSectionHeader('Creative Brief'));
    form.appendChild(textareaField('The Brief / Inspiration', 'brief', existing?.brief, false, 'e.g., "A late-night bakery in Marrakech. Warm cardamom, smoky oud, powdery vanilla."'));
    
    form.appendChild(field('Target Top Notes', 'targetTop', existing?.targetTop));
    form.appendChild(field('Target Heart Notes', 'targetHeart', existing?.targetHeart));
    form.appendChild(field('Target Base Notes', 'targetBase', existing?.targetBase));

    openModal(existing ? 'Edit Brief' : 'New Original Composition', form, async () => {
      const data = formData(form.closest('form'));
      const record = {
        ...(existing || {}),
        name: data.name.trim(),
        targetConcentration: data.targetConcentration,
        brief: data.brief.trim(),
        targetTop: data.targetTop.trim(),
        targetHeart: data.targetHeart.trim(),
        targetBase: data.targetBase.trim(),
        date: existing?.date || todayISO()
      };
      await DB.add('original_compositions', record, 'cmp');
      toast('Composition brief saved', 'success');
      render(document.getElementById('rd-body'));
    }, { wide: true });
  }

  async function viewDetail(comp, iterations) {
    const ingredients = await DB.getAll('ingredients');

    const content = el('div', {}, [
      el('div', { class: 'mb-16' }, [
        formSectionHeader('Creative Brief'),
        el('div', { class: 'muted-note mt-8' }, comp.brief || 'No brief provided.')
      ]),

      el('div', { class: 'form-row-2 mb-16' }, [
        statBox('Top', comp.targetTop || '—'),
        statBox('Heart', comp.targetHeart || '—'),
        statBox('Base', comp.targetBase || '—')
      ]),

      el('div', { class: 'flex justify-between items-center mb-12' }, [
        formSectionHeader('Iterations (Formulas)'),
        el('button', { class: 'btn-secondary btn-sm', onclick: () => {
          document.querySelector('.modal-close').click();
          // Auto-increment version from the latest
          const latestV = iterations.length ? Math.max(...iterations.map(i => i.version)) : 0;
          openIterationForm(comp, null, latestV + 1, ingredients);
        }}, '+ New Iteration')
      ]),

      iterations.length ? el('div', { class: 'card-grid' }, iterations.sort((a,b) => b.version - a.version).map(it => {
        return el('div', { class: 'card', style: 'margin-bottom:0' }, [
          el('div', { class: 'flex justify-between items-center' }, [
            el('strong', {}, `Version ${it.version}`),
            el('span', { class: 'badge badge-neutral' }, fmtDate(it.date))
          ]),
          el('div', { class: 'muted-small mt-8' }, `${(it.ingredients || []).length} ingredients`),
          it.notes ? el('div', { class: 'muted-note mt-8 truncate' }, it.notes) : null,
          el('div', { class: 'mt-12 flex gap-8' }, [
            el('button', { class: 'btn-ghost', style: 'padding:4px 0', onclick: () => {
              document.querySelector('.modal-close').click();
              openIterationForm(comp, it, it.version, ingredients);
            }}, '✎ Edit'),
            el('button', { class: 'btn-ghost', style: 'padding:4px 0', onclick: () => {
              document.querySelector('.modal-close').click();
              // Duplicate to next version
              const latestV = Math.max(...iterations.map(x => x.version));
              const dupe = JSON.parse(JSON.stringify(it));
              delete dupe.id;
              openIterationForm(comp, dupe, latestV + 1, ingredients);
            }}, '⎘ Duplicate')
          ])
        ]);
      })) : el('div', { class: 'empty-state p-12' }, 'No formulas built yet. Start Iteration v1.')
    ]);

    const editBtn = el('button', { class: 'btn-secondary btn-sm', onclick: () => {
      document.querySelector('.modal-close').click();
      openBriefForm(comp);
    }}, '✎ Edit Brief');

    openModal(`Composition: ${comp.name}`, content, async () => {}, { submitLabel: 'Close', wide: true });
    document.querySelector('.modal-footer').insertBefore(editBtn, document.querySelector('.modal-footer').firstChild);
  }

  function openIterationForm(comp, existing, versionNum, materials) {
    let composition = existing ? (existing.ingredients || []) : [{ materialId: '', parts: '' }];
    
    // Filter out packaging
    const aromatics = materials.filter(i => !['Bottle', 'Cap/Closure', 'Atomizer', 'Box/Packaging', 'Sticker/Label'].includes(i.type));

    const form = el('div', { class: 'modal-form' });
    
    form.appendChild(formSectionHeader(`Iteration v${versionNum}`));
    form.appendChild(field('Date Mixed', 'date', existing?.date || todayISO(), true, 'date'));
    form.appendChild(el('div', { class: 'muted-note' }, 'Enter formulas in Parts or Percentages (it will auto-calculate ratios).'));

    const ingWrap = el('div', { class: 'ingredient-list mt-8' });
    form.appendChild(ingWrap);

    function redraw() {
      ingWrap.innerHTML = '';
      let totalParts = 0;
      
      composition.forEach((ing, idx) => {
        totalParts += parseFloat(ing.parts) || 0;
        
        const matSelect = el('select', { onchange: (e) => { composition[idx].materialId = e.target.value; } }, 
          [el('option', { value: '' }, '— material —')].concat(aromatics.map(m => el('option', { value: m.id, ...(ing.materialId === m.id ? { selected: 'selected' } : {}) }, `${m.name} (${m.volatility || 'RM'})`)))
        );

        const ptsInput = el('input', {
          type: 'number', step: '0.01', value: ing.parts, placeholder: 'Parts / %',
          oninput: (e) => { composition[idx].parts = e.target.value; updateTotals(); }
        });

        ingWrap.appendChild(el('div', { class: 'ingredient-row', style: 'grid-template-columns: 2fr 100px 40px;' }, [
          matSelect, ptsInput, el('button', { type: 'button', class: 'btn-icon danger', onclick: () => { composition.splice(idx, 1); redraw(); }}, '✕')
        ]));
      });

      const totEl = el('div', { class: 'ingredient-total', id: 'iter-total' }, `Total Parts: ${totalParts.toFixed(2)}`);
      ingWrap.appendChild(totEl);
      ingWrap.appendChild(el('button', { type: 'button', class: 'btn-secondary btn-sm', onclick: () => {
        composition.push({ materialId: '', parts: '' }); redraw();
      }}, '+ Add Material'));
    }

    function updateTotals() {
      const totEl = document.getElementById('iter-total');
      if (totEl) {
        const t = composition.reduce((s, i) => s + (parseFloat(i.parts) || 0), 0);
        totEl.textContent = `Total Parts: ${t.toFixed(2)}`;
      }
    }

    redraw();

    form.appendChild(formSectionHeader('Evaluation & Notes'));
    form.appendChild(textareaField('Iteration Notes / Result', 'notes', existing?.notes, false, 'e.g., "Too much bergamot, needs more Iso E Super for diffusion."'));
    form.appendChild(el('div', { class: 'form-row-2' }, [
      field('Score (1-10)', 'score', existing?.score, false, 'number'),
      checkboxField('🏆 Mark as Final Winner', 'isWinner', existing?.isWinner)
    ]));

    openModal(`Iteration v${versionNum} for ${comp.name}`, form, async () => {
      const isWinner = !!form.closest('form').querySelector('[name=isWinner]').checked;
      const data = formData(form.closest('form'));
      
      const cleanComp = composition
        .filter(i => i.materialId && i.parts !== '')
        .map(i => ({ materialId: i.materialId, parts: parseFloat(i.parts) }));

      if (!cleanComp.length) throw new Error('Add at least one material');

      const record = {
        ...(existing || {}),
        compositionId: comp.id,
        version: versionNum,
        date: data.date,
        ingredients: cleanComp,
        notes: data.notes.trim(),
        score: parseFloat(data.score) || null,
        isWinner
      };

      await DB.add('composition_iterations', record, 'cit');
      toast(`Saved Iteration v${versionNum}`, 'success');
      render(document.getElementById('rd-body'));
    }, { wide: true });
  }

  return { render };
})();