import './viewer-navigation.css';

/** One persistent shell for the presentation and the existing Explorer workspace.
 * The original tour button keeps its GuidedTour listener; this module owns only
 * the Explore action and the existing native model selector.
 */
export function createViewerNavigation({ model, models, onMode, onModel, document: doc = globalThis.document } = {}) {
  const body = doc.body;
  if (body.dataset.embedded === 'true') throw new Error('Viewer navigation belongs to a top-level Explorer.');
  const shell = doc.querySelector('.app-shell');
  const header = doc.querySelector('.app-header');
  const main = doc.getElementById('main-content');
  const picker = header?.querySelector('.header-product-picker');
  const select = doc.getElementById('model-select');
  const demo = doc.getElementById('tour-start');
  if (!shell || !header || !main || !picker || !select || !demo) throw new Error('The existing Explorer navigation elements are required.');
  if (header.classList.contains('viewer-navigation')) throw new Error('Viewer navigation is already mounted.');
  const Controller = doc.defaultView?.AbortController || AbortController;
  const abort = new Controller();
  const original = {
    headerClass: header.className,
    demoClass: demo.className,
    demoHidden: demo.hidden,
    demoDisabled: demo.disabled,
    demoLabel: demo.getAttribute('aria-label'),
    demoPressed: demo.getAttribute('aria-pressed'),
    demoTitle: demo.getAttribute('title'),
    selectDisabled: select.disabled,
    selectLabel: select.getAttribute('aria-label'),
    selectTitle: select.getAttribute('title'),
    navigation: body.getAttribute('data-viewer-navigation'),
    mode: body.getAttribute('data-viewer-mode'),
    timelineChapters: body.getAttribute('data-viewer-timeline-chapters'),
  };
  const headerMarker = doc.createComment('viewer-header-home');
  const demoMarker = doc.createComment('viewer-tour-entry-home');
  header.before(headerMarker); demo.before(demoMarker);
  const subject = header.querySelector('.header-subject');
  const actions = doc.createElement('div'); actions.className = 'viewer-navigation-actions';
  const modes = doc.createElement('nav'); modes.className = 'viewer-modes'; modes.setAttribute('aria-label', 'Viewer mode');
  const context = doc.createElement('div'); context.id = 'viewer-context'; context.className = 'viewer-context';
  const explore = doc.createElement('button'); explore.type = 'button'; explore.id = 'viewer-explore'; explore.className = 'viewer-mode-button'; explore.textContent = 'Explore';
  // GuidedTour writes to its original first span. A separate visible label keeps
  // the shared navigation stable without replacing that span or its listeners.
  const legacyLabel = demo.querySelector('span');
  const legacyLabelClass = legacyLabel?.className;
  legacyLabel?.classList.add('viewer-tour-label');
  const demoLabel = doc.createElement('span'); demoLabel.className = 'viewer-mode-label'; demoLabel.textContent = 'Demo'; demo.append(demoLabel);
  demo.classList.add('viewer-mode-button');
  modes.append(demo, explore); actions.append(modes, context);
  if (subject) subject.replaceWith(actions); else header.append(actions);
  header.classList.add('viewer-navigation');
  shell.insertBefore(header, main);
  body.dataset.viewerNavigation = 'true';
  select.setAttribute('aria-label', 'Choose model');
  const source = Array.isArray(models) ? models : models && Object.values(models);
  const previousOptions = source ? [...select.childNodes] : null;
  if (source) {
    select.replaceChildren(...source.map(item => {
      const option = doc.createElement('option');
      option.value = item.id; option.textContent = item.title || item.label || item.id;
      return option;
    }));
  }
  if (model?.id) select.value = model.id;
  function selectedTitle() { select.title = select.selectedOptions?.[0]?.textContent || model?.title || 'Choose model'; }
  selectedTitle();
  explore.addEventListener('click', () => onMode?.('explore'), { signal: abort.signal });
  select.addEventListener('change', () => { selectedTitle(); onModel?.(select.value); }, { signal: abort.signal });
  let disposed = false, lastMode = 'explore', timelineChapters = null;
  function restoreTimelineChapters() {
    if (!timelineChapters) return;
    const { toggle, panel, toggleMarker, panelMarker } = timelineChapters;
    if (toggle.parentNode === context) {
      panel.hidden = true; toggle.setAttribute('aria-expanded', 'false');
      toggleMarker.after(toggle); panelMarker.after(panel);
    }
    if (body.hasAttribute('data-viewer-timeline-chapters')) body.removeAttribute('data-viewer-timeline-chapters');
  }
  function placeTimelineChapters() {
    if (!timelineChapters) return;
    if (lastMode !== 'demo' || !body.classList.contains('tour-active') || context.querySelector('#orbit-menu')) { restoreTimelineChapters(); return; }
    const { toggle, panel } = timelineChapters;
    if (toggle.parentNode !== context) context.append(toggle, panel);
    if (body.dataset.viewerTimelineChapters !== 'true') body.dataset.viewerTimelineChapters = 'true';
  }
  function bindTimelineChapters() {
    if (disposed) return false;
    if (timelineChapters) return true;
    const toggle = doc.getElementById('tour-chapters-toggle'), panel = doc.getElementById('tour-chapters');
    if (!toggle || !panel) return false;
    const toggleMarker = doc.createComment('viewer-chapters-toggle-home'), panelMarker = doc.createComment('viewer-chapters-panel-home');
    toggle.before(toggleMarker); panel.before(panelMarker);
    const label = doc.createElement('span'); label.className = 'viewer-chapters-label'; label.textContent = 'Chapters'; toggle.prepend(label);
    timelineChapters = { toggle, panel, toggleMarker, panelMarker, label };
    placeTimelineChapters(); return true;
  }
  function sync({ mode = 'explore', pending = false, canDemo = true, resumeLabel } = {}) {
    if (disposed) return;
    if (!['demo', 'explore'].includes(mode)) throw new TypeError('Viewer mode must be demo or explore.');
    lastMode = mode; body.dataset.viewerMode = mode; placeTimelineChapters();
    header.setAttribute('aria-busy', String(Boolean(pending)));
    demo.hidden = false; demo.disabled = Boolean(pending || !canDemo);
    demo.setAttribute('aria-pressed', String(mode === 'demo'));
    demoLabel.textContent = resumeLabel || 'Demo';
    demo.setAttribute('aria-label', resumeLabel || 'Demo');
    demo.title = !canDemo ? 'A demo is not available for this model' : resumeLabel || 'Open the guided demo';
    explore.disabled = Boolean(pending);
    explore.setAttribute('aria-pressed', String(mode === 'explore'));
    select.disabled = Boolean(pending);
    selectedTitle();
  }
  const restoreAttribute = (element, name, value) => value === null ? element.removeAttribute(name) : element.setAttribute(name, value);
  function dispose() {
    if (disposed) return; disposed = true; abort.abort();
    restoreTimelineChapters();
    if (timelineChapters) { timelineChapters.label.remove(); timelineChapters.toggleMarker.remove(); timelineChapters.panelMarker.remove(); }
    demoLabel.remove();
    if (legacyLabel) legacyLabel.className = legacyLabelClass;
    demo.className = original.demoClass; demo.hidden = original.demoHidden; demo.disabled = original.demoDisabled;
    restoreAttribute(demo, 'aria-label', original.demoLabel); restoreAttribute(demo, 'aria-pressed', original.demoPressed); restoreAttribute(demo, 'title', original.demoTitle);
    demoMarker.replaceWith(demo);
    if (subject) actions.replaceWith(subject); else actions.remove();
    header.className = original.headerClass; header.removeAttribute('aria-busy'); headerMarker.replaceWith(header);
    if (previousOptions) select.replaceChildren(...previousOptions);
    select.disabled = original.selectDisabled;
    restoreAttribute(select, 'aria-label', original.selectLabel); restoreAttribute(select, 'title', original.selectTitle);
    restoreAttribute(body, 'data-viewer-navigation', original.navigation); restoreAttribute(body, 'data-viewer-mode', original.mode); restoreAttribute(body, 'data-viewer-timeline-chapters', original.timelineChapters);
  }
  sync({ pending: true, canDemo: false });
  return { sync, dispose, bindTimelineChapters, header, context };
}
