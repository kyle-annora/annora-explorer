import { normalizeProjectContext, sameProjectValue } from './project-domain.js';
import { recordContext } from './drawing-context.js';
import { buyerRouteHash, readBuyerRoute } from './navigation.js';
import { walkthroughViewer } from '../walkthrough/session.js';
import { walkthroughRootURL, walkthroughViewerURL } from '../walkthrough/flow.js';

const referenceKeys = ['project', 'requestItem', 'referenceQuote', 'referenceEntry', 'referenceReview'];
const fail = message => { throw Object.assign(new Error(message), {code:'EXTERNAL_REFERENCE_UNAVAILABLE'}); };
const unavailable = () => fail('This exact viewer reference is unavailable. Return to the saved project and open its reference again.');

/** This host registry names an installed adapter, never a URL supplied by a model. */
function requireInstalledReference(input) {
  const context = normalizeProjectContext(input), adapter = context.viewerReference?.adapter;
  if (!adapter || adapter.id !== 'annora-example-three-viewer' || adapter.version !== '1'
    || adapter.coordinateFrame !== 'source-meters-y-up-v1' || context.productId !== 'kinetic-01' || context.modelId !== 'kinetic-01')
    fail('The viewer that captured this reference is not installed in this demonstration. The saved record has not changed.');
  return context;
}

function requireSession(sessionId) {
  if (walkthroughViewer(sessionId) !== 'independent')
    fail('Open this viewer reference in its original independent-viewer demonstration. Existing projects have not changed.');
}

const quoteEntries = quote => [...(quote?.scopeSelection?.entries || []), ...(quote?.questionScope?.entries || []), ...(quote?.impactScope?.entries || [])];

/** Resolve only immutable project evidence. Missing or conflicting identities never
 * fall back to today's camera, another quotation, or the native Explorer. */
export function readExternalViewerReference(project, parameters) {
  if (!project?.id || referenceKeys.some(key => parameters.getAll(key).length > 1 || parameters.has(key) && !parameters.get(key))
    || parameters.get('project') !== project.id || parameters.has('referenceReview')
    || parameters.has('requestItem') && parameters.has('referenceQuote')
    || parameters.has('referenceEntry') && !parameters.has('referenceQuote')) return unavailable();
  let context;
  if (parameters.has('referenceQuote')) {
    const quote = project.quotes?.find(item => item.id === parameters.get('referenceQuote'));
    if (!quote) return unavailable();
    context = parameters.has('referenceEntry')
      ? quoteEntries(quote).find(item => item.id === parameters.get('referenceEntry'))?.context
      : recordContext(project, quote);
  } else if (parameters.has('requestItem')) {
    context = project.inquiry?.requestItems?.find(item => item.id === parameters.get('requestItem'))?.context;
  } else context = project.inquiry?.context || project.context;
  if (!context?.viewerReference) return unavailable();
  return requireInstalledReference(context);
}

/** URLs contain saved record identities; the opaque camera snapshot stays in the
 * isolated repository. A caller may pin the quotation currently being reviewed. */
export function externalViewerReferenceURL({base, sessionId, project, context = project?.context, role = 'buyer', returnView = '', quoteId} = {}) {
  requireSession(sessionId);
  const saved = requireInstalledReference(context);
  if (!project?.id) return unavailable();
  const url = walkthroughViewerURL(base, sessionId);
  url.searchParams.set('project', project.id);
  const pinned = quoteId === undefined ? null : project.quotes?.find(item => item.id === quoteId);
  const pinnedEntry = pinned && quoteEntries(pinned).find(entry => sameProjectValue(entry.context,saved));
  if (quoteId !== undefined && (!pinned || !sameProjectValue(recordContext(project,pinned),saved) && !pinnedEntry)) return unavailable();
  const item = project.inquiry?.requestItems?.find(item => sameProjectValue(item.context,saved));
  if (pinned) {
    url.searchParams.set('referenceQuote',pinned.id);
    if (!sameProjectValue(recordContext(project,pinned),saved)) url.searchParams.set('referenceEntry',pinnedEntry.id);
  }
  else if (item) url.searchParams.set('requestItem',item.id);
  else if (!sameProjectValue(project.inquiry?.context || project.context,saved)) {
    const quote = [...(project.quotes || [])].reverse().find(item => sameProjectValue(recordContext(project,item),saved) || quoteEntries(item).some(entry => sameProjectValue(entry.context,saved)));
    if (!quote) return unavailable();
    url.searchParams.set('referenceQuote',quote.id);
    if (!sameProjectValue(recordContext(project,quote),saved))
      url.searchParams.set('referenceEntry',quoteEntries(quote).find(entry => sameProjectValue(entry.context,saved)).id);
  }
  // Sanitize role and return state now; the viewer validates them again on return.
  const back = externalViewerReturnURL({base,sessionId,projectId:project.id,role,returnView});
  url.searchParams.set('returnRole',role === 'seller' ? 'seller' : 'buyer');
  url.searchParams.set('returnView',back.hash);
  return url;
}

/** Known local destinations only, including GitHub Pages subdirectories. */
export function externalViewerReturnURL({base, sessionId, projectId, role = 'buyer', returnView = ''} = {}) {
  requireSession(sessionId);
  if (typeof projectId !== 'string' || !projectId || projectId.length > 320 || /[\u0000-\u001f]/.test(projectId)) return unavailable();
  const seller = role === 'seller', url = new URL(seller ? 'studio/' : 'product-room/',walkthroughRootURL(base));
  url.searchParams.set('walkthrough',sessionId);
  url.searchParams.set(seller ? 'product' : 'model','kinetic-01');
  if (seller) {
    const [path,query = ''] = String(returnView).replace(/^#/,'').split('?');
    const supplied = new URLSearchParams(query), result = new URLSearchParams({id:projectId});
    if (path === 'project' && supplied.getAll('id').length === 1 && supplied.get('id') === projectId) {
      const tab = supplied.get('tab'), mode = supplied.get('mode');
      if (['inquiry','quotation','conversation'].includes(tab)) result.set('tab',tab);
      if (['detail','edit','quote-review','reply','reply-review','ack','ack-review'].includes(mode)) result.set('mode',mode);
      for (const key of ['quote','draft']) if (supplied.getAll(key).length === 1 && supplied.get(key)) result.set(key,supplied.get(key));
    }
    url.hash = `project?${result}`;
  } else {
    const route = readBuyerRoute(returnView);
    url.hash = buyerRouteHash(route.view === 'project' && route.projectId === projectId ? route : {view:'project',projectId});
  }
  return url;
}
