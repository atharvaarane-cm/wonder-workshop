// Persistence router — picks the storage backend and re-exports a single, stable
// interface so the rest of the app (Workshop.jsx, App.jsx) never has to know
// which one is active.
//
//   local  — browser-only (localStorage + IndexedDB). The default; prod-safe.
//   cloud  — shared Supabase (workshop_projects + the images bucket).
//
// Cloud turns on only when (a) Supabase keys are configured AND (b) it's opted in
// via VITE_STORAGE=cloud (build) or ?storage=cloud (runtime, for testing). So
// production stays on local until we deliberately flip it.
import * as local from "./localPersistence.js";
import * as cloud from "./cloudPersistence.js";
import { hasSupabase } from "./supabaseClient.js";

export const STORAGE_MODE = (() => {
  if (!hasSupabase) return "local";
  const flag = import.meta.env.VITE_STORAGE;
  const qs =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("storage")
      : null;
  return flag === "cloud" || qs === "cloud" ? "cloud" : "local";
})();

const impl = STORAGE_MODE === "cloud" ? cloud : local;

export const newProjectId = impl.newProjectId;
export const listProjects = impl.listProjects;
export const refreshProjects = impl.refreshProjects;
export const loadProject = impl.loadProject;
export const loadProjectAsync = impl.loadProjectAsync;
export const saveProject = impl.saveProject;
export const saveProjectAsync = impl.saveProjectAsync;
export const saveProjectSync = impl.saveProjectSync;
export const deleteProject = impl.deleteProject;
export const renameProject = impl.renameProject;
export const setProjectFolder = impl.setProjectFolder;
export const getActiveProjectId = impl.getActiveProjectId;
export const setActiveProjectId = impl.setActiveProjectId;
export const listFolders = impl.listFolders;
export const createFolder = impl.createFolder;
export const deleteFolder = impl.deleteFolder;
export const renameFolder = impl.renameFolder;
export const purgeLegacyV1Storage = impl.purgeLegacyV1Storage;
