import React, {useEffect, useRef, useState} from 'react';
import {projectEvidenceController} from '../product-room/evidence-host.js';
import {ProjectEvidence} from './project-evidence.jsx';

/** Optional read-only area; failed evidence loading never changes project actions. */
export function ProjectEvidencePanel({repository, project}) {
  const [state, setState] = useState({loading:true});
  const generation = useRef(0);
  async function refresh() {
    const turn = ++generation.current;
    setState(previous => ({...previous, loading:true}));
    try {
      const result = await projectEvidenceController(repository).read(project.id);
      if (turn === generation.current) setState({...result, loading:false});
    } catch {
      if (turn === generation.current) setState({loading:false, status:'unavailable'});
    }
  }
  useEffect(() => {
    void refresh();
    const changed = () => { void refresh(); };
    window.addEventListener('focus', changed);
    window.addEventListener('storage', changed);
    return () => { ++generation.current; window.removeEventListener('focus', changed); window.removeEventListener('storage', changed); };
  }, [repository, project.id, project.revision]);
  return <ProjectEvidence report={state.report} observations={state.observations} loading={state.loading}
    error={!state.loading && state.status === 'unavailable'} onRefresh={refresh} />;
}
