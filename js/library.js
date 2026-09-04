/* Library Module Router — Manages subtabs for the Library section */

window.Library = (() => {
  let tab = 'ingredients';

  async function render(root) {
    window.App.setViewTitle('Library');
    
    root.innerHTML = '';
    
    // Sub-navigation
    const tabs = el('div', { class: 'subtabs' }, [
      el('button', { class: `subtab ${tab === 'ingredients' ? 'active' : ''}`, onclick: (e) => switchTab('ingredients', e) }, 'Ingredients'),
      el('button', { class: `subtab ${tab === 'accords' ? 'active' : ''}`, onclick: (e) => switchTab('accords', e) }, 'Accords'),
      el('button', { class: `subtab ${tab === 'references' ? 'active' : ''}`, onclick: (e) => switchTab('references', e) }, 'References'),
    ]);
    
    root.appendChild(tabs);
    
    const body = el('div', { id: 'lib-body' });
    root.appendChild(body);
    
    await renderTab(body);
  }

  async function switchTab(newTab, e) {
    tab = newTab;
    document.querySelectorAll('.subtab').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    
    const body = document.getElementById('lib-body');
    body.innerHTML = '';
    body.appendChild(loadingView());
    
    await new Promise(r => setTimeout(r, 30));
    body.innerHTML = '';
    await renderTab(body);
  }

  async function renderTab(body) {
    if (tab === 'ingredients') return window.LibraryIngredients.render(body);
    if (tab === 'accords') return window.LibraryAccords.render(body);
    if (tab === 'references') return window.LibraryReferences.render(body);
  }

  return { render };
})();