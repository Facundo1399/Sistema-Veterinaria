import { useState } from "react"
import Login from "./pages/Login.jsx"
import Sidebar from "./pages/Sidebar.jsx"

const rolPrueba = "veterinario"

function App() {
  const [activeRoute, setActiveRoute] = useState("dashboard")

  return (
    <>
      <Login />
      <Sidebar
       activeRoute={activeRoute} 
       onNavigate={setActiveRoute}
       rol={rolPrueba}
       nombreUsuario="Dr carlos" />
    </>
  )
}

export default App
