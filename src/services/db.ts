// MIT License
// MIT License
import { openDB, IDBPDatabase } from 'idb';
import { FarmerRecord } from '../types';

const DB_NAME = 'AgriSmartConnect';
const STORE_NAME = 'farmer_registrations';

export const initDB = async (): Promise<IDBPDatabase> => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('status', 'status');
      }
    },
  });
};

export const saveFarmerOffline = async (record: Omit<FarmerRecord, 'id'>) => {
  const db = await initDB();
  return db.add(STORE_NAME, record);
};

export const getPendingFarmers = async (): Promise<FarmerRecord[]> => {
  const db = await initDB();
  return db.getAllFromIndex(STORE_NAME, 'status', 'pending');
};

export const updateFarmerStatus = async (id: number, status: FarmerRecord['status']) => {
  const db = await initDB();
  const record = await db.get(STORE_NAME, id);
  if (record) {
    record.status = status;
    await db.put(STORE_NAME, record);
  }
};

export const getAllFarmers = async (): Promise<FarmerRecord[]> => {
  const db = await initDB();
  return db.getAll(STORE_NAME);
};

export const clearDatabase = async () => {
  const db = await initDB();
  await db.clear(STORE_NAME);
};

export const deleteFarmer = async (id: number) => {
  const db = await initDB();
  await db.delete(STORE_NAME, id);
};
