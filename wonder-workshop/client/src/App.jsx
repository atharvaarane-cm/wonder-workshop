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
} from './hooks/useProject.js'

export default function App() {
  const [project, setProject] = useState(() => getActiveProject())
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

  if (project) {
    return (
      <ProjectContext.Provider value={{
        id: project.id,
        images: project.images || {},
        saveImage: handleSaveImage,
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
      theme={theme}
      toggleTheme={toggleTheme}
    />
  )
}
