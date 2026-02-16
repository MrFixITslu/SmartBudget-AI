/**
 * Fire Finance - Mirrored Storage Engine
 * High-performance persistence using IndexedDB with optional SSD Mirroring.
 */

const DB_NAME = 'FireFinance_v1';
const DATA_STORE = 'app_state';
const MIRROR_HANDLE_STORE = 'mirror_handles';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DATA_STORE)) db.createObjectStore(DATA_STORE);
      if (!db.objectStoreNames.contains(MIRROR_HANDLE_STORE)) db.createObjectStore(MIRROR_HANDLE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Universal Download Utility for ad-hoc exports
 */
export const triggerSecureDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 2000);
};

/**
 * Mirror App State to Hard Drive via FileSystemFileHandle
 */
export const saveToMirrorFile = async (handle: FileSystemFileHandle, data: any): Promise<boolean> => {
  try {
    const permission = await (handle as any).requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') return false;

    const writable = await (handle as any).createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    return true;
  } catch (err) {
    console.error("Mirror Sync Failed:", err);
    return false;
  }
};

/**
 * Persist/Retrieve Mirror Handle from IndexedDB
 */
export const storeMirrorHandle = async (handle: FileSystemFileHandle): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MIRROR_HANDLE_STORE, 'readwrite');
    transaction.objectStore(MIRROR_HANDLE_STORE).put(handle, 'active_mirror');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getMirrorHandle = async (): Promise<FileSystemFileHandle | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MIRROR_HANDLE_STORE, 'readonly');
    const request = transaction.objectStore(MIRROR_HANDLE_STORE).get('active_mirror');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Legacy Support for Event Planner Directory Access
 */
export const saveFileToHardDrive = async (
  directoryHandle: FileSystemDirectoryHandle,
  projectName: string,
  fileName: string,
  blob: Blob
): Promise<string> => {
  try {
    const folderName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const projectFolder = await directoryHandle.getDirectoryHandle(folderName, { create: true });
    const fileHandle = await projectFolder.getFileHandle(fileName, { create: true });
    const writable = await (fileHandle as any).createWritable();
    await writable.write(blob);
    await writable.close();
    return `${folderName}/${fileName}`;
  } catch (error) {
    throw error;
  }
};

export const getFileFromHardDrive = async (
  directoryHandle: FileSystemDirectoryHandle,
  storageRef: string
): Promise<Blob> => {
  const [folderName, fileName] = storageRef.split('/');
  const projectFolder = await directoryHandle.getDirectoryHandle(folderName);
  const fileHandle = await projectFolder.getFileHandle(fileName);
  return await fileHandle.getFile();
};

export const storeVaultHandle = storeMirrorHandle as any;
export const getStoredVaultHandle = getMirrorHandle as any;
export const clearVaultHandle = async () => {
  const db = await initDB();
  const transaction = db.transaction(MIRROR_HANDLE_STORE, 'readwrite');
  transaction.objectStore(MIRROR_HANDLE_STORE).delete('active_mirror');
};
