/* R&D Workbench Router — Manages subtabs for experimental modules */

window.RD = (() => {
  let tab = 'clone_trials';

  async function render(root) {
    window.App.setViewTitle('R&D Workbench');
    root.innerHTML = '';
    
    const tabs = el('div', { class: 'subtabs' }, [
      el('button', { class: `subtab ${tab === 'clone_trials' ? 'active' : ''}`, onclick: (e) => switchTab('clone_trials', e) }, 'Clone Trials'),
      el('button', { class: `subtab ${tab === 'original' ? 'active' : ''}`, onclick: (e) => switchTab('original', e) }, 'Originals'),
      el('button', { class: `subtab ${tab === 'studies' ? 'active' : ''}`, onclick: (e) => switchTab('studies', e) }, 'Ingredient Studies'),
      el('button', { class: `subtab ${tab === 'formula_lock' ? 'active' : ''}`, onclick: (e) => switchTab('formula_lock', e) }, 'Formula Locks (Wins)'),
    ]);
    
    root.appendChild(tabs);
    
    const body = el('div', { id: 'rd-body' });
    root.appendChild(body);
    
    await renderTab(body);
  }

  async function switchTab(newTab, e) {
    tab = newTab;
    document.querySelectorAll('#view .subtab').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    
    const body = document.getElementById('rd-body');
    body.innerHTML = '';
    body.appendChild(loadingView());
    
    await new Promise(r => setTimeout(r, 30));
    body.innerHTML = '';
    await renderTab(body);
  }

  async function renderTab(body) {
    if (tab === 'clone_trials') return window.RDCloneTrials.render(body);
    if (tab === 'original') return window.RDOriginalComposition.render(body);
    if (tab === 'studies') return window.RDIngredientStudies.render(body);
    if (tab === 'formula_lock') return window.RDFormulaLock.render(body);
  }

  return { render };
})();