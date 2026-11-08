import {openGameFiles, openRemoteGameFiles} from './pack.js';

async function handleStore(mode, operation) {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('medieval2-installation', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('folders');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction('folders', mode);
      const request = operation(transaction.objectStore('folders'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

async function readFolder(folder) {
  const packs = await folder.getDirectoryHandle('packs');
  const files = [];
  async function add(handle, relativePath) {
    const file = await handle.getFile();
    Object.defineProperty(file, 'webkitRelativePath', {value: 'game/' + relativePath});
    files.push(file);
  }
  for await (const handle of packs.values()) {
    if (handle.kind === 'file' && /\.pack$/i.test(handle.name)) {
      await add(handle, 'packs/' + handle.name);
    }
  }
  const optional = [
    'data/animations/pack.idx', 'data/animations/pack.dat',
    'data/animations/skeletons.idx', 'data/animations/skeletons.dat',
    'data/world/maps/battle/norman_prologue/battle_of_hastings/loading_screen.tga'
  ];
  for (const path of optional) {
    const parts = path.split('/');
    const name = parts.pop();
    try {
      let directory = folder;
      for (const part of parts) directory = await directory.getDirectoryHandle(part);
      await add(await directory.getFileHandle(name), path);
    } catch (error) {
      if (error.name !== 'NotFoundError') throw error;
    }
  }
  return openGameFiles(files);
}

export async function connectInstalledGame() {
  const folder = await window.showDirectoryPicker({id: 'medieval2-installation', mode: 'read'});
  const reader = await readFolder(folder);
  await handleStore('readwrite', store => store.put(folder, 'installation'));
  return reader;
}

export async function installedGame() {
  if (['127.0.0.1', 'localhost'].includes(location.hostname)) {
    const response = await fetch('./api/game', {cache: 'no-store'});
    if (response.ok) {
      const manifest = await response.json();
      if (manifest.available) return openRemoteGameFiles(manifest);
    }
  }
  const folder = await handleStore('readonly', store => store.get('installation'));
  if (folder && await folder.queryPermission({mode: 'read'}) === 'granted') return readFolder(folder);
  return null;
}
