
/**
 * Fire Finance File Storage Engine
 * Prevents localStorage crashes by using IndexedDB for large blobs
 * and supports real Hard Drive folder syncing via File System Access API.
 */

const DB_NAME = 'FireFinanceVault';
const STORE_NAME = 'project_files';
const HANDLE_STORE = 'vault_handles';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2); // Incremented version to add handles store
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
      if (!request.result.objectStoreNames.contains(HANDLE_STORE)) {
        request.result.createObjectStore(HANDLE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveFileToIndexedDB = async (id: string, data: Blob): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(data, id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getFileFromIndexedDB = async (id: string): Promise<Blob | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

export const deleteFileFromIndexedDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Vault Handle Persistence
 */
export const storeVaultHandle = async (handle: FileSystemDirectoryHandle): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HANDLE_STORE, 'readwrite');
    const store = transaction.objectStore(HANDLE_STORE);
    const request = store.put(handle, 'primary_vault');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getStoredVaultHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HANDLE_STORE, 'readonly');
    const store = transaction.objectStore(HANDLE_STORE);
    const request = store.get('primary_vault');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

export const clearVaultHandle = async (): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HANDLE_STORE, 'readwrite');
    const store = transaction.objectStore(HANDLE_STORE);
    const request = store.delete('primary_vault');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Native File System Access Logic
 */
export const saveFileToHardDrive = async (
  directoryHandle: FileSystemDirectoryHandle,
  projectName: string,
  fileName: string,
  blob: Blob
): Promise<string> => {
  try {
    // Ensure we have permission
    // Fix: Cast to any as queryPermission might be missing from some FileSystemDirectoryHandle definitions
    const permission = await (directoryHandle as any).queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      throw new Error("Hard drive access permission not granted.");
    }

    // Sanitize folder name
    const folderName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const projectFolder = await directoryHandle.getDirectoryHandle(folderName, { create: true });
    const fileHandle = await projectFolder.getFileHandle(fileName, { create: true });
    // Fix: Cast to any as createWritable might be missing from some FileSystemFileHandle definitions
    const writable = await (fileHandle as any).createWritable();
    await writable.write(blob);
    await writable.close();
    return `${folderName}/${fileName}`;
  } catch (error) {
    console.error("Native File System Error:", error);
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
  const file = await fileHandle.getFile();
  return file;
};
