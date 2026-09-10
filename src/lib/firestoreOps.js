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
const BUS_CHANNEL = 'segreguard-realtime-bus-v3';
let localBus = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    localBus = new BroadcastChannel(BUS_CHANNEL);
  } catch (e) {
    console.warn('BroadcastChannel not supported:', e);
  }
}

const STORAGE_KEYS = {
  EVENTS: 'segreguard_waste_events_v3',
  TASKS: 'segreguard_collection_tasks_v3',
  BINS: 'segreguard_bins_v3',
  REQUESTS: 'segreguard_pickup_requests_v3'
};

const listeners = {
  events: new Set(),
  tasks: new Set(),
  bins: new Set(),
  requests: new Set()
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
  if (type === 'requests' || !type) {
    const rqs = getLocalRequests();
    listeners.requests.forEach(cb => {
      try { cb(rqs); } catch (e) { console.error(e); }
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
export function getLocalRequests() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REQUESTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setLocalRequests(items) {
  localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(items));
  broadcast('requests');
}

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

// ── Multi-Hospital Metropolitan Network Metadata ──
export const HOSPITALS = {
  'hosp-apex': {
    id: 'hosp-apex',
    name: 'Apex Memorial City Hospital',
    shortName: 'Apex Memorial',
    cityZone: 'Central Health Corridor (Zone 1)',
    address: 'Sector 4, Central Health Corridor, Metro District',
    bedCount: 450,
    coords: { x: 30, y: 38 }, // for city map
    distanceFromHubKm: 4.8,
    phone: '+91 80 4123 9000',
    primaryColor: '#38bdf8',
    wards: {
      'ward-1': { 
        id: 'ward-1', 
        name: 'ICU-3 (Critical Care)', 
        floor: '3rd Floor, Block B', 
        bedCount: 24, 
        coords: { x: 32, y: 38 },
        rooms: ['Room 301 (Isolation)', 'Room 302 (Ventilator Bay)', 'Room 304 (Post-Op)']
      },
      'ward-2': { 
        id: 'ward-2', 
        name: 'OT-2 (Surgical Theatre)', 
        floor: '2nd Floor, Block A', 
        bedCount: 6, 
        coords: { x: 74, y: 28 },
        rooms: ['OT Suite 2A (Cardiac)', 'OT Suite 2B (Neuro)', 'Recovery Bay 1']
      },
      'ward-3': { 
        id: 'ward-3', 
        name: 'Trauma & Emergency', 
        floor: 'Ground Floor, Main Hub', 
        bedCount: 30, 
        coords: { x: 25, y: 72 },
        rooms: ['Triage Bay 1', 'Resuscitation Unit', 'Minor Procedure OT']
      },
      'ward-4': { 
        id: 'ward-4', 
        name: 'General Inpatient A', 
        floor: '1st Floor, Block C', 
        bedCount: 45, 
        coords: { x: 68, y: 76 },
        rooms: ['Room 101-104', 'Room 105-108', 'Step-Down Ward']
      }
    }
  },
  'hosp-metro': {
    id: 'hosp-metro',
    name: 'Metro Care Multi-Speciality',
    shortName: 'Metro Care',
    cityZone: 'West Ring Road (Zone 2)',
    address: 'Plot 12, West Expressway Hub',
    bedCount: 320,
    coords: { x: 72, y: 24 },
    distanceFromHubKm: 8.2,
    phone: '+91 80 2990 4455',
    primaryColor: '#a855f7',
    wards: {
      'ward-m1': { 
        id: 'ward-m1', 
        name: 'Oncology-1', 
        floor: '4th Floor, Block W', 
        bedCount: 35, 
        rooms: ['Chemo Daycare Room 401', 'Bone Marrow Isolation'] 
      },
      'ward-m2': { 
        id: 'ward-m2', 
        name: 'Maternity & Neonatal', 
        floor: '2nd Floor, Block W', 
        bedCount: 28, 
        rooms: ['Labour Suite 1', 'NICU Neonatal Bay'] 
      }
    }
  },
  'hosp-city': {
    id: 'hosp-city',
    name: 'St. Jude Regional Healthcare',
    shortName: 'St. Jude',
    cityZone: 'East Bypass (Zone 4)',
    address: '88 Healthcare Avenue, East Corridor',
    bedCount: 280,
    coords: { x: 82, y: 68 },
    distanceFromHubKm: 12.5,
    phone: '+91 80 3456 7788',
    primaryColor: '#f59e0b',
    wards: {
      'ward-j1': { 
        id: 'ward-j1', 
        name: 'Pediatric ICU', 
        floor: '3rd Floor, East Wing', 
        bedCount: 20, 
        rooms: ['PICU Bed 1-6', 'Pediatric Isolation'] 
      },
      'ward-j2': { 
        id: 'ward-j2', 
        name: 'Renal Dialysis Unit', 
        floor: '1st Floor, East Wing', 
        bedCount: 16, 
        rooms: ['Dialysis Station A', 'Dialysis Station B'] 
      }
    }
  }
};

// Regional CBWTF Central Facility
export const CBWTF_FACILITY = {
  id: 'cbwtf-hub',
  name: 'Central Bio-Medical Waste Treatment Facility (CBWTF Hub)',
  shortName: 'CBWTF Hub',
  cityZone: 'Industrial Disposal Eco-Park (Sector 9)',
  address: 'Zone 9 Eco-Park Facility, South Logistics Gate',
  coords: { x: 18, y: 82 },
  treatmentTypes: ['High-Temp Incineration (1100°C)', 'Autoclaving', 'Hydroclaving', 'Automated Shredding']
};

// Backward-compatibility alias for Apex Memorial hospital wards
export const HOSPITAL_WARDS = HOSPITALS['hosp-apex'].wards;

// ── Seed Default Realistic Hospital Data ──
export async function seedData() {
  const existingBins = getLocalBins();
  const existingReqs = getLocalRequests();

  // If already initialized with requests, exit
  if (existingBins && existingBins.length > 0 && existingReqs && existingReqs.length > 0) return;

  const now = Date.now();
  const initialBins = [];
  const initialTasks = [];
  const initialEvents = [];
  const initialRequests = [];

  const categories = ['yellow', 'red', 'white', 'blue'];
  const wards = ['ward-1', 'ward-2', 'ward-3', 'ward-4'];

  wards.forEach((wardId, wIdx) => {
    categories.forEach((cat, cIdx) => {
      const slaAgeHours = (wIdx * 11 + cIdx * 7) % 44;
      const slaStartedAt = now - (slaAgeHours * 3600 * 1000);
      const slaDeadline = slaStartedAt + (48 * 3600 * 1000);
      
      const fill = (wIdx === 0 && cat === 'red') ? 86 :
                   (wIdx === 1 && cat === 'yellow') ? 92 :
                   Math.floor(15 + Math.random() * 45);

      const binId = `bin-${cat}-${wardId}`;
      initialBins.push({
        id: binId,
        hospitalId: 'hosp-apex',
        wardId,
        category: cat,
        fillPercent: fill,
        barcodeId: `BIN-${cat.toUpperCase()}-${wardId.toUpperCase()}`,
        slaStartedAt,
        slaDeadline,
        lastEmptiedAt: slaStartedAt
      });
    });
  });

  // Historical scan events with room specificity
  const sampleItems = [
    { itemLabel: 'Disposable Syringe w/o Needle', category: 'red', confidence: 0.94, wardId: 'ward-1', room: 'Room 302 (Ventilator Bay)' },
    { itemLabel: 'Contaminated N95 Respirator', category: 'yellow', confidence: 0.91, wardId: 'ward-2', room: 'OT Suite 2A (Cardiac)' },
    { itemLabel: 'Ampoule Glass Fragment', category: 'blue', confidence: 0.88, wardId: 'ward-3', room: 'Triage Bay 1' },
    { itemLabel: 'Blood Cotton Dressing', category: 'yellow', confidence: 0.95, wardId: 'ward-1', room: 'Room 301 (Isolation)' },
    { itemLabel: 'Surgical Scalpel Blade', category: 'white', confidence: 0.97, wardId: 'ward-2', room: 'OT Suite 2B (Neuro)' },
    { itemLabel: 'Contaminated IV Infusion Set', category: 'red', confidence: 0.93, wardId: 'ward-4', room: 'Room 102' }
  ];

  sampleItems.forEach((it, idx) => {
    initialEvents.push({
      id: `ev-seed-${idx + 1}`,
      hospitalId: 'hosp-apex',
      itemLabel: it.itemLabel,
      category: it.category,
      confidence: it.confidence,
      wasEdited: false,
      originalCategory: null,
      wardId: it.wardId,
      room: it.room,
      userId: idx % 2 === 0 ? 'Nurse Priya' : 'Staff Rahul',
      createdAt: new Date(now - (idx * 22 + 8) * 60 * 1000).toISOString(),
      ruleCitation: 'CPCB 2016 Schedule I'
    });
  });

  // Seed Multi-Hospital Pickup Requests
  // 1. Apex Memorial: Incoming Nurse Request awaiting Admin dispatch
  initialRequests.push({
    id: 'req-apex-01',
    hospitalId: 'hosp-apex',
    hospitalName: 'Apex Memorial City Hospital',
    hospitalShortName: 'Apex Memorial',
    hospitalAddress: 'Sector 4, Central Health Corridor',
    hospitalCoords: { x: 30, y: 38 },
    wardId: 'ward-1',
    wardName: 'ICU-3 (Critical Care)',
    room: 'Room 302 (Ventilator Bay)',
    status: 'nurse_pending',
    urgency: 'CRITICAL',
    reason: 'Nurse Priya: Red contaminated sharps & plastic bin reached 86% capacity threshold',
    estimatedBags: 7,
    estimatedWeightKg: 19.5,
    criticalBins: [
      { category: 'red', fillPercent: 86, label: 'Red (Contaminated Plastics)' },
      { category: 'yellow', fillPercent: 65, label: 'Yellow (Infectious Anatomical)' }
    ],
    requestedBy: 'Nurse Priya (ICU-3)',
    requestedAt: new Date(now - 14 * 60 * 1000).toISOString(),
    approvedByAdminAt: null,
    acceptedByDriverAt: null,
    completedAt: null,
    driverId: null
  });

  // 2. Metro Care Multi-Speciality: Dispatched by Admin, awaiting Logistics Acceptance
  initialRequests.push({
    id: 'req-metro-02',
    hospitalId: 'hosp-metro',
    hospitalName: 'Metro Care Multi-Speciality',
    hospitalShortName: 'Metro Care',
    hospitalAddress: 'Plot 12, West Expressway Hub',
    hospitalCoords: { x: 72, y: 24 },
    wardId: 'ward-m1',
    wardName: 'Oncology-1 & Maternity',
    room: 'Chemo Daycare Suite 401',
    status: 'logistics_pending',
    urgency: 'HIGH',
    reason: 'Hospital Admin: Chemotherapy cytotoxic vials and anatomical bags scheduled transit',
    estimatedBags: 11,
    estimatedWeightKg: 28.0,
    criticalBins: [
      { category: 'yellow', fillPercent: 88, label: 'Yellow (Cytotoxic / Anatomical)' },
      { category: 'red', fillPercent: 74, label: 'Red (Tubing & Infusers)' }
    ],
    requestedBy: 'Admin Dr. Verma (Metro Care)',
    requestedAt: new Date(now - 38 * 60 * 1000).toISOString(),
    approvedByAdminAt: new Date(now - 30 * 60 * 1000).toISOString(),
    acceptedByDriverAt: null,
    completedAt: null,
    driverId: null
  });

  // 3. St. Jude Regional Healthcare: Accepted by Logistics & currently in Smart Route!
  initialRequests.push({
    id: 'req-jude-03',
    hospitalId: 'hosp-city',
    hospitalName: 'St. Jude Regional Healthcare',
    hospitalShortName: 'St. Jude',
    hospitalAddress: '88 Healthcare Avenue, East Corridor',
    hospitalCoords: { x: 82, y: 68 },
    wardId: 'ward-j1',
    wardName: 'Pediatric ICU & Dialysis',
    room: 'Dialysis Station A',
    status: 'accepted',
    urgency: 'NORMAL',
    reason: 'Dialyzer tubings, syringes, and glass ampoules batch clearance',
    estimatedBags: 5,
    estimatedWeightKg: 14.2,
    criticalBins: [
      { category: 'red', fillPercent: 68, label: 'Red (Dialysis Tubing)' },
      { category: 'blue', fillPercent: 62, label: 'Blue (Glass Ampoules)' }
    ],
    requestedBy: 'Admin Sister Mary (St. Jude)',
    requestedAt: new Date(now - 60 * 60 * 1000).toISOString(),
    approvedByAdminAt: new Date(now - 50 * 60 * 1000).toISOString(),
    acceptedByDriverAt: new Date(now - 20 * 60 * 1000).toISOString(),
    completedAt: null,
    driverId: 'CBWTF-Fleet-Alpha'
  });

  setLocalBins(initialBins);
  setLocalTasks(initialTasks);
  setLocalEvents(initialEvents);
  setLocalRequests(initialRequests);
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

// ── Multi-Hospital Pickup Requests API ──

/**
 * Nurse / Ward Worker initiates a pickup request to Hospital Admin
 */
export async function requestPickupFromNurse({ 
  hospitalId = 'hosp-apex', 
  wardId = 'ward-1', 
  room = 'Room 302 (Ventilator Bay)', 
  reason = 'Nurse request: Ward bins near capacity threshold',
  nurseName = 'Nurse Priya'
}) {
  const reqId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const hospital = HOSPITALS[hospitalId] || HOSPITALS['hosp-apex'];
  const ward = hospital.wards[wardId] || hospital.wards['ward-1'];

  // Identify current high-fill bins in this ward
  const bins = getLocalBins().filter(b => b.wardId === wardId);
  const criticalBins = bins.map(b => ({
    category: b.category,
    fillPercent: b.fillPercent || 0,
    label: b.category.toUpperCase()
  })).sort((a, b) => b.fillPercent - a.fillPercent);

  const highestFill = criticalBins[0]?.fillPercent || 60;
  const urgency = highestFill >= 85 ? 'CRITICAL' : highestFill >= 70 ? 'HIGH' : 'NORMAL';

  const newRequest = {
    id: reqId,
    hospitalId,
    hospitalName: hospital.name,
    hospitalShortName: hospital.shortName,
    hospitalAddress: hospital.address,
    hospitalCoords: hospital.coords,
    wardId,
    wardName: ward.name,
    room,
    status: 'nurse_pending', // Nurse -> Admin
    urgency,
    reason: `${nurseName}: ${reason}`,
    estimatedBags: Math.max(3, Math.round(highestFill / 12)),
    estimatedWeightKg: Number((Math.max(8, (highestFill / 10) * 2.5)).toFixed(1)),
    criticalBins,
    requestedBy: `${nurseName} (${ward.name})`,
    requestedAt: new Date().toISOString(),
    approvedByAdminAt: null,
    acceptedByDriverAt: null,
    completedAt: null,
    driverId: null
  };

  const requests = getLocalRequests();
  setLocalRequests([newRequest, ...requests]);
  return reqId;
}

/**
 * Hospital Admin approves the nurse request and forwards/dispatches to Logistics
 */
export async function approveAndDispatchToLogistics(requestId, adminNotes = '') {
  const requests = getLocalRequests();
  const updated = requests.map(r => {
    if (r.id === requestId) {
      return {
        ...r,
        status: 'logistics_pending', // Admin -> Logistics
        approvedByAdminAt: new Date().toISOString(),
        adminNotes: adminNotes || 'Approved by Infection Control Admin for immediate CBWTF collection'
      };
    }
    return r;
  });
  setLocalRequests(updated);
}

/**
 * Hospital Admin directly creates a pickup request for their hospital to Logistics
 */
export async function adminDirectRequest({
  hospitalId = 'hosp-apex',
  wardIds = ['ward-1', 'ward-2'],
  urgency = 'HIGH',
  reason = 'Admin scheduled multi-ward bio-medical collection'
}) {
  const reqId = `req-admin-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const hospital = HOSPITALS[hospitalId] || HOSPITALS['hosp-apex'];

  const allBins = getLocalBins();
  const wardNames = wardIds.map(wId => hospital.wards[wId]?.name || wId).join(', ');

  const criticalBins = allBins
    .filter(b => wardIds.includes(b.wardId))
    .map(b => ({
      category: b.category,
      fillPercent: b.fillPercent || 0,
      label: b.category.toUpperCase()
    }))
    .sort((a, b) => b.fillPercent - a.fillPercent)
    .slice(0, 4);

  const newRequest = {
    id: reqId,
    hospitalId,
    hospitalName: hospital.name,
    hospitalShortName: hospital.shortName,
    hospitalAddress: hospital.address,
    hospitalCoords: hospital.coords,
    wardId: wardIds[0] || 'all-wards',
    wardName: wardNames || 'Hospital Wards',
    room: 'Central Hospital Waste Staging Bay',
    status: 'logistics_pending',
    urgency,
    reason: `Hospital Admin: ${reason}`,
    estimatedBags: Math.max(6, wardIds.length * 4),
    estimatedWeightKg: Number((Math.max(16, wardIds.length * 9.5)).toFixed(1)),
    criticalBins,
    requestedBy: 'Infection Control Admin',
    requestedAt: new Date().toISOString(),
    approvedByAdminAt: new Date().toISOString(),
    acceptedByDriverAt: null,
    completedAt: null,
    driverId: null
  };

  const requests = getLocalRequests();
  setLocalRequests([newRequest, ...requests]);
  return reqId;
}

/**
 * Logistics Transporter reviews and accepts a pickup request from a hospital
 */
export async function acceptLogisticsRequest(requestId, driverId = 'CBWTF Fleet #3') {
  const requests = getLocalRequests();
  const updated = requests.map(r => {
    if (r.id === requestId) {
      return {
        ...r,
        status: 'accepted', // Assigned & on Smart Route
        acceptedByDriverAt: new Date().toISOString(),
        driverId
      };
    }
    return r;
  });
  setLocalRequests(updated);
}

/**
 * Logistics Transporter completes the pickup at the hospital:
 * - Marks request as completed
 * - Resets matching bins in that hospital to 0% fill
 * - Restarts the 48h statutory SLA clock
 */
export async function completeLogisticsRequest(requestId) {
  const requests = getLocalRequests();
  const targetReq = requests.find(r => r.id === requestId);

  const updated = requests.map(r => {
    if (r.id === requestId) {
      return {
        ...r,
        status: 'completed',
        completedAt: new Date().toISOString()
      };
    }
    return r;
  });
  setLocalRequests(updated);

  // Clear hospital bins
  if (targetReq) {
    const now = Date.now();
    const bins = getLocalBins();
    const updatedBins = bins.map(b => {
      // If request was for a specific ward or entire hospital
      if (b.wardId === targetReq.wardId || (!targetReq.wardId || targetReq.wardId === 'all-wards')) {
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
}

/**
 * Subscribe to all Multi-Hospital Pickup Requests
 */
export function subscribeToPickupRequests(callback) {
  const handler = (allReqs) => {
    callback(allReqs);
  };
  listeners.requests.add(handler);
  // Fire immediately
  handler(getLocalRequests());
  return () => {
    listeners.requests.delete(handler);
  };
}

/**
 * Subscribe to requests filtered by hospital (e.g. for Hospital Admin)
 */
export function subscribeToHospitalRequests(hospitalId, callback) {
  const handler = (allReqs) => {
    const filtered = hospitalId ? allReqs.filter(r => r.hospitalId === hospitalId) : allReqs;
    callback(filtered);
  };
  listeners.requests.add(handler);
  handler(getLocalRequests().filter(r => !hospitalId || r.hospitalId === hospitalId));
  return () => {
    listeners.requests.delete(handler);
  };
}

