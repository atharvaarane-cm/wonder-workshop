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
} from './hooks/useProject.js'

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
  const [project, setProject] = useState(() => shareData ? null : getActiveProject())
  const [projects, setProjects] = useState(() => listProjects())
  const [theme, setTheme] = useState(() => localStorage.getItem('ww_theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ww_theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme(t => t === 'light' ? 'dark' : 'light')
  }

  function refreshList() { setProjects(listProjects()) }

  function handleGenerate(brief) {
    const p = createProject(brief)
    setProject(p)
    refreshList()
  }

  function handleOpenProject(p) {
    setActiveProject(p.id)
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
      }}>
        <Board
          brief={project.brief}
          onBack={handleBack}
          theme={theme}
          toggleTheme={toggleTheme}
          onSaveBrief={handleSaveBrief}
        />
      </ProjectContext.Provider>
    )
  }

  return (
    <Discover
      onGenerate={handleGenerate}
      projects={projects}
      onOpenProject={handleOpenProject}
      onDeleteProject={handleDeleteProject}
      onRenameProject={handleRenameProject}
      theme={theme}
      toggleTheme={toggleTheme}
    />
  )
}
