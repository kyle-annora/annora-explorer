import { projectEvidence, safeEvidenceSource } from './evidence-domain.js';
import { createEvidenceRepository } from './evidence-repository.js';

const controllers = new WeakMap();
const demoModes = new Set(['options-demo', 'impact-demo', 'follow-up-demo', 'drawing-preview']);
const unavailable = () => ({status:'unavailable', coverage:'unknown', events:[], sessionDenominator:null});

/** Provenance follows the declared local repository scope, never the current UI role. */
export function evidenceModeForRepository(repository) {
  if (repository?.evidenceScope?.schemaVersion !== 1 || repository.evidenceScope.storage !== 'browser-local') return 'unknown';
  if (repository.mode === 'walkthrough') return 'presenter';
  if (demoModes.has(repository.mode)) return 'demo';
  return repository.mode === 'demo' ? 'ordinary' : 'unknown';
}

/** A host can inject an optional observation adapter. Neither read nor record can mutate business state. */
export function createProjectEvidenceController({repository, observations, ...options} = {}) {
  const mode = evidenceModeForRepository(repository);
  const scope = repository?.evidenceScope;
  let observer = observations;
  try {
    if (!observer && mode !== 'unknown' && typeof scope?.namespace === 'string') {
      observer = createEvidenceRepository({...options, key:scope.namespace, mode});
    }
  } catch { /* Optional storage must never prevent the project from loading. */ }
  return Object.freeze({
    mode,
    async read(projectId) {
      let report = null;
      try {
        const project = await repository.getProject(projectId);
        if (!project || project.id !== projectId) return {status:'unavailable', report:null, observations:unavailable()};
        report = projectEvidence(project, {mode});
      } catch { return {status:'unavailable', report:null, observations:unavailable()}; }
      let observed = unavailable();
      if (observer) { try { observed = await observer.readProject(projectId) || unavailable(); } catch {} }
      else observed = {...unavailable(), status:'unsupported'};
      return {status:'available', report, observations:observed};
    },
    async observe(project, {type, role, context, record, operationId} = {}) {
      try {
        if (!observer || !project?.id) return {status:'unsupported', recorded:false};
        const id = operationId || `VIEW-${globalThis.crypto.randomUUID()}`;
        return await observer.recordObservation({type, projectId:project.id, projectRevision:project.revision,
          role, operationId:id, source:safeEvidenceSource(context || project.context), record});
      } catch { return {...unavailable(), recorded:false}; }
    },
  });
}

export function projectEvidenceController(repository) {
  if (!controllers.has(repository)) controllers.set(repository, createProjectEvidenceController({repository}));
  return controllers.get(repository);
}
