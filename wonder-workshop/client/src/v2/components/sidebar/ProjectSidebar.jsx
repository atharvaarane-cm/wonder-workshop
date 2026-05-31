import { useState, useEffect, useRef } from "react";
import { ChevronDownIcon, FilmIcon, FolderPlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Group, GroupSeparator } from "@/components/ui/group";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "@/components/ui/menu";
import { SectionIcon, WLogo, timeAgo, uiConfirm, toast } from "../../Workshop.jsx";

// -- PROJECT SIDEBAR (left rail, multi-project nav) -------------
// Persistent navigation between projects. Shown whether the user is
// on BriefForm (landing) or inside OneSheet. Click any project name
// to switch; the current project saves automatically before the
// switch so no work is lost.

const PROJECT_SECTION_TABS = [
  { key: "brand", label: "Brand", icon: "link" },
  { key: "talent", label: "Characters", icon: "users" },
  { key: "products", label: "Elements", icon: "box" },
  { key: "locations", label: "Locations", icon: "map" },
  { key: "mood", label: "Mood", icon: "image" },
];

export function ProjectSidebar({
  projects,
  folders = [],
  activeProjectId,
  onSwitch,
  onNew,
  onHome,
  onDelete,
  onRename,
  onMoveToFolder,
  onNewFolder,
  onDeleteFolder,
  mode = "root",
  activeProjectTitle = "",
  activeAssetTab = "brand",
  onAssetTabChange,
  onBackToProjects,
  assetCounts = {},
}) {
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [menuOpenId, setMenuOpenId] = useState(null);
  const renameInputRef = useRef(null);

  useEffect(() => {
    if (renamingId) {
      setTimeout(() => renameInputRef.current?.select(), 0);
    }
  }, [renamingId]);

  useEffect(() => {
    if (!menuOpenId) return;
    function onDoc(e) {
      if (!e.target.closest?.(".ww-proj-menu") && !e.target.closest?.(".ww-proj-more")) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpenId]);

  function commitRename() {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue("");
  }

  if (mode === "project") {
    return (
      <div style={{
        width: 256, flexShrink: 0,
        borderRight: "1px solid var(--warm-06)",
        background: "rgba(0,0,0,0.72)",
        display: "flex", flexDirection: "column",
        height: "100vh", overflow: "hidden",
      }}>
        <div style={{
          height: 64,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 18px",
        }}>
          <button
            type="button"
            onClick={onBackToProjects || onHome}
            title="Back to all projects"
            aria-label="Back to all projects"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "var(--warm-50)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              outline: "none",
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div
            title={activeProjectTitle || "Untitled"}
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: "var(--f)",
              fontSize: 16,
              fontWeight: 600,
              color: "var(--warm-50)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activeProjectTitle || "Untitled"}
          </div>
        </div>

        <nav aria-label="Project sections" style={{ padding: "22px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          {PROJECT_SECTION_TABS.map(tab => (
            <ProjectSectionRow
              key={tab.key}
              tab={tab}
              count={assetCounts[tab.key] ?? 0}
              isActive={activeAssetTab === tab.key}
              onClick={() => onAssetTabChange?.(tab.key)}
            />
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div style={{
      width: 256, flexShrink: 0,
      borderRight: "1px solid var(--warm-06)",
      background: "rgba(0,0,0,0.72)",
      display: "flex", flexDirection: "column",
      height: "100vh", overflow: "hidden",
    }}>
      <div style={{
        height: 64,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
      }}>
        <button
          aria-label="Wonder Workshop"
          onClick={onHome}
          title="Back to home"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            background: "transparent",
            border: "none",
            color: "var(--warm)",
            cursor: "pointer",
            outline: "none",
          }}
        >
          <WLogo color="var(--warm-50)" size={24} />
        </button>
        <button
          title="Collapse sidebar"
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            border: "1px solid var(--warm-15)",
            background: "transparent",
            color: "var(--warm-35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            outline: "none",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <rect x="3.25" y="2.75" width="9.5" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M6.25 3.25v9.5" stroke="currentColor" strokeWidth="1.4" opacity="0.65"/>
          </svg>
        </button>
      </div>

      <div style={{ padding: "18px 14px" }}>
        <Group
          aria-label="New storyboard actions"
          className="w-full overflow-hidden rounded-[10px]"
          style={{
            background: "var(--warm-06)",
            border: "1px solid var(--warm-08)",
            boxShadow: "rgba(0, 0, 0, 0.42) 0px 1px 2px 0px, rgba(255, 255, 255, 0.045) 0px 1px 0px 0px inset",
          }}
        >
          <Button
            className="flex-1"
            onClick={onNew}
            size="lg"
            style={{
              background: "transparent",
              border: "none",
              boxShadow: "none",
              color: "var(--warm)",
            }}
          >
            <FilmIcon
              aria-hidden="true"
              className="size-4 opacity-100"
              style={{ color: "var(--warm)", opacity: 1 }}
            />
            New Project
          </Button>
          <GroupSeparator style={{ background: "var(--warm-08)" }} />
          <Menu>
            <MenuTrigger
              render={
                <Button
                  aria-label="New storyboard options"
                  size="icon-lg"
                  style={{
                    background: "transparent",
                    border: "none",
                    boxShadow: "none",
                    color: "var(--warm)",
                  }}
                />
              }
            >
              <ChevronDownIcon
                aria-hidden="true"
                className="size-4 opacity-100"
                style={{ color: "var(--warm)", opacity: 1 }}
              />
            </MenuTrigger>
            <MenuPopup align="end">
              <MenuItem closeOnClick onClick={() => onNewFolder?.()}>
                <FolderPlusIcon aria-hidden="true" />
                New client folder
              </MenuItem>
            </MenuPopup>
          </Menu>
        </Group>
      </div>

      <div style={{ padding: "0 14px 6px" }}>
        <div style={{ fontFamily: "var(--f)", fontSize: 11, fontWeight: 500, color: "var(--warm-25)", letterSpacing: 0 }}>
          Projects · {projects.length}{folders.length ? ` · ${folders.length} client${folders.length === 1 ? "" : "s"}` : ""}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px 16px" }}>
        {projects.length === 0 ? (
          <div style={{ padding: "10px 6px", fontFamily: "var(--f)", fontSize: 11, color: "var(--warm-25)", lineHeight: 1.6 }}>
            No projects yet. Generate a brief to create one.
          </div>
        ) : (
          (() => {
            // Group: unfiled first, then each folder.
            const unfiled = projects.filter(p => !p.folder);
            const byFolder = new Map();
            for (const f of folders) byFolder.set(f, []);
            for (const p of projects) {
              if (!p.folder) continue;
              if (!byFolder.has(p.folder)) byFolder.set(p.folder, []);
              byFolder.get(p.folder).push(p);
            }
            const renderRow = (p, isNested = false) => (
              <ProjectRow
                key={p.id}
                project={p}
                isNested={isNested}
                isActive={p.id === activeProjectId}
                isRenaming={renamingId === p.id}
                renameValue={renameValue}
                renameInputRef={renameInputRef}
                setRenameValue={setRenameValue}
                setRenamingId={setRenamingId}
                commitRename={commitRename}
                menuOpenId={menuOpenId}
                setMenuOpenId={setMenuOpenId}
                folders={folders}
                onSwitch={onSwitch}
                onDelete={onDelete}
                onMoveToFolder={onMoveToFolder}
              />
            );
            return (
              <>
                <UnfiledDropZone onDropProject={pid => onMoveToFolder?.(pid, null)}>
                  {unfiled.map(renderRow)}
                </UnfiledDropZone>
                {[...byFolder.entries()].map(([fname, fprojects]) => (
                  <FolderGroup
                    key={fname}
                    name={fname}
                    projects={fprojects}
                    renderRow={renderRow}
                    onDeleteFolder={onDeleteFolder}
                    onDropProject={pid => onMoveToFolder?.(pid, fname)}
                  />
                ))}
              </>
            );
          })()
        )}
      </div>
    </div>
  );
}

function ProjectSectionRow({ tab, count, isActive, onClick }) {
  const [hovered, setHovered] = useState(false);
  const bg = isActive ? "var(--warm-08)" : hovered ? "var(--warm-04)" : "transparent";
  const accent = isActive ? "var(--warm)" : hovered ? "var(--warm-50)" : "var(--warm-30)";
  const iconColor = isActive ? "var(--warm)" : hovered ? "var(--warm-40)" : "var(--warm-25)";

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: "12px 14px",
        minHeight: 48,
        borderRadius: 12,
        cursor: "pointer",
        outline: "none",
        border: "none",
        fontFamily: "var(--f)",
        fontSize: 16,
        fontWeight: isActive ? 600 : 500,
        background: bg,
        color: accent,
        textAlign: "left",
        transition: "background 0.15s ease, color 0.15s ease",
      }}
    >
      <SectionIcon name={tab.icon} size={18} color={iconColor} />
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tab.label}</span>
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 24,
        height: 24,
        padding: "0 7px",
        borderRadius: 12,
        background: isActive ? "var(--warm-12)" : "var(--warm-06)",
        fontFamily: "var(--f)",
        fontSize: 12,
        fontWeight: 600,
        color: isActive ? "var(--warm-50)" : "var(--warm-25)",
        flexShrink: 0,
        lineHeight: 1,
      }}>{count}</span>
    </button>
  );
}

// Single project row — extracted so the same render works inside
// folder groups and the top-level unfiled list. Draggable: dragging
// onto a FolderDropZone or an Unfiled zone reassigns p.folder via
// onMoveToFolder.
function ProjectRow({ project: p, isNested = false, isActive, isRenaming, renameValue, renameInputRef, setRenameValue, setRenamingId, commitRename, menuOpenId, setMenuOpenId, folders, onSwitch, onDelete, onMoveToFolder }) {
  const [hovered, setHovered] = useState(false);
  const moreVisible = hovered || menuOpenId === p.id;

  return (
    <div
      draggable={!isRenaming}
      onDragStart={e => {
        if (isRenaming) return;
        e.dataTransfer.setData("application/x-ww-project-id", p.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      style={{
        display: "flex", alignItems: "center",
        padding: isNested ? "6px 8px 6px 24px" : "6px 8px", borderRadius: 6, marginBottom: 2,
        background: isActive ? "var(--warm-08)" : "transparent",
        cursor: isRenaming ? "default" : "grab",
        position: "relative",
      }}
    onClick={() => !isRenaming && onSwitch(p.id)}
    onMouseEnter={e => { setHovered(true); if (!isActive) e.currentTarget.style.background = "var(--warm-06)"; }}
    onMouseLeave={e => { setHovered(false); if (!isActive) e.currentTarget.style.background = "transparent"; }}
    onFocusCapture={() => setHovered(true)}
    onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setHovered(false); }}
    >
      <div style={{
        width: 6, height: 6, borderRadius: "50%",
        background: isActive ? "#7CFC9C" : "var(--warm-12)",
        marginRight: 8, flexShrink: 0,
      }} />
      {isRenaming ? (
        <input
          ref={renameInputRef}
          value={renameValue}
          onChange={e => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") { setRenamingId(null); setRenameValue(""); }
          }}
          onClick={e => e.stopPropagation()}
          style={{
            flex: 1, minWidth: 0,
            fontFamily: "var(--f)", fontSize: 12, fontWeight: 500,
            background: "var(--warm-04)", border: "1px solid var(--warm-12)",
            borderRadius: 4, padding: "3px 6px",
            color: "var(--warm)", outline: "none",
          }}
        />
      ) : (
        <span
          onDoubleClick={e => { e.stopPropagation(); setRenamingId(p.id); setRenameValue(p.name); }}
          title={`Double-click to rename · Updated ${timeAgo(p.updatedAt)}`}
          className="text-white/90"
          style={{
            flex: 1, fontFamily: "var(--f)", fontSize: 12,
            fontWeight: 500,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >{p.name || "Untitled"}</span>
      )}
      {!isRenaming && (
        <button
          className="ww-proj-more"
          onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpenId === p.id ? null : p.id); }}
          style={{
            width: 20, height: 20, borderRadius: 4,
            background: "transparent", border: "none", color: "var(--warm-30)",
            cursor: "pointer", outline: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, lineHeight: 1, flexShrink: 0,
            opacity: moreVisible ? 1 : 0,
            pointerEvents: moreVisible ? "auto" : "none",
            transition: "opacity 0.12s ease",
          }}
        >⋯</button>
      )}
      {menuOpenId === p.id && (
        <div className="ww-proj-menu" onClick={e => e.stopPropagation()} style={{
          position: "absolute", right: 4, top: "100%", zIndex: 20,
          background: "var(--surface-solid)",
          border: "1px solid var(--warm-10)", borderRadius: 8,
          boxShadow: "0 8px 28px rgba(0,0,0,0.32)",
          padding: 4, minWidth: 160, marginTop: 2,
        }}>
          <button onClick={() => { setMenuOpenId(null); setRenamingId(p.id); setRenameValue(p.name); }} style={projMenuItemStyle()}>Rename</button>
          {/* Move to folder — inline submenu. Folders array + No folder. */}
          <div style={{ padding: "4px 8px 2px", fontFamily: "var(--f)", fontSize: 9, fontWeight: 600, color: "var(--warm-25)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Move to Folder</div>
          <button onClick={() => { setMenuOpenId(null); onMoveToFolder?.(p.id, null); }} style={{ ...projMenuItemStyle(), fontWeight: !p.folder ? 700 : 500 }}>
            {!p.folder ? "✓ " : ""}Unfiled
          </button>
          {folders.map(f => (
            <button key={f} onClick={() => { setMenuOpenId(null); onMoveToFolder?.(p.id, f); }} style={{ ...projMenuItemStyle(), fontWeight: p.folder === f ? 700 : 500 }}>
              {p.folder === f ? "✓ " : ""}{f}
            </button>
          ))}
          <div style={{ height: 1, background: "var(--warm-08)", margin: "4px 6px" }} />
          <button
            onClick={async () => {
              setMenuOpenId(null);
              const ok = await uiConfirm({
                title: `Delete "${p.name}"?`,
                message: "This deletes the project and all its generated images. This can't be undone.",
                confirmLabel: "Delete project",
                danger: true,
              });
              if (ok) {
                onDelete(p.id);
                toast(`Deleted "${p.name}"`, { kind: "info" });
              }
            }}
            style={{ ...projMenuItemStyle(), color: "#FF8A80" }}
          >Delete</button>
        </div>
      )}
    </div>
  );
}

// Drop zone wrapping the top-level (no folder) project list. Dropping
// a project here clears its folder assignment. Renders inline so it
// doesn't add visual chrome unless something is being dragged over it.
function UnfiledDropZone({ children, onDropProject }) {
  const [dragOver, setDragOver] = useState(false);
  const acceptsDrop = e => e.dataTransfer.types.includes("application/x-ww-project-id");
  return (
    <div
      onDragOver={e => { if (!acceptsDrop(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        if (!acceptsDrop(e)) return;
        e.preventDefault();
        const pid = e.dataTransfer.getData("application/x-ww-project-id");
        setDragOver(false);
        if (pid) onDropProject?.(pid);
      }}
      style={{
        borderRadius: 6,
        background: dragOver ? "rgba(124, 252, 156, 0.08)" : "transparent",
        outline: dragOver ? "1px dashed rgba(124, 252, 156, 0.45)" : "1px dashed transparent",
        outlineOffset: -2,
        transition: "background 0.12s ease, outline-color 0.12s ease",
        minHeight: dragOver ? 28 : undefined,
      }}
    >{children}</div>
  );
}

// Collapsible folder group in the project sidebar. Acts as a drop
// target for project rows — dragging a project onto the header (or
// the body) assigns the project to this folder.
function FolderGroup({ name, projects, renderRow, onDeleteFolder, onDropProject }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const acceptsDrop = e => e.dataTransfer.types.includes("application/x-ww-project-id");
  return (
    <div
      onDragOver={e => { if (!acceptsDrop(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(true); }}
      onDragLeave={e => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setDragOver(false);
      }}
      onDrop={e => {
        if (!acceptsDrop(e)) return;
        e.preventDefault();
        const pid = e.dataTransfer.getData("application/x-ww-project-id");
        setDragOver(false);
        if (pid) onDropProject?.(pid);
      }}
      style={{
        marginTop: 6,
        borderRadius: 6,
        background: dragOver ? "rgba(124, 252, 156, 0.08)" : "transparent",
        outline: dragOver ? "1px dashed rgba(124, 252, 156, 0.55)" : "1px dashed transparent",
        outlineOffset: -2,
        transition: "background 0.12s ease, outline-color 0.12s ease",
      }}
    >
      <div
        onClick={() => setCollapsed(c => !c)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", gap: 9,
          padding: "8px 8px", borderRadius: 8, cursor: "pointer",
        }}
      >
        <span style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s ease", fontSize: 10, lineHeight: 1, flexShrink: 0 }}>▾</span>
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6a1.5 1.5 0 0 1 1.06.44L8.5 4.5h4A1.5 1.5 0 0 1 14 6v6.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-8z" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round"/>
        </svg>
        <span className="text-white/90" style={{ flex: 1, minWidth: 0, fontFamily: "var(--f)", fontSize: 12, fontWeight: 500, letterSpacing: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name} <span style={{ opacity: 0.48, fontSize: 12 }}>· {projects.length}</span>
        </span>
        {hovered && onDeleteFolder && (
          <button
            type="button"
            aria-label={`Delete folder ${name}`}
            onPointerDown={e => e.stopPropagation()}
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              void onDeleteFolder(name);
            }}
            title={`Delete folder ${name}`}
            style={{
              width: 24,
              height: 24,
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              borderRadius: 6,
              color: "var(--warm-30)",
              cursor: "pointer",
              padding: 0,
              outline: "none",
            }}
          >
            <Trash2Icon aria-hidden="true" size={14} strokeWidth={1.8} />
          </button>
        )}
      </div>
      {!collapsed && (
        <div>
          {projects.length === 0 ? (
            <div style={{ padding: "4px 8px", fontFamily: "var(--f)", fontSize: 10, color: "var(--warm-20)", fontStyle: "italic" }}>Empty</div>
          ) : projects.map(p => renderRow(p, true))}
        </div>
      )}
    </div>
  );
}

function projMenuItemStyle() {
  return {
    width: "100%", textAlign: "left",
    padding: "6px 8px", borderRadius: 5,
    background: "transparent", border: "none",
    fontFamily: "var(--f)", fontSize: 12, fontWeight: 500,
    color: "var(--warm-50)", cursor: "pointer", outline: "none",
  };
}
