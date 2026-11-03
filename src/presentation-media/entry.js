import { PROJECT_CONFIG } from '../generated/project.js';
import { PRESENTATION_ASSETS, getPresentationAssets } from '../explorer/presentation-assets.js';

const $ = id => document.getElementById(id);
for (const record of PRESENTATION_ASSETS) {
  const option = document.createElement('option'); option.value = record.modelId; option.textContent = record.title;
  $('model-select').append(option);
}
function render() {
  const video = $('film');
  video.pause(); video.removeAttribute('src'); video.removeAttribute('poster'); video.load();
  try {
    const requested = new URLSearchParams(location.search).get('model');
    const record = requested === null ? PRESENTATION_ASSETS[0] : getPresentationAssets(requested);
    if (!record) throw new Error('Choose an available presentation. This project has no matching media for that model.');
    const { media } = record;
    document.title = `${record.shortTitle} · Film & keyframes`;
    $('identity').textContent = `${PROJECT_CONFIG.brand.name} / ${PROJECT_CONFIG.brand.product}`; $('model-select').value = record.modelId;
    $('back-to-explorer').href = `../?model=${encodeURIComponent(record.modelId)}&presentation=1`;
    $('media-title').textContent = `Inside ${record.shortTitle}.`;
    $('description').textContent = `A silent presentation from the same prepared ${record.title} model and timeline used in Explorer. Open the interactive model to inspect a part or take control.`;
    $('credits').textContent = record.attribution; $('source-link').href = record.sourceUrl;
    video.src = media.film; video.poster = media.hero; video.hidden = false;
    $('media-state').hidden = true;
    for (const role of ['film','gif']) {
      const link = $(`download-${role}`); link.href = media[role];
      link.download = `annora-${record.modelId}.${role === 'film' ? 'mp4' : 'gif'}`;
    }
    for (const [role, caption] of [['hero','01 / The whole assembly'],['exploded','02 / Connected layers'],['detail','03 / Technical detail']]) {
      const figure = $(`frame-${role}`), link = $(`${role}-link`), image = figure.querySelector('img');
      image.src = media[role]; image.alt = `${record.title}: ${caption.slice(5)}`;
      link.href = media[role]; link.download = `${record.modelId}-${role}.png`; figure.querySelector('figcaption').textContent = caption;
    }
    $('media-spec').textContent = '';
  } catch (error) {
    document.title = `Presentation media unavailable · ${PROJECT_CONFIG.title}`;
    $('media-title').textContent = 'Presentation unavailable.'; $('description').textContent = error.message;
    $('film').hidden = true; $('downloads').hidden = true; $('frames').hidden = true; $('source-link').hidden = true;
    $('back-to-explorer').href = '../'; $('credits').textContent = 'No model media selected.';
  }
}
$('model-select').addEventListener('change', () => {
  const url = new URL(location.href); url.searchParams.set('model', $('model-select').value); location.href = url.href;
});
$('film').addEventListener('loadedmetadata', () => {
  const video = $('film'); $('media-spec').textContent = `${video.videoWidth} × ${video.videoHeight} · ${video.duration} seconds · silent`;
});
$('film').addEventListener('error', () => {
  $('media-state').hidden = false; $('media-state').textContent = 'The film could not load. Retry this page or open the interactive model.';
});
render();
