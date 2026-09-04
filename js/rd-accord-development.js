/* R&D: Accord Development Redirect Notice */

window.RDAccordDevelopment = (() => {
  async function render(root) {
    root.innerHTML = '';
    // FIXED: Use appendChild instead of innerHTML assignment
    root.appendChild(emptyState('🧩', 'Accords are managed directly in the Library tab. Navigate to Library > Accords to build and iterate on your reusable structures.'));
  }
  return { render };
})();