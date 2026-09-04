/* Verralux Lab Journal — IndexedDB Layer
   Local-only storage. Single-user. Full backup/restore support. */

const DB_NAME = 'verralux_lab_journal';
const DB_VERSION = 1;

const STORES = {
  // ============ LIBRARY ============
  ingredients:          { keyPath: 'id', indexes: ['name', 'type', 'family', 'volatility', 'status'] },
  accords:              { keyPath: 'id', indexes: ['name', 'accordType', 'status'] },
  reference_perfumes:   { keyPath: 'id', indexes: ['name', 'brand'] },
  suppliers:            { keyPath: 'id', indexes: ['name'] },
  perfumers:            { keyPath: 'id', indexes: ['name'] },
  storage_presets:      { keyPath: 'id', indexes: ['name'] },

  // ============ R&D (Editable) ============
  ingredient_studies:   { keyPath: 'id', indexes: ['ingredientId', 'date'] },
  accord_developments:  { keyPath: 'id', indexes: ['name', 'date'] },
  accord_iterations:    { keyPath: 'id', indexes: ['developmentId', 'version'] },
  clone_trials:         { keyPath: 'id', indexes: ['cloneOilId', 'date'] },
  clone_trial_tests:    { keyPath: 'id', indexes: ['trialId', 'concentration'] },
  original_compositions:{ keyPath: 'id', indexes: ['name', 'date'] },
  composition_iterations:{ keyPath: 'id', indexes: ['compositionId', 'version'] },
  note_curves:          { keyPath: 'id', indexes: ['refId', 'refType'] },
  fixative_trials:      { keyPath: 'id', indexes: ['baseTrialId', 'date'] },
  modifier_trials:      { keyPath: 'id', indexes: ['baseTrialId', 'date'] },
  formula_locks:        { keyPath: 'id', indexes: ['name', 'sku', 'date'] },

  // ============ PRODUCTION JOURNAL (Append-Only) ============
  production_batches:   { keyPath: 'id', indexes: ['batchNumber', 'formulaId', 'date', 'status'] },
  compounding_entries:  { keyPath: 'id', indexes: ['batchId', 'timestamp'] },
  maceration_checkins:  { keyPath: 'id', indexes: ['batchId', 'timestamp'] },
  filtration_logs:      { keyPath: 'id', indexes: ['batchId', 'timestamp'] },
  qc_tests:             { keyPath: 'id', indexes: ['batchId', 'testType', 'timestamp'] },
  ifra_checks:          { keyPath: 'id', indexes: ['batchId', 'timestamp'] },
  sensory_evaluations:  { keyPath: 'id', indexes: ['batchId', 'timestamp'] },
  release_records:      { keyPath: 'id', indexes: ['batchId', 'timestamp'] },

  // ============ SYSTEM ============
  audit_log:            { keyPath: 'id', indexes: ['store', 'refId', 'timestamp'] },
  app_settings:         { keyPath: 'key' },
  seed_status:          { keyPath: 'key' }
};

let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const [storeName, cfg] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: cfg.keyPath });
          (cfg.indexes || []).forEach(idx => {
            store.createIndex(idx, idx, { unique: false });
          });
        }
      }
    };

    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function tx(store, mode = 'readonly') {
  return openDB().then(db => db.transaction(store, mode).objectStore(store));
}

// Stores that are append-only (production journal)
const APPEND_ONLY = new Set([
  'production_batches',
  'compounding_entries',
  'maceration_checkins',
  'filtration_logs',
  'qc_tests',
  'ifra_checks',
  'sensory_evaluations',
  'release_records',
  'audit_log'
]);

const DB = {
  async put(store, record) {
    const s = await tx(store, 'readwrite');
    return new Promise((resolve, reject) => {
      const r = s.put(record);
      r.onsuccess = () => resolve(record);
      r.onerror = (e) => reject(e.target.error);
    });
  },

  async add(store, record, prefix) {
    if (!record.id) record.id = genId(prefix || store.slice(0, 3));
    if (!record.createdAt) record.createdAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    return DB.put(store, record);
  },

  /**
   * Append-only add — never overwrites existing.
   * Also writes an audit log entry.
   */
  async append(store, record, prefix) {
    if (!APPEND_ONLY.has(store)) {
      throw new Error(`Store ${store} is not append-only`);
    }
    if (record.id) {
      const existing = await DB.get(store, record.id);
      if (existing) {
        throw new Error(`Append-only violation: ${store}/${record.id} already exists`);
      }
    } else {
      record.id = genId(prefix || store.slice(0, 3));
    }
    record.createdAt = new Date().toISOString();
    record.locked = true;

    await DB.put(store, record);
    await DB.audit(store, record.id, 'append', null, record);
    return record;
  },

  /**
   * For append-only stores: instead of edit, add a correction linked
   * to the original entry.
   */
  async correct(store, originalId, correctionData, reason) {
    if (!APPEND_ONLY.has(store)) {
      throw new Error(`Store ${store} is not append-only — use put/add instead`);
    }
    const original = await DB.get(store, originalId);
    if (!original) throw new Error('Original entry not found');

    const correction = {
      ...correctionData,
      id: genId('cor'),
      isCorrection: true,
      correctionOf: originalId,
      correctionReason: reason,
      createdAt: new Date().toISOString(),
      locked: true
    };
    await DB.put(store, correction);
    await DB.audit(store, correction.id, 'correction', original, correction);
    return correction;
  },

  async get(store, id) {
    const s = await tx(store);
    return new Promise((resolve, reject) => {
      const r = s.get(id);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = (e) => reject(e.target.error);
    });
  },

  async getAll(store) {
    const s = await tx(store);
    return new Promise((resolve, reject) => {
      const r = s.getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = (e) => reject(e.target.error);
    });
  },

  async getByIndex(store, indexName, value) {
    const s = await tx(store);
    return new Promise((resolve, reject) => {
      const r = s.index(indexName).getAll(value);
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = (e) => reject(e.target.error);
    });
  },

  async delete(store, id) {
    if (APPEND_ONLY.has(store)) {
      throw new Error(`Cannot delete from append-only store ${store}`);
    }
    const s = await tx(store, 'readwrite');
    return new Promise((resolve, reject) => {
      const r = s.delete(id);
      r.onsuccess = () => resolve(true);
      r.onerror = (e) => reject(e.target.error);
    });
  },

  async count(store) {
    const s = await tx(store);
    return new Promise((resolve, reject) => {
      const r = s.count();
      r.onsuccess = () => resolve(r.result);
      r.onerror = (e) => reject(e.target.error);
    });
  },

  async clear(store) {
    const s = await tx(store, 'readwrite');
    return new Promise((resolve, reject) => {
      const r = s.clear();
      r.onsuccess = () => resolve(true);
      r.onerror = (e) => reject(e.target.error);
    });
  },

  /**
   * Audit trail — records every write to append-only stores
   */
  async audit(store, refId, action, before, after) {
    const entry = {
      id: genId('aud'),
      store,
      refId,
      action,
      before: before ? JSON.parse(JSON.stringify(before)) : null,
      after: after ? JSON.parse(JSON.stringify(after)) : null,
      timestamp: new Date().toISOString()
    };
    const s = await tx('audit_log', 'readwrite');
    return new Promise((resolve, reject) => {
      const r = s.put(entry);
      r.onsuccess = () => resolve(entry);
      r.onerror = (e) => reject(e.target.error);
    });
  },

  // Settings
  async getSetting(key, fallback = null) {
    const rec = await DB.get('app_settings', key);
    return rec ? rec.value : fallback;
  },

  async setSetting(key, value) {
    return DB.put('app_settings', { key, value });
  },

  // Backup / Restore
  async exportAll() {
    const out = {
      _app: 'verralux_lab_journal',
      _version: DB_VERSION,
      _exportedAt: new Date().toISOString()
    };
    for (const store of Object.keys(STORES)) {
      out[store] = await DB.getAll(store);
    }
    return out;
  },

  async importAll(data, opts = {}) {
    const { wipeFirst = false } = opts;
    if (data._app !== 'verralux_lab_journal') {
      throw new Error('Invalid backup file — not a Verralux Lab Journal export');
    }

    if (wipeFirst) {
      for (const store of Object.keys(STORES)) {
        await DB.clear(store);
      }
    }

    let count = 0;
    for (const [store, records] of Object.entries(data)) {
      if (!STORES[store] || !Array.isArray(records)) continue;
      for (const rec of records) {
        if (!rec.id && !rec.key) continue;
        await DB.put(store, rec);
        count++;
      }
    }
    return count;
  },

  async wipeAll() {
    for (const store of Object.keys(STORES)) {
      await DB.clear(store);
    }
  }
};

window.DB = DB;
window.genId = genId;