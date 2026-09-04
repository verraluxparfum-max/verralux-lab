/* UI Components — Modals, Forms, Empty States, Bottom Sheets */

// Modals (Bottom sheet on mobile, centered modal on desktop)
function openModal(title, formContent, onSubmit, opts = {}) {
  const backdrop = el('div', { class: 'modal-backdrop' });

  const closeBtn = el('button', {
    type: 'button',
    class: 'modal-close',
    onclick: () => closeModal(),
    'aria-label': 'Close'
  }, '✕');

  // Submit button text logic
  let submitText = opts.submitLabel || 'Save';
  if (opts.appendOnly) submitText = opts.submitLabel || 'Save (Append-Only)';

  const submitBtn = el('button', {
    type: 'submit',
    class: 'btn'   // use .btn (primary amber) — btn-primary is not defined in your CSS
  }, submitText);

  if (opts.appendOnly) {
    submitBtn.style.background = 'var(--sage)';
  }

  const footer = el('div', { class: 'modal-footer' }, [
    el('button', {
      type: 'button',
      class: 'btn-secondary',
      onclick: () => closeModal()
    }, 'Cancel'),
    submitBtn
  ]);

  // CRITICAL STRUCTURE:
  // form.modal-form is a flex column filling space under the header.
  // .modal-body scrolls; .modal-footer stays pinned.
  const body = el('div', { class: 'modal-body' }, [formContent]);

  const formNode = el('form', { class: 'form modal-form' }, [
    body,
    footer
  ]);

  formNode.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (formNode.checkValidity && !formNode.checkValidity()) {
      formNode.reportValidity();
      return;
    }

    submitBtn.textContent = 'Saving…';
    submitBtn.disabled = true;

    try {
      if (opts.appendOnly) {
        const proceed = await confirmDialog(
          'This will be saved to the permanent production journal.\n\nIt cannot be edited or deleted once saved.\n\nContinue?',
          'Save Record',
          'Cancel',
          false
        );
        if (!proceed) {
          submitBtn.textContent = submitText;
          submitBtn.disabled = false;
          return;
        }
      }

      await onSubmit(formNode);
      closeModal();
    } catch (err) {
      toast(err.message || 'Something went wrong', 'error');
      submitBtn.textContent = submitText;
      submitBtn.disabled = false;
    }
  });

  const modalNode = el('div', {
    class: `modal ${opts.wide ? 'modal-wide' : ''}`,
    role: 'dialog',
    'aria-modal': 'true'
  }, [
    el('div', { class: 'modal-header' }, [
      el('h3', {}, title),
      closeBtn
    ]),
    formNode
  ]);

  backdrop.appendChild(modalNode);

  // Close on outside click
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop && !opts.preventOutsideClose) closeModal();
  });

  // Close on Escape
  const onKey = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', onKey);

  // Mount into #modal-host if present, else body
  const host = document.getElementById('modal-host') || document.body;
  host.appendChild(backdrop);

  // Lock background scroll while modal is open
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => {
    requestAnimationFrame(() => backdrop.classList.add('show'));
  });

  // Focus first input
  setTimeout(() => {
    const firstInput = formContent.querySelector?.(
      'input:not([type=hidden]), select, textarea'
    ) || body.querySelector('input:not([type=hidden]), select, textarea');
    if (firstInput) firstInput.focus();
  }, 100);

  function closeModal() {
    document.removeEventListener('keydown', onKey);
    backdrop.classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(() => backdrop.remove(), 300); // match CSS transition
  }
}

// Form Helpers
function field(label, name, value, required = false, type = 'text', hint = null) {
  const inputOpts = {
    type,
    name,
    value: value ?? '',
    ...(required ? { required: 'required' } : {})
  };

  if (type === 'number') {
    inputOpts.step = '0.01';
  }

  return el('div', { class: 'form-group' }, [
    el('label', { class: 'form-label' }, label),
    el('input', inputOpts),
    hint ? el('div', { class: 'form-hint' }, hint) : null
  ]);
}

function selectField(label, name, options, selected, required = false, hint = null) {
  const optNodes = [el('option', { value: '' }, '— select —')];

  options.forEach(o => {
    const val = typeof o === 'string' ? o : o.value;
    const lbl = typeof o === 'string' ? o : o.label;
    const isSelected = String(val) === String(selected);
    optNodes.push(
      el('option', {
        value: val,
        ...(isSelected ? { selected: 'selected' } : {})
      }, lbl)
    );
  });

  return el('div', { class: 'form-group' }, [
    el('label', { class: 'form-label' }, label),
    el('select', {
      name,
      ...(required ? { required: 'required' } : {})
    }, optNodes),
    hint ? el('div', { class: 'form-hint' }, hint) : null
  ]);
}

function textareaField(label, name, value, required = false, hint = null) {
  return el('div', { class: 'form-group' }, [
    el('label', { class: 'form-label' }, label),
    el('textarea', {
      name,
      ...(required ? { required: 'required' } : {})
    }, value || ''),
    hint ? el('div', { class: 'form-hint' }, hint) : null
  ]);
}

function checkboxField(label, name, checked = false) {
  return el('div', { class: 'checkbox-row' }, [
    el('input', {
      type: 'checkbox',
      name,
      ...(checked ? { checked: 'checked' } : {})
    }),
    el('label', {
      class: 'form-label',
      style: 'margin:0; text-transform:none; letter-spacing:0;'
    }, label)
  ]);
}

function sectionTitle(title) {
  return el('div', { class: 'section-title' }, title);
}

function formSectionHeader(title) {
  return el('div', { class: 'form-section-title' }, title);
}

// Display Helpers
function emptyState(icon, message) {
  return el('div', { class: 'empty-state' }, [
    el('div', { class: 'empty-icon' }, icon),
    el('div', { class: 'empty-text' }, message)
  ]);
}

function loadingView() {
  return el('div', { class: 'loading' }, [
    el('div', { class: 'spinner' }),
    'Loading…'
  ]);
}

function statBox(label, value, kind) {
  return el('div', {
    class: `stat-box ${kind ? 'stat-' + kind : ''}`
  }, [
    el('div', { class: 'stat-value' }, String(value)),
    el('div', { class: 'stat-label' }, label)
  ]);
}

// Export Globals
window.openModal = openModal;
window.field = field;
window.selectField = selectField;
window.textareaField = textareaField;
window.checkboxField = checkboxField;
window.sectionTitle = sectionTitle;
window.formSectionHeader = formSectionHeader;
window.emptyState = emptyState;
window.loadingView = loadingView;
window.statBox = statBox;