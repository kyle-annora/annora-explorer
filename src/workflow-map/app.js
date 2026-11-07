import { journey, branches } from './content.js';
import './style.css';

const sourceRoot = 'https://github.com/kyle-annora/annora-explorer/blob/main/';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icon = (name, className = '') => {
  const paths = {
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    external: '<path d="M7 17 17 7M7 7h10v10"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    gate: '<path d="m7 12 3 3 7-7"/><rect x="3" y="3" width="18" height="18" rx="3"/>',
    down: '<path d="M12 4v16m-6-6 6 6 6-6"/>',
  };
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
};
const roleName = role => ({ buyer: 'Buyer', seller: 'Seller', shared: 'Buyer + seller', developer: 'Integration team', operator: 'Product team' }[role] || role);
const roleLabel = role => `<span class="role role-${esc(role)}"><span class="role-symbol" aria-hidden="true"></span>${esc(roleName(role))}</span>`;
const link = (url, text, className = '') => `<a class="${className}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}${icon('external')}<span class="sr-only"> (opens in a new tab)</span></a>`;

const steps = chapter => chapter.steps.map(step => `<li class="step-row">
  <details class="step" id="${esc(step.id)}" data-disclosure="step">
    <summary>${roleLabel(step.role)}<span class="step-label">${esc(step.label)}</span>${icon('plus', 'disclosure-icon')}${step.gate ? `<span class="gate">${icon('gate')}${esc(step.gate)}</span>` : ''}</summary>
    <div class="step-body"><p>${esc(step.detail)}</p>${step.outcome ? `<p class="step-outcome"><span>Result</span> ${esc(step.outcome)}</p>` : ''}</div>
  </details>
</li>`).join('');
const branchSteps = branch => branch.steps.map((step, i) => {
  const item = typeof step === 'string' ? { label: step } : step;
  return `<li><span class="branch-step-number">${String(i + 1).padStart(2,'0')}</span><div>${item.role ? roleLabel(item.role) : ''}<span class="branch-step-label">${esc(item.label)}</span></div></li>`;
}).join('');

document.querySelector('#workflow-map').innerHTML = `
<a class="skip-link" href="#main">Skip to workflow maps</a>
<header class="site-header"><div class="header-inner">
  <a class="brand" href="#main" aria-label="Annora workflow guide">ANNORA<span>Workflow guide</span></a>
  ${link('../walkthrough/?viewer=independent', 'Open live walkthrough', 'primary-link')}
</div></header>
<main id="main" tabindex="-1">
  <section class="intro" aria-labelledby="page-title">
    <h1 id="page-title">From a product detail<br>to a shared next step.</h1>
    <p>Keep the product context with the conversation—from the first question to a reviewed quotation and what happens next.</p>
  </section>
  <section class="journey-section" id="journey" aria-labelledby="journey-title">
    <div class="section-heading"><h2 id="journey-title">One project. Three chapters.</h2><p>Select a step to see what carries forward.</p></div>
    <ol class="chapters">${journey.map((chapter,index) => `<li class="chapter">
      <div class="chapter-heading"><span class="chapter-number">${String(index+1).padStart(2,'0')}</span><h3>${esc(chapter.title)}</h3>${index < 2 ? icon('arrow','chapter-arrow') : ''}</div>
      <p class="chapter-summary">${esc(chapter.summary)}</p>
      <ol class="steps">${steps(chapter)}</ol>
    </li>`).join('')}</ol>
    <p class="optional-path">${icon('arrow')}<strong>No change needed?</strong> Go from quotation v1 directly to agreeing on the next step. The demo includes a revision to show how it works.</p>
    <div class="context-strip"><strong>Context stays attached</strong><ul><li>Selected part</li><li>Saved view</li><li>Exact versions</li><li>Project conversation</li></ul></div>
  </section>
  <section class="branches-section" id="branches" aria-labelledby="branches-title">
    <div class="section-heading"><div><h2 id="branches-title">Follow the question.</h2><p>Open the branch that matters to your customer.</p></div><span class="branch-count">5 supporting workflows</span></div>
    <div class="branches">${branches.map((branch,index) => `<details class="branch" id="${esc(branch.id)}" data-disclosure="branch">
      <summary><span class="branch-number">${String(index+2).padStart(2,'0')}</span><div class="branch-title"><h3>${esc(branch.title)}</h3><p>${esc(branch.summary)}</p></div><span class="branch-audience">${esc(branch.audience)}</span>${icon('plus','disclosure-icon')}</summary>
      <div class="branch-content"><ol class="branch-flow">${branchSteps(branch)}</ol><div class="branch-notes"><h4>What matters here</h4><ul>${branch.rules.map(rule => `<li>${esc(rule)}</li>`).join('')}</ul><div class="branch-links">${branch.demoHref ? link(branch.demoHref, 'Open this example', 'secondary-link') : ''}${link(sourceRoot + branch.sourceDoc, 'Read the workflow', 'text-link')}</div></div></div>
    </details>`).join('')}</div>
  </section>
  <section class="continuity" aria-labelledby="return-title">
    <div><h2 id="return-title">The conversation can continue later.</h2><p>A returning buyer can reopen a project, answer a question or inspect the exact version behind a quotation. A seller can prepare a focused follow-up around that same context.</p></div>
    <div class="return-flow" aria-label="Return to a project, reopen its exact reference, continue the next action"><span>Return to project</span>${icon('arrow')}<span>Reopen exact reference</span>${icon('arrow')}<strong>Continue the next action</strong></div>
  </section>
  <details class="scope" id="demo-scope"><summary><span>What this demo includes</span>${icon('plus','disclosure-icon')}</summary><div><p>The walkthrough uses fictional, browser-local data. Review is followed by explicit confirmation; no real inquiry, email, order or payment is sent. Returning to local projects works in the same browser. Production accounts, permissions, delivery and cross-device storage need API integration.</p><p>The independent viewer example supports component selection and saved views. Drawings, option comparison and product publishing have separate prepared examples. Continue demo guides the presentation; it does not automatically approve business actions.</p></div></details>
</main>
<footer><span>Annora · Product understanding, carried forward.</span>${link(sourceRoot+'docs/user-workflow-maps.md','Complete workflow notes','text-link')}</footer>
`;

// Presentation state lives in the URL only. No project repository or browser store.
const disclosures = [...document.querySelectorAll('[data-disclosure]')];
function setDisclosure(target, open, updateURL = true) {
  if (open) disclosures.filter(item => item !== target && item.dataset.disclosure === target.dataset.disclosure).forEach(item => { item.open = false; });
  target.open = open;
  if (updateURL) {
    const id = open ? target.id : target.dataset.disclosure === 'step' ? 'journey' : 'branches';
    if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
  }
}
for (const detail of disclosures) detail.querySelector('summary').addEventListener('click', event => {
  event.preventDefault();
  setDisclosure(detail, !detail.open);
});
function readLocation(scroll = false) {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = disclosures.find(detail => detail.id === id);
  if (target) {
    setDisclosure(target, true, false);
    if (scroll) target.scrollIntoView({block:'start'});
  } else if (id === 'journey' || id === 'branches' || !id) {
    disclosures.filter(detail => !id || detail.dataset.disclosure === (id === 'journey' ? 'step' : 'branch')).forEach(detail => { detail.open = false; });
  }
}
window.addEventListener('popstate', () => readLocation(true));
window.addEventListener('hashchange', () => readLocation(true));
readLocation(true);

// Printing is a reading view: include every explanation, then restore the screen.
let printState;
window.addEventListener('beforeprint', () => {
  printState = [...document.querySelectorAll('details')].map(detail => [detail, detail.open]);
  printState.forEach(([detail]) => { detail.open = true; });
});
window.addEventListener('afterprint', () => printState?.forEach(([detail, open]) => { detail.open = open; }));
