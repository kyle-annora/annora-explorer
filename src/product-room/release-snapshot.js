/** Validate historical content without consulting today's model or asset catalog.
 * Old projects must remain readable after a later model/package deployment. */
export function validHistoricalRoomSnapshot(snapshot, context) {
  const text = value => typeof value === 'string';
  const nonempty = value => text(value) && value.trim().length > 0;
  const optionalText = value => value === undefined || text(value);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const list = (value, check) => Array.isArray(value) && value.every(check);
  const unique = value => new Set(value.map(item => item.id)).size === value.length;
  if (!object(snapshot) || snapshot.id !== context.roomReleaseId || snapshot.productId !== context.productId
      || snapshot.modelRevision !== context.modelRevision || !Number.isSafeInteger(snapshot.version) || snapshot.version < 0
      || !['bundled','demo','preview'].includes(snapshot.source) || !nonempty(snapshot.createdAt) || !Number.isFinite(Date.parse(snapshot.createdAt))) return false;
  const content = snapshot.content;
  if (!object(content) || content.id !== context.productId || content.modelId !== context.modelId
      || !['title','shortTitle','eyebrow','tagline','description','summary','demoNotice','roomRevision'].every(key => text(content[key]))) return false;
  if (!object(content.source) || !['label','author','license','url','note'].every(key => text(content.source[key]))) return false;
  if (!list(content.highlights,item => object(item) && text(item.label) && text(item.value))) return false;
  if (!list(content.specGroups,group => object(group) && nonempty(group.id) && text(group.title)
      && list(group.facts,fact => object(fact) && text(fact.label) && text(fact.value) && text(fact.source)
        && ['note','nodeId','status'].every(key=>optionalText(fact[key]))))) return false;
  if (!list(content.questions,item=>object(item) && ['id','title','description','actionLabel'].every(key=>nonempty(item[key]))
      && object(item.target) && (item.target.kind === 'part' ? nonempty(item.target.nodeId)
        : item.target.kind === 'chapter' && nonempty(item.target.tourId) && nonempty(item.target.chapterId)))) return false;
  if (!list(content.documents,doc=>object(doc) && ['id','title','revision','assetId'].every(key=>nonempty(doc[key]))
      && ['description','type','date','fileName','nodeId'].every(key=>optionalText(doc[key]))) || !unique(content.documents)) return false;
  if (content.partContent !== undefined && !list(content.partContent,part=>object(part) && nonempty(part.nodeId) && text(part.title) && text(part.description)
      && list(part.documentIds,id=>nonempty(id) && content.documents.some(doc=>doc.id===id)))) return false;
  return snapshot.presentation === undefined || object(snapshot.presentation)
    && ['engineering','linework','flat'].includes(snapshot.presentation.defaultRenderStyle);
}
