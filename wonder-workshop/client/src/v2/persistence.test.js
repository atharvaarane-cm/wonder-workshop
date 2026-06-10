import { describe, it, expect, beforeEach } from "vitest";
import {
  newProjectId,
  listProjects,
  getActiveProjectId,
  setActiveProjectId,
  listFolders,
  createFolder,
  deleteFolder,
} from "./persistence.js";

// Characterization tests for the localStorage-backed surface of persistence
// (the metadata layer the sidebar renders from). The IndexedDB blob round-trip
// is covered separately once fake-indexeddb is wired; these guard the parts that
// run in jsdom today, so the upcoming Supabase swap can't silently change them.

beforeEach(() => {
  localStorage.clear();
});

describe("newProjectId", () => {
  it("is unique across calls and prefixed", () => {
    const a = newProjectId();
    const b = newProjectId();
    expect(a).not.toBe(b);
    expect(a.startsWith("p_")).toBe(true);
  });
});

describe("active project id", () => {
  it("round-trips and clears", () => {
    expect(getActiveProjectId()).toBe(null);
    setActiveProjectId("p_123");
    expect(getActiveProjectId()).toBe("p_123");
    setActiveProjectId(null);
    expect(getActiveProjectId()).toBe(null);
  });
});

describe("listProjects", () => {
  it("returns [] when nothing is stored", () => {
    expect(listProjects()).toEqual([]);
  });

  it("sorts most-recent first and de-dupes by id (self-heal a duplicate)", () => {
    localStorage.setItem(
      "ww_v2_projects",
      JSON.stringify([
        { id: "a", name: "A-old", updatedAt: 1 },
        { id: "a", name: "A-new", updatedAt: 5 },
        { id: "b", name: "B", updatedAt: 3 },
      ]),
    );
    const out = listProjects();
    expect(out.map(p => p.id)).toEqual(["a", "b"]);
    // keeps the most-recent entry for the duplicated id
    expect(out[0].name).toBe("A-new");
  });

  it("ignores malformed entries", () => {
    localStorage.setItem("ww_v2_projects", JSON.stringify("not-an-array"));
    expect(listProjects()).toEqual([]);
  });
});

describe("folders", () => {
  it("creates, lists (sorted), and is idempotent", () => {
    createFolder("Zeta");
    createFolder("Alpha");
    createFolder("Alpha"); // duplicate — no-op
    expect(listFolders()).toEqual(["Alpha", "Zeta"]);
  });

  it("rejects an empty name", () => {
    expect(createFolder("   ")).toBe(null);
    expect(listFolders()).toEqual([]);
  });

  it("deletes a folder", () => {
    createFolder("Temp");
    expect(listFolders()).toContain("Temp");
    deleteFolder("Temp");
    expect(listFolders()).not.toContain("Temp");
  });
});
