import WorkshopV2 from './v2/Workshop.jsx'

// v1 (the old Discover + Board screens) was removed once v2 became the
// default. WorkshopV2 owns the entire experience now — project list,
// brief form, workspace, exports, share-link hydration. App is just
// the mount point.
export default function App() {
  return <WorkshopV2 />
}
