/**
 * SegreGuard — Unified Data Layer (Dual-Mode Cloud / Real-Time Local Hybrid)
 * Supports Cloud Firestore when configured, or auto-activates an instant
 * sub-10ms peer synchronization bus (BroadcastChannel + LocalStorage) for zero-risk demos.
 */

import {
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  Timestamp,
  limit,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase.js';

// Check if a real Firebase project is connected
function isFirebaseAvailable() {
  try {
    return (
      db &&
      db.app &&
      db.app.options &&
      db.app.options.apiKey &&
      db.app.options.apiKey !== 'PASTE_YOUR_API_KEY' &&
      !db.app.options.apiKey.startsWith('PASTE_')
    );
  } catch (_e) {
    return false;
  }
}

// ── Real-Time Local Event Bus (for instant cross-tab / multi-screen sync) ──
const BUS_CHANNEL = 'segreguard-realtime-bus';
let localBus = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    localBus = new BroadcastChannel(BUS_CHANNEL);
  } catch (e) {
    console.warn('BroadcastChannel not supported:', e);
  }
}

const STORAGE_KEYS = {
  EVENTS: 'segreguard_waste_events_v2',
  TASKS: 'segreguard_collection_tasks_v2',
  BINS: 'segreguard_bins_v2'
};

const listeners = {
  events: new Set(),
  tasks: new Set(),
  bins: new Set()
};

function notifyListeners(type) {
  if (type === 'events' || !type) {
    const evs = getLocalEvents();
    listeners.events.forEach(cb => {
      try { cb(evs); } catch (e) { console.error(e); }
    });
  }
  if (type === 'tasks' || !type) {
    const ts = getLocalTasks();
    listeners.tasks.forEach(cb => {
      try { cb(ts); } catch (e) { console.error(e); }
    });
  }
  if (type === 'bins' || !type) {
    const bs = getLocalBins();
    listeners.bins.forEach(cb => {
      try { cb(bs); } catch (e) { console.error(e); }
    });
  }
}

if (localBus) {
  localBus.onmessage = (msg) => {
    if (msg.data && msg.data.type) {
      notifyListeners(msg.data.type);
    }
  };
}

function broadcast(type) {
  notifyListeners(type);
  if (localBus) {
    localBus.postMessage({ type, timestamp: Date.now() });
  }
}

// ── Local Storage Data Helpers ──
function getLocalEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EVENTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalEvents(items) {
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(items));
  broadcast('events');
}

function getLocalTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalTasks(items) {
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(items));
  broadcast('tasks');
}

function getLocalBins() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BINS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalBins(items) {
  localStorage.setItem(STORAGE_KEYS.BINS, JSON.stringify(items));
  broadcast('bins');
}

// ── Hospital Ward Metadata ──
export const HOSPITAL_WARDS = {
  'ward-1': { id: 'ward-1', name: 'ICU-3 (Intensive Care)', floor: '3rd Floor, Block B', bedCount: 24, coords: { x: 32, y: 38 } },
  'ward-2': { id: 'ward-2', name: 'OT-2 (Surgical Theatre)', floor: '2nd Floor, Block A', bedCount: 6, coords: { x: 74, y: 28 } },
  'ward-3': { id: 'ward-3', name: 'Trauma & Emergency', floor: 'Ground Floor, Main Hub', bedCount: 30, coords: { x: 25, y: 72 } },
  'ward-4': { id: 'ward-4', name: 'General Inpatient A', floor: '1st Floor, Block C', bedCount: 45, coords: { x: 68, y: 76 } }
};

// ── Seed Default Realistic Hospital Data ──
export async function seedData() {
  const existingBins = getLocalBins();
  if (existingBins && existingBins.length > 0) return;

  const now = Date.now();
  const initialBins = [];
  const initialTasks = [];
  const initialEvents = [];

  const categories = ['yellow', 'red', 'white', 'blue'];
  const wards = ['ward-1', 'ward-2', 'ward-3', 'ward-4'];

  wards.forEach((wardId, wIdx) => {
    categories.forEach((cat, cIdx) => {
      // Create varying fill levels and 48-hour SLA deadline
      // 48 hours = 48 * 3600 * 1000 ms
      const slaAgeHours = (wIdx * 11 + cIdx * 7) % 44; // simulate age
      const slaStartedAt = now - (slaAgeHours * 3600 * 1000);
      const slaDeadline = slaStartedAt + (48 * 3600 * 1000);
      
      const fill = (wIdx === 0 && cat === 'red') ? 86 :
                   (wIdx === 1 && cat === 'yellow') ? 92 :
                   Math.floor(15 + Math.random() * 45);

      const binId = `bin-${cat}-${wardId}`;
      initialBins.push({
        id: binId,
        wardId,
        category: cat,
        fillPercent: fill,
        barcodeId: `BIN-${cat.toUpperCase()}-${wardId.toUpperCase()}`,
        slaStartedAt,
        slaDeadline,
        lastEmptiedAt: slaStartedAt
      });

      // Auto-trigger tasks for bins over 80% capacity
      if (fill >= 80) {
        initialTasks.push({
          id: `task-init-${cat}-${wardId}`,
          binId,
          wardId,
          wardName: HOSPITAL_WARDS[wardId]?.name || wardId,
          category: cat,
          status: 'pending',
          urgency: fill >= 90 ? 'CRITICAL' : 'HIGH',
          reason: `Bin fill at ${fill}% (Capacity Threshold)`,
          requestedAt: new Date(now - 18 * 60 * 1000).toISOString(),
          slaDeadline,
          assignedTo: 'Porter-Team-Alpha'
        });
      }
    });
  });

  // Add a few historical scan events
  const sampleItems = [
    { itemLabel: 'Disposable Syringe w/o Needle', category: 'red', confidence: 0.94, wardId: 'ward-1' },
    { itemLabel: 'Contaminated N95 Respirator', category: 'yellow', confidence: 0.91, wardId: 'ward-2' },
    { itemLabel: 'Ampoule Glass Fragment', category: 'blue', confidence: 0.88, wardId: 'ward-3' },
    { itemLabel: 'Blood Cotton Dressing', category: 'yellow', confidence: 0.95, wardId: 'ward-1' },
    { itemLabel: 'Surgical Scalpel Blade', category: 'white', confidence: 0.97, wardId: 'ward-2' }
  ];

  sampleItems.forEach((it, idx) => {
    initialEvents.push({
      id: `ev-seed-${idx + 1}`,
      itemLabel: it.itemLabel,
      category: it.category,
      confidence: it.confidence,
      wasEdited: false,
      originalCategory: null,
      wardId: it.wardId,
      userId: 'nurse-priya',
      createdAt: new Date(now - (idx * 22 + 8) * 60 * 1000).toISOString(),
      ruleCitation: 'CPCB 2016 Schedule I'
    });
  });

  setLocalBins(initialBins);
  setLocalTasks(initialTasks);
  setLocalEvents(initialEvents);

  // If Firebase is configured, seed cloud as well
  if (isFirebaseAvailable()) {
    try {
      const snap = await getDocs(collection(db, 'bins'));
      if (snap.empty) {
        const batch = writeBatch(db);
        initialBins.forEach(b => {
          const ref = doc(db, 'bins', b.id);
          batch.set(ref, { ...b, createdAt: Timestamp.now() });
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn('Cloud Firestore seed skipped (using Local Real-Time Bus):', e);
    }
  }
}

// ── Waste Events API ──
export async function addWasteEvent(eventData) {
  const eventId = `ev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const fullEvent = {
    id: eventId,
    ...eventData,
    createdAt: new Date().toISOString()
  };

  // 1. Always update Local Storage & notify instant bus immediately
  const current = getLocalEvents();
  setLocalEvents([fullEvent, ...current]);

  // 2. Increment matching bin fill level automatically
  await updateBinFill(eventData.category, eventData.wardId || 'ward-1', 12);

  // 3. Fire-and-forget Cloud Firestore write if available
  if (isFirebaseAvailable()) {
    try {
      Promise.race([
        addDoc(collection(db, 'wasteEvents'), {
          ...eventData,
          createdAt: Timestamp.now()
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
      ]).catch(e => console.warn('Cloud sync background note:', e.message));
    } catch (e) {
      console.warn('Cloud write skipped:', e);
    }
  }

  return eventId;
}

export function subscribeToWasteEvents(wardId, callback) {
  // Synchronous immediate dispatch from local store
  const unsubLocal = attachLocalEventsListener(wardId, callback);

  if (isFirebaseAvailable()) {
    try {
      let q = wardId
        ? query(collection(db, 'wasteEvents'), where('wardId', '==', wardId), orderBy('createdAt', 'desc'), limit(50))
        : query(collection(db, 'wasteEvents'), orderBy('createdAt', 'desc'), limit(50));
      
      const unsubCloud = onSnapshot(q, (snapshot) => {
        if (snapshot && !snapshot.empty) {
          const events = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          callback(events);
        }
      }, (_err) => {
        // Ignored, local listener is already active
      });

      return () => {
        unsubLocal();
        try { unsubCloud(); } catch {}
      };
    } catch (_e) {
      return unsubLocal;
    }
  }
  return unsubLocal;
}

function attachLocalEventsListener(wardId, callback) {
  const handler = (allEvents) => {
    const filtered = wardId ? allEvents.filter(e => e.wardId === wardId) : allEvents;
    callback(filtered);
  };
  listeners.events.add(handler);
  // Fire immediately and synchronously
  handler(getLocalEvents());
  return () => {
    listeners.events.delete(handler);
  };
}

// ── Collection Tasks API ──
export async function requestPickup(category, wardId, reason = 'Staff manual request') {
  const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const binId = `bin-${category}-${wardId}`;
  const now = Date.now();

  const newTask = {
    id: taskId,
    binId,
    wardId,
    wardName: HOSPITAL_WARDS[wardId]?.name || wardId,
    category,
    status: 'pending',
    urgency: 'HIGH',
    reason,
    requestedAt: new Date(now).toISOString(),
    slaDeadline: now + (48 * 3600 * 1000),
    completedAt: null,
    assignedTo: 'On-Duty Porter'
  };

  // Local sync immediate
  const current = getLocalTasks();
  setLocalTasks([newTask, ...current.filter(t => t.binId !== binId || t.status !== 'pending')]);

  // Non-blocking cloud write
  if (isFirebaseAvailable()) {
    try {
      Promise.race([
        addDoc(collection(db, 'collectionTasks'), {
          ...newTask,
          requestedAt: Timestamp.now()
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
      ]).catch(() => {});
    } catch (e) {
      console.warn('Cloud task write skipped:', e);
    }
  }

  return taskId;
}

export function subscribeToCollectionTasks(callback) {
  const unsubLocal = attachLocalTasksListener(true, callback);

  if (isFirebaseAvailable()) {
    try {
      const q = query(collection(db, 'collectionTasks'), where('status', '==', 'pending'), orderBy('requestedAt', 'desc'));
      const unsubCloud = onSnapshot(q, (snapshot) => {
        if (snapshot && !snapshot.empty) {
          const tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          callback(tasks);
        }
      }, () => {});

      return () => {
        unsubLocal();
        try { unsubCloud(); } catch {}
      };
    } catch (_e) {
      return unsubLocal;
    }
  }
  return unsubLocal;
}

export function subscribeToAllCollectionTasks(callback) {
  const unsubLocal = attachLocalTasksListener(false, callback);

  if (isFirebaseAvailable()) {
    try {
      const q = query(collection(db, 'collectionTasks'), orderBy('requestedAt', 'desc'), limit(50));
      const unsubCloud = onSnapshot(q, (snapshot) => {
        if (snapshot && !snapshot.empty) {
          const tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          callback(tasks);
        }
      }, () => {});

      return () => {
        unsubLocal();
        try { unsubCloud(); } catch {}
      };
    } catch (_e) {
      return unsubLocal;
    }
  }
  return unsubLocal;
}

function attachLocalTasksListener(pendingOnly, callback) {
  const handler = (allTasks) => {
    const list = pendingOnly ? allTasks.filter(t => t.status === 'pending') : allTasks;
    callback(list);
  };
  listeners.tasks.add(handler);
  handler(getLocalTasks());
  return () => {
    listeners.tasks.delete(handler);
  };
}

export async function markTaskCollected(taskId) {
  const tasks = getLocalTasks();
  const targetTask = tasks.find(t => t.id === taskId);
  
  const updatedTasks = tasks.map(t => {
    if (t.id === taskId) {
      return { ...t, status: 'collected', completedAt: new Date().toISOString() };
    }
    return t;
  });
  setLocalTasks(updatedTasks);

  // Reset matching bin fill percent to 0 and restart 48-hr SLA clock
  if (targetTask && targetTask.wardId && targetTask.category) {
    const bins = getLocalBins();
    const updatedBins = bins.map(b => {
      if (b.wardId === targetTask.wardId && b.category === targetTask.category) {
        const now = Date.now();
        return {
          ...b,
          fillPercent: 0,
          lastEmptiedAt: now,
          slaStartedAt: now,
          slaDeadline: now + (48 * 3600 * 1000)
        };
      }
      return b;
    });
    setLocalBins(updatedBins);
  }

  // Non-blocking fire-and-forget update
  if (isFirebaseAvailable()) {
    try {
      const ref = doc(db, 'collectionTasks', taskId);
      Promise.race([
        updateDoc(ref, {
          status: 'collected',
          completedAt: Timestamp.now()
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
      ]).catch(() => {});
    } catch (e) {
      console.warn('Cloud update skipped:', e);
    }
  }
}

/**
 * Reset a specific bin to 0% fill and clear its active pending tasks
 */
export async function markBinCollected(binId) {
  const now = Date.now();
  const bins = getLocalBins();
  const targetBin = bins.find(b => b.id === binId);

  const updatedBins = bins.map(b => {
    if (b.id === binId) {
      return {
        ...b,
        fillPercent: 0,
        lastEmptiedAt: now,
        slaStartedAt: now,
        slaDeadline: now + (48 * 3600 * 1000)
      };
    }
    return b;
  });
  setLocalBins(updatedBins);

  // Also resolve any pending collection tasks for this bin
  const tasks = getLocalTasks();
  const updatedTasks = tasks.map(t => {
    if (t.binId === binId || (targetBin && t.wardId === targetBin.wardId && t.category === targetBin.category)) {
      return { ...t, status: 'collected', completedAt: new Date().toISOString() };
    }
    return t;
  });
  setLocalTasks(updatedTasks);
}

/**
 * Reset all 4 statutory bins for an entire ward and clear all pending ward tasks
 */
export async function markWardCollected(wardId) {
  const now = Date.now();
  const bins = getLocalBins();

  const updatedBins = bins.map(b => {
    if (b.wardId === wardId) {
      return {
        ...b,
        fillPercent: 0,
        lastEmptiedAt: now,
        slaStartedAt: now,
        slaDeadline: now + (48 * 3600 * 1000)
      };
    }
    return b;
  });
  setLocalBins(updatedBins);

  // Clear all pending tasks in this ward
  const tasks = getLocalTasks();
  const updatedTasks = tasks.map(t => {
    if (t.wardId === wardId && t.status === 'pending') {
      return { ...t, status: 'collected', completedAt: new Date().toISOString() };
    }
    return t;
  });
  setLocalTasks(updatedTasks);
}

// ── Bins Management API ──
export function subscribeToBins(callback) {
  const unsubLocal = attachLocalBinsListener(callback);

  if (isFirebaseAvailable()) {
    try {
      const q = query(collection(db, 'bins'));
      const unsubCloud = onSnapshot(q, (snapshot) => {
        if (snapshot && !snapshot.empty) {
          const bins = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          callback(bins);
        }
      }, () => {});

      return () => {
        unsubLocal();
        try { unsubCloud(); } catch {}
      };
    } catch (_e) {
      return unsubLocal;
    }
  }
  return unsubLocal;
}

function attachLocalBinsListener(callback) {
  const handler = (allBins) => {
    callback(allBins);
  };
  listeners.bins.add(handler);
  handler(getLocalBins());
  return () => {
    listeners.bins.delete(handler);
  };
}

export async function updateBinFill(category, wardId, incrementBy = 15) {
  const bins = getLocalBins();
  let needTask = false;
  let targetBin = null;

  const updatedBins = bins.map(b => {
    if (b.wardId === wardId && b.category === category) {
      const currentFill = b.fillPercent || 0;
      const newFill = Math.min(100, currentFill + incrementBy);
      if (newFill >= 80 && currentFill < 80) {
        needTask = true;
      }
      targetBin = { ...b, fillPercent: newFill, lastUpdated: Date.now() };
      return targetBin;
    }
    return b;
  });

  setLocalBins(updatedBins);

  if (needTask && targetBin) {
    await requestPickup(category, wardId, `Automated Threshold: Fill reached ${targetBin.fillPercent}%`);
  }
}

// ── Utility: 48-Hour SLA Calculation Helper ──
export function calculateSlaStatus(deadlineMs) {
  if (!deadlineMs) return { hoursLeft: 48, status: 'NORMAL', text: '48h remaining' };
  
  const now = Date.now();
  const diffMs = deadlineMs - now;
  const hours = Math.floor(diffMs / (3600 * 1000));
  const minutes = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));

  if (diffMs <= 0) {
    return { hoursLeft: 0, status: 'BREACH', text: 'CRITICAL: SLA VIOLATED (>48h)' };
  }
  if (hours < 6) {
    return { hoursLeft: hours, status: 'CRITICAL', text: `${hours}h ${minutes}m left (Urgent)` };
  }
  if (hours < 24) {
    return { hoursLeft: hours, status: 'WARNING', text: `${hours}h ${minutes}m left` };
  }
  return { hoursLeft: hours, status: 'NORMAL', text: `${hours}h ${minutes}m left` };
}
