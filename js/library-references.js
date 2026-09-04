/* Library: Reference Perfumes (Targets for Cloning or Study) */

window.LibraryReferences = (() => {
  async function render(root) {
    const refs = await DB.getAll('reference_perfumes');
    refs.sort((a, b) => (a.brand || '').localeCompare(b.brand || ''));

    root.appendChild(el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn btn-primary', onclick: () => openForm() }, '+ Add Reference Perfume')
    ]));

    if (!refs.length) {
      root.appendChild(emptyState('🧪', 'No references added. Log the commercial perfumes you want to study or clone.'));
      return;
    }

    const listContainer = el('div', { class: 'card-grid' });
    
    refs.forEach(ref => {
      const card = el('div', { class: 'card list-card', style: 'flex-direction:column; align-items:flex-start; gap:8px;', onclick: () => openForm(ref) }, [
        el('div', { class: 'flex justify-between w-full items-center' }, [
          el('div', {}, [
            el('div', { class: 'card-title' }, ref.name),
            el('div', { class: 'muted-small' }, `${ref.brand} ${ref.year ? `(${ref.year})` : ''}`)
          ]),
          el('span', { class: 'badge badge-info' }, ref.category || 'EDP')
        ]),
        
        el('div', { class: 'flex gap-8 w-full mt-8' }, [
          statBox('Longevity', `${ref.longevity || '?'}/10`),
          statBox('Sillage', `${ref.sillage || '?'}/10`),
        ]),
        
        ref.character ? el('div', { class: 'muted-note mt-8 w-full truncate' }, ref.character) : null
      ]);
      
      listContainer.appendChild(card);
    });

    root.appendChild(listContainer);
  }

  function openForm(existing = null) {
    const form = el('div', { class: 'modal-form' });
    
    form.appendChild(formSectionHeader('Perfume Identity'));
    form.appendChild(field('Perfume Name *', 'name', existing?.name, true));
    
    form.appendChild(el('div', { class: 'form-row-2' }, [
      field('Brand / House', 'brand', existing?.brand),
      field('Year Released', 'year', existing?.year, false, 'number')
    ]));
    
    form.appendChild(el('div', { class: 'form-row-2' }, [
      selectField('Category', 'category', ['EDC', 'EDT', 'EDP', 'Parfum', 'Extrait'], existing?.category || 'EDP'),
      field('Nose (Perfumer)', 'perfumer', existing?.perfumer)
    ]));

    form.appendChild(formSectionHeader('Olfactive Profile'));
    form.appendChild(field('Top Notes', 'topNotes', existing?.topNotes, false, 'text', 'e.g., Bergamot, Pineapple, Apple'));
    form.appendChild(field('Heart Notes', 'heartNotes', existing?.heartNotes, false, 'text', 'e.g., Birch, Patchouli, Jasmine'));
    form.appendChild(field('Base Notes', 'baseNotes', existing?.baseNotes, false, 'text', 'e.g., Musk, Oakmoss, Ambergris'));
    
    form.appendChild(textareaField('Character Description', 'character', existing?.character, false, 'How does it feel/smell overall?'));

    form.appendChild(formSectionHeader('Performance & Study'));
    form.appendChild(el('div', { class: 'form-row-2' }, [
      field('Longevity (1-10)', 'longevity', existing?.longevity, false, 'number'),
      field('Sillage (1-10)', 'sillage', existing?.sillage, false, 'number')
    ]));
    
    form.appendChild(checkboxField('Bottle/Decant owned for study?', 'owned', existing?.owned));
    form.appendChild(textareaField('Study Notes / Cloning Strategy', 'notes', existing?.notes));

    openModal(existing ? 'Edit Reference' : 'Add Reference', form, async () => {
      const data = formData(form.closest('form'));
      const record = {
        ...(existing || {}),
        name: data.name.trim(),
        brand: data.brand.trim(),
        year: parseInt(data.year) || null,
        category: data.category,
        perfumer: data.perfumer.trim(),
        topNotes: data.topNotes.trim(),
        heartNotes: data.heartNotes.trim(),
        baseNotes: data.baseNotes.trim(),
        character: data.character.trim(),
        longevity: parseInt(data.longevity) || null,
        sillage: parseInt(data.sillage) || null,
        owned: !!form.closest('form').querySelector('[name=owned]').checked,
        notes: data.notes.trim()
      };

      await DB.add('reference_perfumes', record, 'ref');
      toast('Reference saved', 'success');
      render(document.getElementById('lib-body'));
    }, { wide: true });
    
    // Add delete button if editing
    if (existing) {
      const delBtn = el('button', { type: 'button', class: 'btn-icon danger', onclick: async () => {
        if (await confirmDialog('Delete this reference perfume?')) {
          await DB.delete('reference_perfumes', existing.id);
          toast('Deleted', 'success');
          document.querySelector('.modal-close').click();
          render(document.getElementById('lib-body'));
        }
      }}, '✕');
      
      const footer = document.querySelector('.modal-footer');
      footer.insertBefore(delBtn, footer.firstChild);
    }
  }

  return { render };
})();