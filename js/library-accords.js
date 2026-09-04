/* Library: Accords (Reusable Building Blocks) */

window.LibraryAccords = (() => {
  async function render(root) {
    const accords = await DB.getAll('accords');
    const ingredients = await DB.getAll('ingredients');

    root.appendChild(el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn btn-primary', onclick: () => openForm(null, ingredients) }, '+ New Accord')
    ]));

    if (!accords.length) {
      root.appendChild(emptyState('🧩', 'No accords yet. Build reusable structures (like a signature amber base or musky heart) to use across multiple perfumes.'));
      return;
    }

    const listContainer = el('div', { class: 'card-grid' });
    
    accords.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).forEach(acc => {
      const costPerG = calculateAccordCost(acc, ingredients);
      
      const card = el('div', { class: 'card', onclick: () => viewDetail(acc, ingredients) }, [
        el('div', { class: 'card-head' }, [
          el('div', { class: 'card-title' }, acc.name),
          el('span', { class: 'badge badge-purple' }, acc.accordType || 'Accord')
        ]),
        el('div', { class: 'card-sub' }, [
          el('div', {}, `v${acc.version || 1} · ${(acc.ingredients || []).length} materials`),
          el('div', { class: 'text-mono mt-4' }, `Est. Cost: ${fmtMoney(costPerG)}/g`)
        ]),
        acc.character ? el('div', { class: 'muted-small mt-8 truncate' }, acc.character) : null
      ]);
      
      listContainer.appendChild(card);
    });

    root.appendChild(listContainer);
  }

  function calculateAccordCost(accord, ingredients) {
    let totalCost = 0;
    (accord.ingredients || []).forEach(ing => {
      const mat = ingredients.find(m => m.id === ing.ingredientId);
      if (mat) {
        // Assume % acts as parts of 100g total for cost estimation
        totalCost += (mat.avgCost || 0) * (ing.pct / 100);
      }
    });
    return totalCost; // This gives cost per 1 unit (e.g. 1 gram) of the mixed accord
  }

  function viewDetail(accord, ingredients) {
    const costPerG = calculateAccordCost(accord, ingredients);
    
    const content = el('div', {}, [
      el('div', { class: 'stat-strip mb-16' }, [
        statBox('Type', accord.accordType || 'Base'),
        statBox('Version', `v${accord.version || 1}`),
        statBox('Cost/g', fmtMoney(costPerG))
      ]),

      accord.character ? el('div', { class: 'mb-16' }, [
        formSectionHeader('Character Profile'),
        el('div', { class: 'muted-note mt-8' }, accord.character)
      ]) : null,

      formSectionHeader('Composition (%)'),
      el('table', { class: 'data-table compact mt-8 mb-16' }, [
        el('thead', {}, el('tr', {}, ['Ingredient', 'Type', 'Amount', 'Est. Cost'].map(h => el('th', {}, h)))),
        el('tbody', {}, (accord.ingredients || []).sort((a,b) => b.pct - a.pct).map(ing => {
          const mat = ingredients.find(m => m.id === ing.ingredientId);
          const cost = mat ? (mat.avgCost || 0) * (ing.pct / 100) : 0;
          return el('tr', {}, [
            el('td', {}, mat ? mat.name : el('span', { class: 'muted' }, '(Deleted)')),
            el('td', {}, el('span', { class: 'badge badge-neutral', style: 'font-size:10px' }, mat ? (mat.volatility || 'RM') : '?')),
            el('td', { class: 'num font-bold' }, `${ing.pct}%`),
            el('td', { class: 'num' }, fmtMoney(cost))
          ]);
        }))
      ]),

      accord.notes ? el('div', { class: 'mb-16' }, [
        formSectionHeader('Perfumer Notes'),
        el('div', { class: 'mt-8', style: 'white-space:pre-wrap' }, accord.notes)
      ]) : null
    ]);

    const editBtn = el('button', { class: 'btn-secondary btn-sm', onclick: () => {
      document.querySelector('.modal-close').click();
      openForm(accord, ingredients);
    }}, '✎ Edit / Re-version');

    openModal(accord.name, content, async () => {}, { submitLabel: 'Close' });
    
    const footer = document.querySelector('.modal-footer');
    footer.insertBefore(editBtn, footer.firstChild);
  }

  function openForm(existing, ingredients) {
    let composition = existing ? JSON.parse(JSON.stringify(existing.ingredients || [])) : [{ ingredientId: '', pct: '' }];
    
    const form = el('div', { class: 'modal-form' });
    
    form.appendChild(formSectionHeader('Accord Details'));
    form.appendChild(field('Accord Name *', 'name', existing?.name, true));
    form.appendChild(el('div', { class: 'form-row-2' }, [
      selectField('Type', 'accordType', ['Base', 'Heart', 'Top', 'Bridge', 'Full Structure'], existing?.accordType || 'Base'),
      field('Version', 'version', existing ? (existing.version || 1) + 1 : 1, true, 'number') // Auto-increment version on edit
    ]));
    
    form.appendChild(textareaField('Olfactive Character', 'character', existing?.character, false, 'Describe the smell profile (e.g. "Dry fuzzy amber woods")'));

    form.appendChild(formSectionHeader('Composition (must total ~100%)'));
    const ingWrap = el('div', { class: 'ingredient-list' });
    form.appendChild(ingWrap);

    // List of ONLY actual aromatic ingredients (exclude packaging/solvents if wanted, but solvers are often in accords. Exclude packaging.)
    const aromatics = ingredients.filter(i => !['Bottle', 'Cap/Closure', 'Atomizer', 'Box/Packaging', 'Sticker/Label'].includes(i.type));

    function redrawIngredients() {
      ingWrap.innerHTML = '';
      let totalPct = 0;
      
      composition.forEach((ing, idx) => {
        totalPct += parseFloat(ing.pct) || 0;
        
        const matSelect = el('select', {
          onchange: (e) => { composition[idx].ingredientId = e.target.value; }
        }, [el('option', { value: '' }, '— select material —')].concat(
          aromatics.map(m => el('option', { 
            value: m.id, 
            ...(ing.ingredientId === m.id ? { selected: 'selected' } : {}) 
          }, `${m.name} (${m.volatility || 'RM'})`))
        ));

        const pctInput = el('input', {
          type: 'number', step: '0.01', value: ing.pct, placeholder: '%',
          oninput: (e) => { composition[idx].pct = e.target.value; updateTotals(); }
        });

        const delBtn = el('button', { type: 'button', class: 'btn-icon danger', onclick: () => {
          composition.splice(idx, 1);
          redrawIngredients();
        }}, '✕');

        ingWrap.appendChild(el('div', { class: 'ingredient-row' }, [
          matSelect, pctInput, el('span', { class: 'muted-small' }, '%'), delBtn
        ]));
      });

      const totEl = el('div', { class: 'ingredient-total', id: 'acc-total' }, `Total: ${totalPct.toFixed(2)}%`);
      totEl.className = `ingredient-total ${Math.abs(totalPct - 100) < 0.1 ? 'ok' : 'warn'}`;
      
      ingWrap.appendChild(totEl);
      ingWrap.appendChild(el('button', { type: 'button', class: 'btn-secondary btn-sm', onclick: () => {
        composition.push({ ingredientId: '', pct: '' });
        redrawIngredients();
      }}, '+ Add Material'));
    }

    function updateTotals() {
      const totEl = document.getElementById('acc-total');
      if (!totEl) return;
      const totalPct = composition.reduce((s, i) => s + (parseFloat(i.pct) || 0), 0);
      totEl.textContent = `Total: ${totalPct.toFixed(2)}%`;
      totEl.className = `ingredient-total ${Math.abs(totalPct - 100) < 0.1 ? 'ok' : 'warn'}`;
    }

    redrawIngredients();

    form.appendChild(formSectionHeader('Notes'));
    form.appendChild(textareaField('Perfumer Notes', 'notes', existing?.notes));

    openModal(existing ? 'Iterate Accord' : 'Create Accord', form, async () => {
      const data = formData(form.closest('form'));
      
      const cleanComp = composition
        .filter(i => i.ingredientId && i.pct !== '')
        .map(i => ({ ingredientId: i.ingredientId, pct: parseFloat(i.pct) }));

      if (!cleanComp.length) throw new Error('Add at least one material');
      
      const total = cleanComp.reduce((s, i) => s + i.pct, 0);
      if (Math.abs(total - 100) > 1) {
        throw new Error(`Composition must total ~100% (currently ${total.toFixed(1)}%)`);
      }

      const record = {
        ...(existing || {}),
        name: data.name.trim(),
        accordType: data.accordType,
        version: parseInt(data.version) || 1,
        character: data.character.trim(),
        notes: data.notes.trim(),
        ingredients: cleanComp
      };

      // If existing, we update it. (In a strict system we'd duplicate, but for library simplicity we overwrite or increment version).
      await DB.add('accords', record, 'acc');
      toast(`Saved Accord v${record.version}`, 'success');
      render(document.getElementById('lib-body'));
    }, { wide: true });
  }

  return { render };
})();