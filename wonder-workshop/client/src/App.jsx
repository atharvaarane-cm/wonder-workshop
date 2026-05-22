import { useState, useEffect } from 'react'
import Discover from './screens/Discover.jsx'
import Board from './screens/Board.jsx'
import {
  ProjectContext,
  listProjects,
  createProject,
  deleteProject as removeProject,
  getActiveProject,
  setActiveProject,
  updateProjectBrief,
  saveImageForProject,
  moveImageBetweenSlots,
  renameProject,
  moveProjectToFolder,
  duplicateProject,
  listFolders,
  createFolder,
  deleteFolder,
  renameFolder,
} from './hooks/useProject.js'
import { hydrate as hydrateImages, isHydrated as imagesReady, subscribe as subscribeImages, getImagesForProject } from './hooks/imageStore.js'

function parseShareHash() {
  try {
    const hash = window.location.hash
    if (!hash.startsWith('#share=')) return null
    const encoded = hash.slice('#share='.length)
    const json = decodeURIComponent(escape(atob(encoded)))
    return JSON.parse(json)
  } catch {
    return null
  }
}

export default function App() {
  const [shareData] = useState(() => parseShareHash())
  const [imagesHydrated, setImagesHydrated] = useState(() => imagesReady())
  const [project, setProject] = useState(() => shareData ? null : getActiveProject())
  const [projects, setProjects] = useState(() => listProjects())
  const [folders, setFolders] = useState(() => listFolders())

  // Hydrate images from IndexedDB on first mount, then re-pull the active
  // project and the project list so they reflect the loaded image data.
  // Components read images via project.images, which is synthesised from
  // the imageStore cache — until hydration completes, those reads return
  // empty objects and the UI shows empty slots.
  useEffect(() => {
    if (imagesHydrated) return
    hydrateImages().then(() => {
      setImagesHydrated(true)
      // Refresh project + list now that images are populated
      setProject(p => p ? { ...p, images: getImagesForProject(p.id) } : p)
      setProjects(listProjects())
    })
  }, [imagesHydrated])

  // Re-render whenever the imageStore reports a change (e.g. when a slot
  // image saves) so components reading project.images via context pick up
  // the new data.
  useEffect(() => {
    return subscribeImages(() => {
      setProject(p => p ? { ...p, images: getImagesForProject(p.id) } : p)
    })
  }, [])
  // Set when a project is created via "Generate" (not "Start blank" or
  // opening an existing one). Board reads it on mount and fires
  // image generation across every section, per Ravi's "it should
  // autogenerate the images as well".
  const [autoGenerateImages, setAutoGenerateImages] = useState(false)
  // Dark by default per the new mockup direction; explicit user preference wins.
  const [theme, setTheme] = useState(() => localStorage.getItem('ww_theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ww_theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme(t => t === 'light' ? 'dark' : 'light')
  }

  function refreshList() {
    setProjects(listProjects())
    setFolders(listFolders())
  }

  function handleGenerate(brief) {
    const p = createProject(brief)
    setAutoGenerateImages(true)
    setProject(p)
    refreshList()
  }

  // "Start blank" — skip the AI brief generation entirely, open an empty
  // project the user can fill in manually. Ratio + resolution from the
  // form are still preserved so the Storyboard output renders sensibly.
  function handleStartBlank({ ratio, resolution } = {}) {
    const stubBrief = {
      title: 'New project',
      projectInfo: { projectName: 'New project' },
      creativeDirection: {},
      brandInfo: { colors: [] },
      character: {},
      environment: {},
      shotList: [],
      generationSettings: {
        ratio: ratio || '16:9',
        resolution: resolution || '1K',
      },
    }
    const p = createProject(stubBrief)
    setAutoGenerateImages(false) // "Start blank" stays blank — no auto image gen
    setProject(p)
    refreshList()
  }

  function handleOpenProject(p) {
    setActiveProject(p.id)
    setAutoGenerateImages(false) // opening an existing project shouldn't re-fire generation
    setProject(p)
  }

  function handleBack() {
    setActiveProject(null)
    setProject(null)
    refreshList()
  }

  function handleDeleteProject(id) {
    removeProject(id)
    if (project?.id === id) setProject(null)
    refreshList()
  }

  function handleRenameProject(id, name) {
    const updated = renameProject(id, name)
    if (!updated) return
    if (project?.id === id) setProject(updated)
    refreshList()
  }

  function handleMoveProjectToFolder(id, folder) {
    const updated = moveProjectToFolder(id, folder)
    if (!updated) return
    if (project?.id === id) setProject(updated)
    refreshList()
  }

  function handleDuplicateProject(id) {
    const copy = duplicateProject(id)
    if (!copy) return
    refreshList()
  }

  function handleCreateFolder(name) {
    const cleaned = createFolder(name)
    if (cleaned) refreshList()
    return cleaned
  }
  function handleDeleteFolder(name) {
    deleteFolder(name)
    refreshList()
  }
  function handleRenameFolder(oldName, newName) {
    renameFolder(oldName, newName)
    refreshList()
  }

  function handleSaveBrief(nextBrief) {
    if (!project) return
    const updated = updateProjectBrief(project.id, nextBrief)
    if (updated) {
      setProject(updated)
      refreshList()
    }
  }

  function handleSaveImage(slotKey, data) {
    if (!project) return
    const updated = saveImageForProject(project.id, slotKey, data)
    if (updated) {
      setProject(updated)
      refreshList()
    }
  }

  function handleMoveImage(fromSlotKey, toSlotKey, version) {
    if (!project) return
    const updated = moveImageBetweenSlots(project.id, fromSlotKey, toSlotKey, version)
    if (updated) {
      setProject(updated)
      refreshList()
    }
  }

  if (shareData) {
    return (
      <ProjectContext.Provider value={{
        id: null,
        images: shareData.images || {},
        saveImage: () => {},
        moveImage: () => {},
        ratio: shareData.brief?.generationSettings?.ratio || '16:9',
        brief: shareData.brief,
      }}>
        <Board
          brief={shareData.brief}
          onBack={() => { window.location.hash = ''; window.location.reload() }}
          theme={theme}
          toggleTheme={toggleTheme}
          onSaveBrief={() => {}}
          readOnly
        />
      </ProjectContext.Provider>
    )
  }

  if (project) {
    return (
      <ProjectContext.Provider value={{
        id: project.id,
        images: project.images || {},
        saveImage: handleSaveImage,
        moveImage: handleMoveImage,
        ratio: project.brief?.generationSettings?.ratio || '16:9',
        brief: project.brief,
      }}>
        <Board
          key={project.id}
          brief={project.brief}
          onBack={handleBack}
          theme={theme}
          toggleTheme={toggleTheme}
          onSaveBrief={handleSaveBrief}
          autoGenerateImages={autoGenerateImages}
          onAutoGenerateConsumed={() => setAutoGenerateImages(false)}
          projectId={project.id}
          projectName={project.name}
          projectFolder={project.folder}
          folders={folders}
          onDeleteProject={handleDeleteProject}
          onDuplicateProject={handleDuplicateProject}
          onRenameProject={handleRenameProject}
          onMoveProjectToFolder={handleMoveProjectToFolder}
        />
      </ProjectContext.Provider>
    )
  }

  return (
    <Discover
      onGenerate={handleGenerate}
      onStartBlank={handleStartBlank}
      projects={projects}
      folders={folders}
      onOpenProject={handleOpenProject}
      onDeleteProject={handleDeleteProject}
      onRenameProject={handleRenameProject}
      onMoveProjectToFolder={handleMoveProjectToFolder}
      onDuplicateProject={handleDuplicateProject}
      onCreateFolder={handleCreateFolder}
      onDeleteFolder={handleDeleteFolder}
      onRenameFolder={handleRenameFolder}
      theme={theme}
      toggleTheme={toggleTheme}
    />
  )
}
