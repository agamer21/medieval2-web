import {decodeTga} from './tga.js';
import {installedGame} from './installed-game.js';

const artPath = 'data/world/maps/battle/norman_prologue/battle_of_hastings/loading_screen.tga';
const introPath = './assets/prologue/intro.mp4';
const art = document.getElementById('prologue-art');
const status = document.getElementById('prologue-status');
const watch = document.getElementById('watch-intro');
const intro = document.getElementById('intro');
const video = document.getElementById('intro-video');

async function loadArt() {
  const reader = await installedGame();
  if (!reader) return;
  const image = decodeTga(await reader.read(artPath));
  art.width = image.width;
  art.height = image.height;
  art.getContext('2d').drawImage(image, 0, 0);
}

loadArt().catch(error => { status.textContent = error.message; });
if (['127.0.0.1', 'localhost'].includes(location.hostname)) {
  fetch(introPath, {method: 'HEAD'}).then(response => {
    watch.hidden = !response.ok || !response.headers.get('Content-Type')?.startsWith('video/');
  }).catch(() => {});
}

watch.addEventListener('click', async () => {
  intro.hidden = false;
  video.src = introPath;
  try {
    await video.play();
    video.focus();
  } catch {
    intro.hidden = true;
    status.textContent = 'The intro could not play. You can start the tutorial directly.';
  }
});
video.addEventListener('ended', () => { location.href = './?scenario=hastings'; });
