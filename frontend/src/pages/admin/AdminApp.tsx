import { useState } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { adminLogout } from "../../api/client";
import AdminLogin from "./AdminLogin";
import AdminSettings from "./AdminSettings";
import AdminHistory from "./AdminHistory";
import AdminHistoryDetail from "./AdminHistoryDetail";

export default function AdminApp() {
  const [authed, setAuthed] = useState(false);
  const navigate = useNavigate();

  if (!authed) return <AdminLogin onSuccess={() => setAuthed(true)} />;

  function closeAdmin() {
    // Invalidate the session so the PIN is required again next time settings is opened.
    adminLogout().catch(() => undefined);
    navigate("/");
  }

  return (
    <div className="admin-shell">
      <button className="secondary-button admin-close" onClick={closeAdmin}>
        Close
      </button>
      <div className="admin-nav">
        <NavLink to="/admin" end>
          Settings
        </NavLink>
        <NavLink to="/admin/history">History</NavLink>
      </div>
      <Routes>
        <Route index element={<AdminSettings />} />
        <Route path="history" element={<AdminHistory />} />
        <Route path="history/:id" element={<AdminHistoryDetail />} />
      </Routes>
    </div>
  );
}
