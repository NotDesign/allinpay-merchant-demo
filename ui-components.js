// One shared action-button and notification renderer for backoffice and External.
// Labels and extra attributes are trusted application markup, as in the original btn helper.
(() => {
  const bellIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>';
  function button(label, action, classes = '', attributes = '') {
    const variant = /(^|\s)text-button(\s|$)/.test(classes) ? ' ui-button--text'
      : /(^|\s)eye(\s|$)/.test(classes) || ['‹','›','×','⋮','⋯'].includes(String(label).trim()) ? ' ui-button--icon' : '';
    return `<button type="button" class="ui-button${variant} ${classes}" data-ui-component="button" data-action="${action}" ${attributes}>${label}</button>`;
  }
  function notification() {
    return `<button type="button" class="nf-bell ui-notification" data-ui-component="notification" data-action="nf-open" aria-label="開啟通知中心" title="通知中心">${bellIcon}<span class="nf-badge" hidden></span></button>`;
  }
  function enhance(root) {
    const controls = [...(root.matches?.('button[data-action]') ? [root] : []),
      ...root.querySelectorAll('button[data-action]')];
    for (const control of controls) {
      if (control.dataset.uiComponent || control.matches('.metric,.step,.v2-status-extra,.ir-case,.ir-doc,.new-card,.mt-preview-button')) continue;
      control.classList.add('ui-button');
      if (control.classList.contains('eye')) control.classList.add('ui-button--icon');
      if (control.dataset.action==='website') control.classList.add('ui-button--text');
      control.dataset.uiComponent = 'button';
    }
  }
  if (document.body) {
    enhance(document.body);
    new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)
      if(node.nodeType===1)enhance(node);}).observe(document.body,{childList:true,subtree:true});
  }
  window.MeePayUI = Object.freeze({version:'2026.11.20-shared-controls-v1',button,notification,enhance});
})();
