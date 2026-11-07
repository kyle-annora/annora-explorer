import {readWalkthroughSession} from './session.js';
import {mountWalkthrough} from './chrome-view.js';

const id=readWalkthroughSession();
// Embedded Studio previews keep their own isolated preview controls.
if(id && !new URLSearchParams(location.search).has('studioPreview')) mountWalkthrough(id);
