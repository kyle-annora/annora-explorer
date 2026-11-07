/** Buyer routes contain view identity, never inquiry contents or review tokens. */
const tabs = new Set(['inquiry', 'quotation', 'activity']);
const modes = new Set(['revision', 'next', 'message']);
export function readBuyerRoute(hash = globalThis.location?.hash || '') {
  const [view, ...parts] = String(hash || '').replace(/^#/, '').split('&');
  const query = new URLSearchParams(parts.join('&'));
  const target = query.get('part') ? {kind:'part',nodeId:query.get('part')} : query.get('chapter') && query.get('tour') ? {kind:'chapter',chapterId:query.get('chapter'),tourId:query.get('tour')} : undefined;
  return {view:view || 'explore', projectId:query.get('project') || undefined,
    ...(target ? {target} : {}),
    ...(tabs.has(query.get('tab')) ? {tab:query.get('tab')} : {}),
    ...(query.get('quote') ? {quoteId:query.get('quote')} : {}),
    ...(query.get('message') ? {messageId:query.get('message')} : {}),
    ...(modes.has(query.get('mode')) ? {mode:query.get('mode')} : {}),
    ...(query.get('stage') === 'review' ? {stage:'review'} : {}),
    ...(query.get('compare') === 'all' ? {compare:'all'} : {}),
  };
}
export function buyerRouteHash(route) {
  const query = new URLSearchParams();
  if (['project','explore'].includes(route.view) && route.projectId) query.set('project',route.projectId);
  if (route.view === 'explore' && route.target) {
    if (route.target.kind === 'part') query.set('part',route.target.nodeId);
    else {query.set('chapter',route.target.chapterId);query.set('tour',route.target.tourId);}
  }
  if (route.view === 'project') {
    if(tabs.has(route.tab))query.set('tab',route.tab);
    if(route.quoteId)query.set('quote',route.quoteId);
    if(route.mode === 'message' && route.messageId)query.set('message',route.messageId);
    if(modes.has(route.mode))query.set('mode',route.mode);
    if(route.compare === 'all')query.set('compare','all');
  }
  if (['project','inquiry'].includes(route.view) && route.stage === 'review') query.set('stage','review');
  return `#${route.view || 'explore'}${query.size ? `&${query}` : ''}`;
}
export function updateBuyerLocation(patch, {replace = false} = {}) {
  const url = new URL(location.href);
  url.hash = buyerRouteHash({...readBuyerRoute(),...patch});
  if (url.href !== location.href) history[replace ? 'replaceState' : 'pushState']({...history.state},'',url);
  window.dispatchEvent(new Event('annora:routechange'));
}
/** A 3D reference returns to a known role and project, never to an arbitrary URL. */
export function projectReturnURL({base, projectId, role = 'buyer', returnView, session} = {}) {
  const seller = role === 'seller';
  const url = new URL(seller ? '../studio/' : '../product-room/',base);
  const example = new URL(base).searchParams.get('followUpDemo');
  if (example) url.searchParams.set('followUpDemo',example);
  const optionsExample = new URL(base).searchParams.get('optionDemo');
  if (optionsExample) url.searchParams.set('optionDemo',optionsExample);
  if (session) url.searchParams.set('walkthrough',session);
  if (seller) {
    const [path,query=''] = String(returnView || '').replace(/^#/,'').split('?');
    const params = new URLSearchParams(query);
    url.hash = path === 'project' && params.get('id') === projectId ? `#project?${params}` : `#project?id=${encodeURIComponent(projectId)}`;
  } else {
    const route = readBuyerRoute(returnView);
    url.hash = buyerRouteHash(route.view === 'project' && route.projectId === projectId ? route : {view:'project',projectId});
  }
  return url;
}
