import { BrowserRouter, Routes, Route } from "react-router-dom";
import KioskPage from "./pages/kiosk/KioskPage";
import AdminApp from "./pages/admin/AdminApp";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<KioskPage />} />
        <Route path="/admin/*" element={<AdminApp />} />
      </Routes>
    </BrowserRouter>
  );
}
