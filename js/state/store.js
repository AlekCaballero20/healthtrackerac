import { SEED_DATA } from "../data/seed.js";

const listeners = new Set();
const TOAST_DURATION = 2800;

let toastTimer = null;

function clone(value) {
  return structuredClone(value);
}

function createEmptyData() {
  return {
    profiles: [],
    bodyStatusEntries: [],
    symptoms: [],
    appointments: [],
    checkups: [],
    treatments: [],
    notes: []
  };
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeDataShape(data = {}) {
  return {
    profiles: normalizeArray(data.profiles),
    bodyStatusEntries: normalizeArray(data.bodyStatusEntries),
    symptoms: normalizeArray(data.symptoms),
    appointments: normalizeArray(data.appointments),
    checkups: normalizeArray(data.checkups),
    treatments: normalizeArray(data.treatments),
    notes: normalizeArray(data.notes)
  };
}

function createInitialState() {
  return {
    activeView: "dashboard",
    selectedProfileId: "all",
    timelineSearch: "",
    timelineType: "all",
    toast: null,

    auth: {
      isReady: false,
      isAuthenticated: false,
      isAllowed: false,
      user: null
    },

    app: {
      isBooting: true,
      isDataLoading: false,
      isDataReady: false,
      dataError: null,
      lastHydratedAt: null
    },

    data: createEmptyData()
  };
}

const state = createInitialState();

export function getState() {
  return state;
}

export function subscribe(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((listener) => listener(state));
}

function ensureSelectedProfileExists() {
  if (state.selectedProfileId === "all") return;

  const exists = state.data.profiles.some((profile) => profile.id === state.selectedProfileId);
  if (!exists) {
    state.selectedProfileId = "all";
  }
}

function touchHydrationMeta() {
  state.app.lastHydratedAt = new Date().toISOString();
}

function normalizeUser(user) {
  if (!user) return null;

  return {
    uid: user.uid ?? null,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null
  };
}

export function setBooting(isBooting) {
  state.app.isBooting = Boolean(isBooting);
  notify();
}

export function setAuthState({ user = null, isReady = true, isAllowed = false } = {}) {
  const normalizedUser = normalizeUser(user);

  state.auth = {
    isReady: Boolean(isReady),
    isAuthenticated: Boolean(normalizedUser),
    isAllowed: Boolean(normalizedUser && isAllowed),
    user: normalizedUser
  };

  notify();
}

export function clearAuthState() {
  state.auth = {
    isReady: true,
    isAuthenticated: false,
    isAllowed: false,
    user: null
  };

  notify();
}

export function setDataLoading(isLoading) {
  state.app.isDataLoading = Boolean(isLoading);

  if (isLoading) {
    state.app.dataError = null;
  }

  notify();
}

export function setDataError(error) {
  state.app.dataError = error ?? null;
  state.app.isDataLoading = false;
  notify();
}

export function setActiveView(view) {
  if (typeof view !== "string" || !view.trim()) return;
  state.activeView = view;
  notify();
}

export function setSelectedProfile(profileId) {
  if (typeof profileId !== "string" || !profileId.trim()) return;
  state.selectedProfileId = profileId;
  notify();
}

export function setTimelineFilters({ search, type } = {}) {
  if (typeof search === "string") state.timelineSearch = search;
  if (typeof type === "string") state.timelineType = type;
  notify();
}

export function hydrateData(data) {
  state.data = normalizeDataShape(data);
  state.app.isDataReady = true;
  state.app.isDataLoading = false;
  state.app.dataError = null;
  touchHydrationMeta();
  ensureSelectedProfileExists();
  notify();
}

export function replaceData(data) {
  state.data = normalizeDataShape(data);
  state.app.isDataReady = true;
  state.app.isDataLoading = false;
  state.app.dataError = null;
  touchHydrationMeta();
  ensureSelectedProfileExists();
  notify();
}

export function mutateData(mutator) {
  if (typeof mutator !== "function") {
    return state.data;
  }

  const draft = clone(state.data);
  const result = mutator(draft);
  const nextData = result ?? draft;

  state.data = normalizeDataShape(nextData);
  state.app.isDataReady = true;
  state.app.isDataLoading = false;
  state.app.dataError = null;
  touchHydrationMeta();
  ensureSelectedProfileExists();
  notify();

  return state.data;
}

export function clearData() {
  state.data = createEmptyData();
  state.app.isDataLoading = false;
  state.app.isDataReady = false;
  state.app.dataError = null;
  state.app.lastHydratedAt = null;
  state.selectedProfileId = "all";
  notify();
}

export function restoreSeedData() {
  state.data = clone(SEED_DATA);
  state.app.isDataReady = true;
  state.app.isDataLoading = false;
  state.app.dataError = null;
  touchHydrationMeta();
  ensureSelectedProfileExists();
  notify();
}

export function resetUiState() {
  state.activeView = "dashboard";
  state.selectedProfileId = "all";
  state.timelineSearch = "";
  state.timelineType = "all";
  notify();
}

export function resetStore({ keepAuth = true } = {}) {
  const next = createInitialState();

  if (keepAuth) {
    next.auth = clone(state.auth);
  }

  state.activeView = next.activeView;
  state.selectedProfileId = next.selectedProfileId;
  state.timelineSearch = next.timelineSearch;
  state.timelineType = next.timelineType;
  state.toast = next.toast;
  state.auth = next.auth;
  state.app = next.app;
  state.data = next.data;

  window.clearTimeout(toastTimer);
  toastTimer = null;

  notify();
}

export function setToast(toast) {
  state.toast = toast ?? null;
  notify();

  window.clearTimeout(toastTimer);
  toastTimer = null;

  if (toast) {
    toastTimer = window.setTimeout(() => {
      state.toast = null;
      notify();
    }, TOAST_DURATION);
  }
}