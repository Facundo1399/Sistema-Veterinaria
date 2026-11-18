import { useState } from "react"
import Login from "./pages/Login.jsx"
import Sidebar from "./pages/Sidebar.jsx"
import MascotasForm from "./pages/MascotasForm.jsx"
import PropietariosForm from "./pages/PropietariosForm.jsx"

const rolPrueba = "admin"

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
      <MascotasForm />
      <PropietariosForm />
    </>
  )
}

export default App
