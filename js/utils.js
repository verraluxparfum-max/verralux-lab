/* Utilities — Formatting, Date math, DOM helpers, Toasts, Dialogs */

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + 
         d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const fmtMoney = (n) => {
  const v = Number(n) || 0;
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtNum = (n, dp = 2) => {
  const v = Number(n) || 0;
  return v.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();

// Days difference between two dates
const daysBetween = (startIso, endIso) => {
  if (!startIso || !endIso) return 0;
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  return Math.max(0, Math.floor((e - s) / (1000 * 60 * 60 * 24)));
};

// DOM Builder
const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== false && v !== null && v !== undefined) node.setAttribute(k, v);
  }
  const childList = Array.isArray(children) ? children : [children];
  childList.forEach(c => {
    if (c === null || c === undefined) return;
    if (typeof c === 'string' || typeof c === 'number') {
      node.appendChild(document.createTextNode(String(c)));
    } else if (c instanceof Node) {
      node.appendChild(c);
    }
  });
  return node;
};

// Escape HTML
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[m]));

// Toast Notifications
function toast(msg, kind = 'info') {
  const host = document.getElementById('toast-host');
  if (!host) return alert(msg);
  
  const icons = { success: '✓', error: '✕', info: 'ℹ', warn: '⚠' };
  const node = el('div', { class: `toast toast-${kind}` }, [
    el('span', { class: 'toast-icon' }, icons[kind] || 'ℹ'),
    el('span', {}, msg)
  ]);
  
  host.appendChild(node);
  
  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => node.classList.add('show'));
  });
  
  // Remove after 3s
  setTimeout(() => {
    node.classList.remove('show');
    setTimeout(() => node.remove(), 350); // wait for transition
  }, 3000);
}

// Custom Promise-based Confirm Dialog
function confirmDialog(message, okText = 'Confirm', cancelText = 'Cancel', isDanger = true) {
  return new Promise((resolve) => {
    const host = document.getElementById('confirm-host');
    if (!host) { resolve(window.confirm(message)); return; }

    const backdrop = el('div', { class: 'confirm-backdrop' });
    const box = el('div', { class: 'confirm-box' }, [
      el('div', { class: 'confirm-icon', style: isDanger ? 'color:var(--danger)' : 'color:var(--amber)' }, isDanger ? '⚠' : 'ℹ'),
      el('div', { class: 'confirm-msg' }, message),
      el('div', { class: 'confirm-actions' }, [
        el('button', { class: 'btn-secondary', onclick: () => close(false) }, cancelText),
        el('button', { class: 'btn', style: isDanger ? 'background:var(--danger)' : '', onclick: () => close(true) }, okText),
      ])
    ]);
    
    backdrop.appendChild(box);
    host.appendChild(backdrop);
    
    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => backdrop.classList.add('show'));
    });

    // Close handler
    function close(result) {
      backdrop.classList.remove('show');
      setTimeout(() => { backdrop.remove(); resolve(result); }, 250);
    }

    // Outside click & Keyboard
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });
    const onKey = (e) => {
      if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', onKey); }
      if (e.key === 'Enter') { close(true); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);
  });
}

// Form Data extractor
function formData(formNode) {
  const fd = new FormData(formNode);
  const out = {};
  for (const [k, v] of fd.entries()) out[k] = v;
  return out;
}

// Debounce (for search inputs)
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Auto-generating batch numbers (NAM-MFR-YYYYMMDD-XXX)
function nextBatchNumber(existingBatches, dateStr) {
  const datePart = (dateStr || todayISO()).replace(/-/g, '');
  const sameDay = existingBatches.filter(b => (b.batchNumber || '').includes(datePart));
  const seq = String(sameDay.length + 1).padStart(3, '0');
  return `VLX-MFR-${datePart}-${seq}`;
}

window.fmtDate = fmtDate;
window.fmtDateTime = fmtDateTime;
window.fmtMoney = fmtMoney;
window.fmtNum = fmtNum;
window.todayISO = todayISO;
window.nowISO = nowISO;
window.daysBetween = daysBetween;
window.el = el;
window.esc = esc;
window.toast = toast;
window.confirmDialog = confirmDialog;
window.formData = formData;
window.debounce = debounce;
window.nextBatchNumber = nextBatchNumber;