/* Production Journal Router — The Append-Only Lab Record */

window.Journal = (() => {
  let tab = 'active';

  async function render(root) {
    window.App.setViewTitle('Production Journal');
    root.innerHTML = '';
    
    const tabs = el('div', { class: 'subtabs' }, [
      el('button', { class: `subtab ${tab === 'active' ? 'active' : ''}`, onclick: (e) => switchTab('active', e) }, 'Active Batches'),
      el('button', { class: `subtab ${tab === 'maceration' ? 'active' : ''}`, onclick: (e) => switchTab('maceration', e) }, 'Maceration Log'),
      el('button', { class: `subtab ${tab === 'qc' ? 'active' : ''}`, onclick: (e) => switchTab('qc', e) }, 'QC & Testing'),
      el('button', { class: `subtab ${tab === 'released' ? 'active' : ''}`, onclick: (e) => switchTab('released', e) }, 'Released'),
    ]);
    
    root.appendChild(tabs);
    
    const body = el('div', { id: 'journal-body' });
    root.appendChild(body);
    
    await renderTab(body);
  }

  async function switchTab(newTab, e) {
    tab = newTab;
    document.querySelectorAll('#view .subtab').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    
    const body = document.getElementById('journal-body');
    body.innerHTML = '';
    body.appendChild(loadingView());
    
    await new Promise(r => setTimeout(r, 30));
    body.innerHTML = '';
    await renderTab(body);
  }

  async function renderTab(body) {
    if (tab === 'active') return window.JournalActive.render(body);
    if (tab === 'maceration') return window.JournalMaceration.render(body);
    if (tab === 'qc') return window.JournalQC.render(body);
    if (tab === 'released') return window.JournalRelease.render(body);
  }

  return { render };
})();