import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import KioskPage from "./pages/kiosk/KioskPage";
import AdminApp from "./pages/admin/AdminApp";
import { enterFullscreen, exitFullscreen, isFullscreen } from "./fullscreen";

function KioskModeManager() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  useEffect(() => {
    if (isAdmin) {
      exitFullscreen();
      return;
    }
    enterFullscreen();
    if (isFullscreen()) return;
    // Fullscreen requires a user gesture — retry on the visitor's first tap/click.
    const tryEnter = () => enterFullscreen();
    document.addEventListener("pointerdown", tryEnter);
    return () => document.removeEventListener("pointerdown", tryEnter);
  }, [isAdmin]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <KioskModeManager />
      <Routes>
        <Route path="/" element={<KioskPage />} />
        <Route path="/admin/*" element={<AdminApp />} />
      </Routes>
    </BrowserRouter>
  );
}
