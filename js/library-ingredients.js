/* Library: Unified Ingredients (Aroma Chemicals, Naturals, Clone Oils, Packaging) */

window.LibraryIngredients = (() => {
  let searchQuery = '';
  let activeFilter = 'All';

  const FILTERS = ['All', 'Aroma Chemical', 'Essential Oil', 'Absolute', 'Clone/Base Oil', 'Solvent', 'Packaging'];

  async function render(root) {
    const allIngredients = await DB.getAll('ingredients');
    
    // Sort alphabetically
    allIngredients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // Top Actions & Search
    const searchInput = el('input', {
      type: 'text',
      placeholder: 'Search ingredients, CAS, character...',
      value: searchQuery,
      oninput: debounce((e) => {
        searchQuery = e.target.value.toLowerCase();
        renderList(allIngredients, document.getElementById('ing-list-container'));
      }, 250)
    });

    root.appendChild(el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn btn-primary', onclick: () => openForm() }, '+ Add Ingredient'),
      el('div', { class: 'search-bar', style: 'flex:1; min-width:200px; margin:0;' }, [searchInput])
    ]));

    // Filter Chips
    const chipsWrap = el('div', { class: 'filter-chips' });
    FILTERS.forEach(f => {
      const isPkg = f === 'Packaging';
      const chip = el('button', { 
        class: `filter-chip ${activeFilter === f ? 'active' : ''}`,
        onclick: (e) => {
          activeFilter = f;
          document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
          e.target.classList.add('active');
          renderList(allIngredients, document.getElementById('ing-list-container'));
        }
      }, f);
      chipsWrap.appendChild(chip);
    });
    root.appendChild(chipsWrap);

    // List Container
    const listContainer = el('div', { id: 'ing-list-container' });
    root.appendChild(listContainer);

    renderList(allIngredients, listContainer);
  }

  function renderList(ingredients, container) {
    container.innerHTML = '';

    // Apply filters
    let filtered = ingredients;
    if (activeFilter !== 'All') {
      if (activeFilter === 'Packaging') {
        filtered = filtered.filter(i => ['Bottle', 'Cap/Closure', 'Atomizer', 'Box/Packaging', 'Sticker/Label'].includes(i.type));
      } else {
        filtered = filtered.filter(i => i.type === activeFilter);
      }
    }
    
    if (searchQuery) {
      filtered = filtered.filter(i => 
        (i.name || '').toLowerCase().includes(searchQuery) ||
        (i.cas || '').toLowerCase().includes(searchQuery) ||
        (i.character || '').toLowerCase().includes(searchQuery) ||
        (i.family || []).join(' ').toLowerCase().includes(searchQuery)
      );
    }

    if (!filtered.length) {
      container.appendChild(emptyState('🧪', 'No ingredients found matching your criteria.'));
      return;
    }

    // Render List Cards
    filtered.forEach(ing => {
      const isLowStock = ing.reorderLevel != null && (ing.currentStock || 0) <= ing.reorderLevel;
      const isPkg = ['Bottle', 'Cap/Closure', 'Atomizer', 'Box/Packaging', 'Sticker/Label'].includes(ing.type);
      
      const badgeClass = isPkg ? 'badge-neutral' : 
                         ing.type === 'Clone/Base Oil' ? 'badge-purple' : 
                         ing.type === 'Aroma Chemical' ? 'badge-info' : 'badge-sage';

      const card = el('div', { class: 'list-card', onclick: () => viewDetail(ing) }, [
        el('div', { class: 'list-card-body' }, [
          el('div', { class: 'list-card-title', style: 'display:flex; justify-content:space-between;' }, [
            el('span', {}, ing.name),
            el('span', { class: 'text-mono', style: 'font-weight:500; font-size:13px;' }, fmtMoney(ing.avgCost) + `/${ing.unit}`)
          ]),
          el('div', { class: 'list-card-sub flex items-center justify-between mt-8' }, [
            el('div', { class: 'flex gap-4' }, [
              el('span', { class: `badge ${badgeClass}` }, ing.type),
              ing.volatility && ing.volatility !== 'None' ? el('span', { class: 'badge badge-neutral' }, ing.volatility) : null,
              ing.ifraLimitCat4 ? el('span', { class: 'badge badge-warn' }, `IFRA: ${ing.ifraLimitCat4}%`) : null
            ]),
            el('div', { class: isLowStock ? 'text-danger font-bold' : 'muted' }, `${fmtNum(ing.currentStock, 1)} ${ing.unit} stock`)
          ])
        ]),
        el('div', { class: 'list-card-arrow' }, '›')
      ]);
      
      container.appendChild(card);
    });
  }

  function viewDetail(ing) {
    const isPkg = ['Bottle', 'Cap/Closure', 'Atomizer', 'Box/Packaging', 'Sticker/Label'].includes(ing.type);
    
    const content = el('div', { class: 'detail-view' }, [
      el('div', { class: 'flex justify-between items-center mb-16' }, [
        el('div', { class: 'badge badge-info' }, ing.type),
        el('div', { class: 'text-mono font-bold' }, `${fmtNum(ing.currentStock, 2)} ${ing.unit} in stock`)
      ]),
      
      !isPkg && (ing.cas || ing.iupac) ? el('div', { class: 'mb-16' }, [
        ing.cas ? el('div', { class: 'text-mono muted-small' }, `CAS: ${ing.cas}`) : null,
        ing.iupac ? el('div', { class: 'muted-small' }, ing.iupac) : null,
      ]) : null,

      !isPkg && ing.character ? el('div', { class: 'mb-16' }, [
        formSectionHeader('Odor Character'),
        el('div', { class: 'mt-8', style: 'line-height:1.6' }, ing.character)
      ]) : null,

      !isPkg ? el('div', { class: 'form-row-2 mb-16' }, [
        statBox('Volatility', ing.volatility || '—'),
        statBox('Odor Strength', ing.strength ? `${ing.strength}/10` : '—'),
        statBox('Substantivity', ing.substantivity ? `${ing.substantivity} hrs` : '—'),
        statBox('Usage Range', ing.usageMin || ing.usageMax ? `${ing.usageMin||0}% - ${ing.usageMax||100}%` : '—'),
      ]) : null,

      !isPkg && (ing.family && ing.family.length) ? el('div', { class: 'mb-16' }, [
        formSectionHeader('Olfactive Family'),
        el('div', { class: 'tags-row' }, ing.family.map(f => el('span', { class: 'tag' }, f)))
      ]) : null,

      !isPkg && (ing.ifraLimitCat4 || ing.safetyFlags) ? el('div', { class: 'mb-16 p-12' }, [
        formSectionHeader('Safety & IFRA (Cat 4)'),
        ing.ifraLimitCat4 ? el('div', { class: 'mt-8 text-warn font-bold' }, `Max Usage: ${ing.ifraLimitCat4}%`) : null,
        ing.ifraNote ? el('div', { class: 'muted-small mt-4' }, ing.ifraNote) : null,
      ]) : null,

      ing.notes ? el('div', { class: 'mb-16' }, [
        formSectionHeader('Personal Notes'),
        el('div', { class: 'muted-note mt-8' }, ing.notes)
      ]) : null,
    ]);

    const editBtn = el('button', { class: 'btn-secondary btn-sm', onclick: () => {
      document.querySelector('.modal-close').click();
      openForm(ing);
    }}, '✎ Edit');

    const delBtn = el('button', { class: 'btn-icon danger', title: 'Delete', onclick: async () => {
      if (await confirmDialog(`Delete ${ing.name}?\n\nThis will not delete it from existing formulas or batches, but it won't be available for new ones.`)) {
        await DB.delete('ingredients', ing.id);
        toast('Ingredient deleted', 'success');
        document.querySelector('.modal-close').click();
        render(document.getElementById('lib-body'));
      }
    }}, '✕');

    openModal(ing.name, content, async () => {}, { 
      submitLabel: 'Close',
      preventOutsideClose: false
    });

    // Replace footer with custom actions
    const footer = document.querySelector('.modal-footer');
    footer.innerHTML = '';
    footer.appendChild(delBtn);
    footer.appendChild(el('div', { style: 'flex:1' }));
    footer.appendChild(editBtn);
  }

  function openForm(existing = null) {
    const form = el('div', { class: 'modal-form' });
    
    form.appendChild(formSectionHeader('Basic Details'));
    form.appendChild(field('Ingredient / Material Name *', 'name', existing?.name, true));
    
    const types = ['Aroma Chemical', 'Essential Oil', 'Absolute', 'CO2 Extract', 'Tincture', 'Resinoid', 'Isolate', 'Clone/Base Oil', 'Solvent', 'Bottle', 'Cap/Closure', 'Atomizer', 'Box/Packaging', 'Sticker/Label', 'Other'];
    form.appendChild(selectField('Type *', 'type', types, existing?.type || 'Aroma Chemical', true));
    
    form.appendChild(el('div', { class: 'form-row-2' }, [
      field('CAS Number', 'cas', existing?.cas),
      field('Cost per Unit (₹)', 'avgCost', existing?.avgCost, false, 'number'),
    ]));

    form.appendChild(el('div', { class: 'form-row-2' }, [
      field('Unit of Measure', 'unit', existing?.unit || 'g'),
      field('Current Stock', 'currentStock', existing?.currentStock || 0, false, 'number'),
    ]));

    form.appendChild(formSectionHeader('Perfumery Properties (Optional)'));
    form.appendChild(selectField('Volatility / Note', 'volatility', ['Top', 'Heart', 'Base', 'Bridge', 'None'], existing?.volatility || 'None'));
    
    form.appendChild(el('div', { class: 'form-row-2' }, [
      field('Odor Strength (1-10)', 'strength', existing?.strength, false, 'number'),
      field('Substantivity (Hours)', 'substantivity', existing?.substantivity, false, 'number'),
    ]));

    form.appendChild(textareaField('Character Description', 'character', existing?.character));

    form.appendChild(formSectionHeader('Safety & IFRA'));
    form.appendChild(field('IFRA Cat 4 Limit (%)', 'ifraLimitCat4', existing?.ifraLimitCat4, false, 'number'));
    form.appendChild(textareaField('Personal / Safety Notes', 'notes', existing?.notes));

    openModal(existing ? 'Edit Ingredient' : 'New Ingredient', form, async () => {
      const data = formData(form.closest('form'));
      const record = {
        ...(existing || {}),
        name: data.name.trim(),
        type: data.type,
        cas: data.cas.trim(),
        avgCost: parseFloat(data.avgCost) || 0,
        unit: data.unit.trim(),
        currentStock: parseFloat(data.currentStock) || 0,
        volatility: data.volatility,
        strength: parseInt(data.strength) || null,
        substantivity: parseFloat(data.substantivity) || null,
        character: data.character.trim(),
        ifraLimitCat4: data.ifraLimitCat4 ? parseFloat(data.ifraLimitCat4) : null,
        notes: data.notes.trim()
      };
      
      await DB.add('ingredients', record, 'ing');
      toast('Ingredient saved', 'success');
      render(document.getElementById('lib-body'));
    }, { wide: true });
  }

  return { render };
})();