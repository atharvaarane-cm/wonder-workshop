import { useState, useEffect, useRef } from "react";
import { ChevronDownIcon, FilmIcon, FolderIcon, FolderOpenIcon, FolderPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Group, GroupSeparator } from "@/components/ui/group";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "@/components/ui/menu";
import { SectionIcon, WLogo, timeAgo, uiConfirm, toast, useCategoryPending } from "../../Workshop.jsx";
import iconNavBrandSvg from "../../../assets/icon-nav-brand.svg?raw";
import iconNavCharSvg from "../../../assets/icon-nav-char.svg?raw";
import iconNavElementsSvg from "../../../assets/icon-nav-elements.svg?raw";
import iconNavLocationSvg from "../../../assets/icon-nav-location.svg?raw";
import iconNavMoodSvg from "../../../assets/icon-nav-mood.svg?raw";

// -- PROJECT SIDEBAR (left rail, multi-project nav) -------------
// Persistent navigation between projects. Shown whether the user is
// on BriefForm (landing) or inside OneSheet. Click any project name
// to switch; the current project saves automatically before the
// switch so no work is lost.

export const PROJECT_SECTION_TABS = [
  { key: "talent", label: "Characters", icon: "characters" },
  { key: "products", label: "Elements", icon: "elements" },
  { key: "locations", label: "Locations", icon: "locations" },
  { key: "mood", label: "Mood", icon: "mood" },
  { key: "settings", label: "Project Settings", icon: "brand" },
];

const NAV_ICON_PATHS = {
  brand: "M12.3301 19.4951C11.3115 20.5205 10.2383 20.5273 9.19922 19.4883L4.83789 15.1406C3.80566 14.1084 3.81934 13.0215 4.83789 12.0098L11.5439 5.31055C12.0771 4.77734 12.3916 4.71582 13.1572 4.71582H15.7549C16.5068 4.71582 16.7666 4.90039 17.3135 5.44727L18.8789 7.0127C19.4326 7.56641 19.6104 7.81934 19.6104 8.57129V11.1689C19.6104 11.9414 19.5625 12.2559 19.0293 12.7891L12.3301 19.4951ZM11.4619 18.4697L18.0859 11.8389C18.2227 11.7021 18.291 11.5723 18.291 11.3467V8.57812C18.291 8.37305 18.2158 8.23633 18.0859 8.09961L16.2334 6.24707C16.0967 6.11035 15.9531 6.03516 15.748 6.03516H12.9863C12.7676 6.03516 12.6309 6.11035 12.4941 6.25391L5.86328 12.8711C5.41211 13.3223 5.39844 13.8008 5.87012 14.2725L10.0605 18.4629C10.5322 18.9277 11.0039 18.9209 11.4619 18.4697ZM14.9072 10.4033C14.3467 10.4033 13.9297 9.96582 13.9297 9.41895C13.9297 8.87207 14.3467 8.44141 14.9072 8.44141C15.4678 8.44141 15.8916 8.87207 15.8916 9.41895C15.8916 9.96582 15.4678 10.4033 14.9072 10.4033Z",
  characters: "M15.3955 12.0918C13.748 12.0918 12.4082 10.6426 12.4082 8.8584C12.4082 7.10156 13.7549 5.67969 15.3955 5.67969C17.0498 5.67969 18.3896 7.08105 18.3896 8.84473C18.3896 10.6357 17.0498 12.0918 15.3955 12.0918ZM7.47266 12.167C6.04395 12.167 4.875 10.8955 4.875 9.32324C4.875 7.79883 6.05078 6.53418 7.47266 6.53418C8.91504 6.53418 10.0771 7.77832 10.0771 9.30957C10.0771 10.8887 8.91504 12.167 7.47266 12.167ZM15.3955 10.9092C16.3525 10.9092 17.1523 10 17.1523 8.84473C17.1523 7.7168 16.3594 6.8623 15.3955 6.8623C14.4385 6.8623 13.6455 7.73047 13.6455 8.8584C13.6455 10.0137 14.4521 10.9092 15.3955 10.9092ZM7.47266 10.998C8.25879 10.998 8.92188 10.2529 8.92188 9.30957C8.92188 8.41406 8.27246 7.69629 7.47266 7.69629C6.69336 7.69629 6.03711 8.42773 6.03711 9.32324C6.03711 10.2529 6.7002 10.998 7.47266 10.998ZM3.71289 18.4492C2.73535 18.4492 2.24316 18.0322 2.24316 17.2188C2.24316 14.9492 4.58105 12.8848 7.47266 12.8848C8.53906 12.8848 9.61914 13.1719 10.4873 13.7119C10.1182 13.9512 9.83105 14.2383 9.60547 14.5596C9.01074 14.2314 8.23828 14.04 7.47266 14.04C5.29883 14.04 3.45312 15.5439 3.45312 17.1162C3.45312 17.2324 3.50781 17.2939 3.6377 17.2939H8.4502C8.40234 17.7451 8.65527 18.2305 9.02441 18.4492H3.71289ZM11.1299 18.4492C9.9541 18.4492 9.38672 18.0732 9.38672 17.2734C9.38672 15.4072 11.7246 12.8916 15.3955 12.8916C19.0664 12.8916 21.4043 15.4072 21.4043 17.2734C21.4043 18.0732 20.8369 18.4492 19.6543 18.4492H11.1299ZM10.9043 17.2666H19.8867C20.0439 17.2666 20.1055 17.2188 20.1055 17.0889C20.1055 16.043 18.417 14.0742 15.3955 14.0742C12.374 14.0742 10.6787 16.043 10.6787 17.0889C10.6787 17.2188 10.7402 17.2666 10.9043 17.2666Z",
  elements: "M5.72754 16.4326C5.07129 16.0635 4.74316 15.6807 4.74316 14.71V9.18652C4.74316 8.46191 5.0166 7.99707 5.625 7.65527L10.4307 4.96191C11.2715 4.4834 12.1396 4.4834 12.9805 4.96191L17.7861 7.65527C18.3945 7.99707 18.668 8.46191 18.668 9.18652V14.71C18.668 15.6807 18.3398 16.0635 17.6836 16.4326L12.2764 19.4541C11.8936 19.666 11.5107 19.666 11.1348 19.4541L5.72754 16.4326ZM14.9082 9.58984L16.7607 8.54395L12.4404 6.11035C11.9414 5.82324 11.4697 5.83008 10.9707 6.11035L9.83594 6.74609L14.9082 9.58984ZM11.7021 11.3809L13.623 10.3008L8.55762 7.46387L6.65039 8.54395L11.7021 11.3809ZM6.46582 15.3799L11.0732 17.9844V12.4951L5.95996 9.61035V14.5938C5.95996 14.9561 6.08984 15.1748 6.46582 15.3799ZM16.9453 15.3799C17.3213 15.1748 17.4512 14.9561 17.4512 14.5938V9.61035L12.3379 12.4951V17.9844L16.9453 15.3799Z",
  locations: "M5.65234 18.6816C5.08496 18.6816 4.74316 18.3467 4.74316 17.7725V8.57812C4.74316 8.05859 4.94824 7.69629 5.41992 7.43652L8.81055 5.50879C9.05664 5.36523 9.33008 5.29688 9.61035 5.29688C9.89062 5.29688 10.1709 5.37207 10.4238 5.51562L14.0195 7.69629L17.4854 5.76855C17.7588 5.61816 17.957 5.53613 18.1826 5.53613C18.75 5.53613 19.0918 5.87793 19.0918 6.45215V15.6328C19.0918 16.1523 18.8867 16.5215 18.4219 16.7812L15.0039 18.709C14.7578 18.8525 14.4775 18.9277 14.1973 18.9277C13.9102 18.9277 13.6162 18.8457 13.3291 18.6953L9.68555 16.6514L6.34961 18.4561C6.08301 18.6064 5.87793 18.6816 5.65234 18.6816ZM9.08398 15.4414V6.87598C9.00879 6.91699 8.94043 6.95117 8.86523 6.99902L6.26074 8.50977C6.07617 8.6123 6.00781 8.73535 6.00781 8.92676V16.8906C6.00781 16.9795 6.05566 17.041 6.13086 17.041C6.16504 17.041 6.20605 17.0205 6.25391 17L9.08398 15.4414ZM10.3691 15.4824L13.1855 17.0684C13.2812 17.1162 13.377 17.1641 13.4658 17.2119V8.89258L10.5879 7.15625C10.5195 7.11523 10.4375 7.07422 10.3691 7.04004V15.4824ZM14.751 17.3145C14.8535 17.2666 14.9629 17.2051 15.0654 17.1436L17.5811 15.6875C17.7588 15.585 17.8271 15.4619 17.8271 15.2705V7.33398C17.8271 7.25195 17.7725 7.19043 17.6973 7.19043C17.6631 7.19043 17.6221 7.21094 17.5879 7.23145L14.751 8.77637V17.3145Z",
  mood: "M11.7852 19.126C7.88867 19.126 4.72363 15.9609 4.72363 12.0645C4.72363 8.16797 7.88867 5.00293 11.7852 5.00293C15.6816 5.00293 18.8467 8.16797 18.8467 12.0645C18.8467 15.9609 15.6816 19.126 11.7852 19.126ZM11.7852 17.7314C14.9229 17.7314 17.459 15.2021 17.459 12.0645C17.459 8.92676 14.9229 6.39062 11.7852 6.39062C8.64746 6.39062 6.11133 8.92676 6.11133 12.0645C6.11133 15.2021 8.64746 17.7314 11.7852 17.7314ZM9.76172 11.4492C9.33789 11.4492 8.96875 11.0596 8.96875 10.5195C8.96875 9.97949 9.33789 9.58984 9.76172 9.58984C10.1992 9.58984 10.5752 9.97949 10.5752 10.5195C10.5752 11.0596 10.1924 11.4492 9.76172 11.4492ZM13.7949 11.4492C13.3711 11.4492 13.002 11.0596 13.002 10.5195C13.002 9.97949 13.3643 9.58984 13.7949 9.58984C14.2256 9.58984 14.6084 9.97949 14.6084 10.5195C14.6084 11.0596 14.2256 11.4492 13.7949 11.4492ZM11.7783 15.4277C10.3496 15.4277 9.38574 14.4775 9.38574 14.0195C9.38574 13.8555 9.5498 13.7734 9.7002 13.8486C10.1992 14.1084 10.7871 14.416 11.7783 14.416C12.7764 14.416 13.3574 14.1084 13.8564 13.8486C14.0137 13.7803 14.1777 13.8555 14.1777 14.0195C14.1777 14.4775 13.2139 15.4277 11.7783 15.4277Z",
};

function ProjectNavIcon({ name, color }) {
  const svg = {
    brand: iconNavBrandSvg,
    characters: iconNavCharSvg,
    elements: iconNavElementsSvg,
    locations: iconNavLocationSvg,
    mood: iconNavMoodSvg,
  }[name];

  return (
    <span
      aria-hidden="true"
      style={{ color, width: 24, height: 24, display: "inline-flex", flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

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
  onRenameFolder,
  mode = "root",
  activeProjectTitle = "",
  activeAssetTab = "settings",
  onAssetTabChange,
  onBackToProjects,
  assetCounts = {},
  reconcileFlags = {},
  onCleanupDuplicates,
  homeBackdrop = false,
  floating = false,
}) {
  // Count extra same-name project rows (anything beyond the first per name)
  // — these are almost always fork-orphans from the old "Regenerate All"
  // duplicate bug. Surfacing a one-click cleanup beats hunting per-row menus.
  const duplicateCount = (() => {
    const seen = new Set();
    let extra = 0;
    for (const p of (projects || [])) {
      const key = (p?.name || "").trim().toLowerCase();
      if (!key) continue;
      if (seen.has(key)) extra++; else seen.add(key);
    }
    return extra;
  })();
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
            <svg width="13" height="11" viewBox="0 0 13 11" fill="none" aria-hidden="true">
              <path d="M3.84863 6.03613L2.25586 5.94043L4.27246 7.78613L5.80371 9.33789C5.94043 9.46777 6.02246 9.65234 6.02246 9.86426C6.02246 10.2744 5.71484 10.582 5.28418 10.582C5.09961 10.582 4.91504 10.5068 4.75098 10.3496L0.246094 5.84473C0.0888672 5.69434 0 5.49609 0 5.29102C0 5.08594 0.0888672 4.88086 0.246094 4.7373L4.7373 0.239258C4.91504 0.0683594 5.09961 0 5.28418 0C5.71484 0 6.02246 0.300781 6.02246 0.710938C6.02246 0.922852 5.94043 1.10742 5.80371 1.24414L4.27246 2.7959L2.25586 4.63477L3.84863 4.5459H12.1611C12.6055 4.5459 12.9199 4.84668 12.9199 5.29102C12.9199 5.72852 12.6055 6.03613 12.1611 6.03613H3.84863Z" fill="currentColor" />
            </svg>
          </button>
          <div
            title={activeProjectTitle || "Untitled"}
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: "var(--f)",
              fontSize: 14,
              fontWeight: 400,
              color: "var(--warm-50)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activeProjectTitle || "Untitled"}
          </div>
        </div>

        <nav aria-label="Project sections" style={{ padding: "13px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          {PROJECT_SECTION_TABS.map(tab => (
            <ProjectSectionRow
              key={tab.key}
              tab={tab}
              count={assetCounts[tab.key] ?? 0}
              needsReconcile={!!reconcileFlags[tab.key]}
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
      width: floating ? "100%" : 256, flexShrink: 0,
      borderRight: floating ? "none" : (homeBackdrop ? "1px solid rgba(255,255,255,0.08)" : "1px solid var(--warm-06)"),
      background: floating ? "rgba(12,11,11,0.85)" : (homeBackdrop ? "rgba(0,0,0,0.46)" : "rgba(0,0,0,0.72)"),
      backdropFilter: "blur(20px) saturate(1.05)",
      WebkitBackdropFilter: "blur(20px) saturate(1.05)",
      display: "flex", flexDirection: "column",
      height: floating ? "100%" : "100vh", overflow: "hidden",
    }}>
      {!floating && <div style={{
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
      </div>}

      <div style={{ padding: floating ? "18px 14px 18px" : "18px 14px" }}>
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
        <div style={{ fontFamily: "var(--f)", fontSize: 13, fontWeight: 500, color: "var(--warm-25)", letterSpacing: 0 }}>
          {projects.length} Project{projects.length === 1 ? "" : "s"}
        </div>
        {duplicateCount > 0 && onCleanupDuplicates && (
          <button
            onClick={onCleanupDuplicates}
            title="Remove duplicate project entries, keeping the most recently edited of each"
            style={{
              display: "flex", alignItems: "center", gap: 6, marginTop: 8,
              width: "100%", padding: "6px 8px", borderRadius: 7, cursor: "pointer",
              background: "rgba(245,166,35,0.10)", border: "1px solid rgba(245,166,35,0.45)",
              color: "#F5A623", outline: "none",
              fontFamily: "var(--f)", fontSize: 11, fontWeight: 600,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#F5A623", flexShrink: 0 }} />
            Clean up {duplicateCount} duplicate{duplicateCount === 1 ? "" : "s"}
          </button>
        )}
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
                isActive={false}
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
                    onRenameFolder={onRenameFolder}
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

const GEN_PREFIX = { talent: "talent.", products: "product.", locations: "location.", mood: "mood." };

function ProjectSectionRow({ tab, count, isActive, onClick, needsReconcile = false }) {
  const bg = isActive ? "var(--warm-08)" : "transparent";
  const accent = "var(--warm)";
  // Shimmer the whole row while anything in this section is being generated, so
  // the user can see at a glance which category the tool is currently working on.
  const generating = useCategoryPending(GEN_PREFIX[tab.key] || "");

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        gap: 7,
        width: "100%",
        padding: "12px 14px",
        minHeight: 48,
        borderRadius: 12,
        cursor: "pointer",
        outline: "none",
        border: "none",
        fontFamily: "var(--f)",
        fontSize: 14,
        fontWeight: 500,
        background: bg,
        color: accent,
        textAlign: "left",
        transition: "background 0.15s ease",
      }}
    >
      {generating && (
        <span aria-hidden="true" style={{
          position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 12,
          backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0) 100%)",
          backgroundSize: "600px 100%", backgroundRepeat: "no-repeat",
          animation: "shimmer 1.4s infinite linear",
        }} />
      )}
      <ProjectNavIcon name={tab.icon} color={accent} />
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tab.label}</span>
      {needsReconcile && (
        <span
          title="Some items here aren't in the brief or storyboard yet"
          style={{ width: 7, height: 7, borderRadius: "50%", background: "#F5A623", flexShrink: 0, boxShadow: "0 0 0 3px rgba(245,166,35,0.18)" }}
        />
      )}
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 20,
        height: 20,
        padding: "0 6px",
        borderRadius: 10,
        background: isActive ? "var(--warm-12)" : "var(--warm-06)",
        fontFamily: "var(--f)",
        fontSize: 12,
        fontWeight: 400,
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
            fontFamily: "var(--f)", fontSize: 14, fontWeight: 500,
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
            flex: 1, fontFamily: "var(--f)", fontSize: 14,
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
function FolderGroup({ name, projects, renderRow, onDeleteFolder, onRenameFolder, onDropProject }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(name);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const acceptsDrop = e => e.dataTransfer.types.includes("application/x-ww-project-id");
  const actionVisible = hovered || menuOpen || renaming;

  useEffect(() => {
    if (!renaming) setRenameValue(name);
  }, [name, renaming]);

  useEffect(() => {
    if (renaming) setTimeout(() => inputRef.current?.select(), 0);
  }, [renaming]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e) {
      if (!e.target.closest?.(".ww-folder-menu") && !e.target.closest?.(".ww-folder-more")) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  function startRename() {
    setMenuOpen(false);
    setRenameValue(name);
    setRenaming(true);
  }

  function commitRename() {
    const next = renameValue.trim();
    if (next && next !== name) onRenameFolder?.(name, next);
    setRenaming(false);
    setRenameValue(next || name);
  }

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
        onClick={() => !renaming && setCollapsed(c => !c)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", gap: 9,
          padding: "8px 8px", borderRadius: 8, cursor: renaming ? "default" : "pointer",
          position: "relative",
        }}
      >
        {collapsed ? (
          <FolderIcon aria-hidden="true" size={20} strokeWidth={1.7} style={{ flexShrink: 0 }} />
        ) : (
          <FolderOpenIcon aria-hidden="true" size={20} strokeWidth={1.7} style={{ flexShrink: 0 }} />
        )}
        {renaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setRenaming(false);
                setRenameValue(name);
              }
            }}
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: "var(--f)",
              fontSize: 14,
              fontWeight: 500,
              background: "var(--warm-04)",
              border: "1px solid var(--warm-12)",
              borderRadius: 4,
              padding: "3px 6px",
              color: "var(--warm)",
              outline: "none",
            }}
          />
        ) : (
          <span
            className="text-white/90"
            title="Double-click to rename"
            onDoubleClick={e => {
              e.stopPropagation();
              startRename();
            }}
            style={{ flex: 1, minWidth: 0, fontFamily: "var(--f)", fontSize: 14, fontWeight: 500, letterSpacing: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {name}
          </span>
        )}
        {(onRenameFolder || onDeleteFolder) && !renaming && (
          <button
            type="button"
            className="ww-folder-more"
            aria-label={`Folder actions for ${name}`}
            onPointerDown={e => e.stopPropagation()}
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen(open => !open);
            }}
            title={`Folder actions`}
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
              fontSize: 16,
              lineHeight: 1,
              opacity: actionVisible ? 1 : 0,
              pointerEvents: actionVisible ? "auto" : "none",
              transition: "opacity 0.12s ease",
            }}
          >
            ⋯
          </button>
        )}
        {menuOpen && (
          <div
            className="ww-folder-menu"
            onClick={e => e.stopPropagation()}
            style={{
              position: "absolute",
              right: 4,
              top: "100%",
              zIndex: 30,
              background: "var(--surface-solid)",
              border: "1px solid var(--warm-10)",
              borderRadius: 8,
              boxShadow: "0 8px 28px rgba(0,0,0,0.32)",
              padding: 4,
              minWidth: 150,
              marginTop: 2,
            }}
          >
            {onRenameFolder && (
              <button
                type="button"
                onClick={startRename}
                style={projMenuItemStyle()}
              >
                Rename
              </button>
            )}
            {onDeleteFolder && (
              <>
                {onRenameFolder && <div style={{ height: 1, background: "var(--warm-08)", margin: "4px 6px" }} />}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void onDeleteFolder(name);
                  }}
                  style={{ ...projMenuItemStyle(), color: "#FF8A80" }}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {!collapsed && (
        <div>
          {projects.length === 0 ? (
            <div style={{ padding: "4px 8px 4px 24px", fontFamily: "var(--f)", fontSize: 13, fontWeight: 400, color: "var(--warm-20)" }}>Empty</div>
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
