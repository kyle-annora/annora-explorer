import { createIntegrationController, mountEmbeddedInquiry } from '@annora/integration-kit';
import { createBrowserDemoRepository } from '@annora/integration-kit/demo-repository';
import '@annora/integration-kit/style.css';
import { createExistingViewer } from './viewer.js';
import './style.css';

const $ = id => document.getElementById(id);
const namespace = 'annora.integration-example.projects.v1';
let viewer, controller, panel, repository, unsubscribe;
const abort = new AbortController();
let hostBusy = false;
const report = error => { $('host-error').textContent = error?.message || 'This action could not finish. Your saved inquiry has not been changed.'; $('host-error').hidden = false; };
const action = work => async () => {
  if (hostBusy) return;
  hostBusy = true; $('host-error').hidden = true;
  try { await work(); } catch (error) { report(error); } finally { hostBusy = false; }
};
const bind = (id, work) => $(id).addEventListener('click', action(work), { signal: abort.signal });
const textElement = (tag, content) => { const element = document.createElement(tag); element.textContent = content; return element; };

async function showProjects() {
  if (panel && !(await panel.beforeLeave())) return;
  const projects = await repository.listProjects();
  panel?.suspend();
  $('saved-count').textContent = String(projects.length);
  $('saved-list').replaceChildren();
  if (!projects.length) $('saved-list').append(textElement('p', 'No confirmed inquiries yet. Select a part and start a request.'));
  for (const project of projects) {
    const article = document.createElement('article');
    article.append(textElement('h3', project.context.part?.title || project.context.productTitle));
    article.append(textElement('small', `${project.id} · Saved in this browser`));
    article.append(textElement('p', project.inquiry.values.application));
    const restore = textElement('button', 'View saved reference');
    restore.type = 'button';
    restore.addEventListener('click', action(async () => { await controller.restoreContext(project.context); $('saved').hidden = true; $('part').focus(); }));
    const details = document.createElement('details');
    details.append(textElement('summary', 'Inquiry details & exact versions'));
    const dl = document.createElement('dl');
    for (const [label,value] of [
      ['Quantity',project.inquiry.values.quantity || 'To discuss'], ['Requested scope',project.inquiry.values.quoteScope],
      ['Contact',project.inquiry.values.email || 'Not supplied'], ['Product version',project.context.productRevision],
      ['Model version',project.context.modelRevision], ['Viewer',project.context.viewerReference?.adapter.id],
    ]) { dl.append(textElement('dt',label),textElement('dd',value || 'Not supplied')); }
    details.append(dl); article.append(restore,details); $('saved-list').append(article);
  }
  $('saved').hidden = false; $('saved-heading').focus();
}

async function openInquiry(intent, opener) {
  $('saved').hidden = true;
  const context = await controller.captureContext();
  await panel.open({ context, suggestedIntent: intent, suggestedScope: context.part ? 'part' : 'product', opener });
}

async function start() {
  const fixtureResponse = await fetch('./fixture.json');
  if (!fixtureResponse.ok) throw new Error('The example product reference could not load. Reload this page to try again.');
  const fixture = await fixtureResponse.json();
  viewer = await createExistingViewer({ element: $('viewer'), modelUrl: './model.glb', fixtureUrl: './fixture.json', signal: abort.signal });
  const context = { productId:'kinetic-01', productTitle:fixture.title, productRevision:'independent-viewer-product-v1', modelId:fixture.modelId, modelRevision:fixture.modelRevision };
  controller = createIntegrationController({ adapter:viewer, context });
  repository = createBrowserDemoRepository({ namespace, storage:localStorage });
  panel = await mountEmbeddedInquiry($('inquiry'), {
    repository, onCapture:() => controller.captureContext(), onRestore:context => controller.restoreContext(context),
    onProject:async () => { try { await showProjects(); } catch (error) { report(error); throw error; } },
    onState:state => {
      document.body.dataset.inquiry = state.expanded ? 'expanded' : 'compact';
      if (state.stage === 'confirmed') repository.listProjects().then(items => { $('saved-count').textContent = String(items.length); }).catch(report);
    },
    presentation: { labels: { openProjectButton:'View saved inquiry', receiptDescription:'The selected part and this viewer’s exact camera are saved with your request. You can return to them here.' } },
  });
  for (const group of fixture.groups) {
    const optgroup = document.createElement('optgroup'); optgroup.label = group.title;
    for (const part of viewer.getParts().filter(item => item.group === group.id)) {
      const option = document.createElement('option'); option.value = part.id; option.textContent = part.title; optgroup.append(option);
    }
    if (optgroup.children.length) $('part').append(optgroup);
  }
  const updateSelection = state => { $('part').value = state.selectedPart?.id || ''; $('fit').disabled = !state.selectedPart; };
  unsubscribe = viewer.subscribe(updateSelection); updateSelection(viewer.getState());
  $('part').addEventListener('change', () => { try { viewer.selectPart($('part').value || null); } catch (error) { report(error); } }, { signal:abort.signal });
  bind('request', () => openInquiry('quotation', $('request')));
  bind('inquire-part', () => openInquiry('application-review', $('inquire-part')));
  bind('fit', () => viewer.fitSelection()); bind('reset', () => viewer.reset());
  bind('saved-open', showProjects);
  bind('saved-close', () => { $('saved').hidden = true; $('saved-open').focus(); });
  for (const id of ['request','inquire-part','reset','part']) $(id).disabled = false;
  $('load-status').hidden = true;
  try { $('saved-count').textContent = String((await repository.listProjects()).length); }
  catch (error) { report(error); }
  // Read-only diagnostics support repeatable host qualification; no business actions.
  window.annoraExampleDiagnostics = () => ({ viewer:viewer.getDiagnostics(), state:viewer.getState(), capabilities:controller.capabilities(), context:panel.getContext(), namespace });
}
start().catch(error => { $('load-status').textContent = 'The viewer could not open. Reload to try again.'; report(error); viewer?.dispose(); });
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  unsubscribe?.(); controller?.dispose(); viewer?.dispose(); abort.abort();
});
