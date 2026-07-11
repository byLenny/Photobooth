import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { adminLogout, adminMe } from "../../api/client";
import AdminLogin from "./AdminLogin";
import AdminSettings from "./AdminSettings";
import AdminHistory from "./AdminHistory";
import AdminHistoryDetail from "./AdminHistoryDetail";

export default function AdminApp() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    adminMe()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <div className="admin-shell">Loading…</div>;
  if (!authed) return <AdminLogin onSuccess={() => setAuthed(true)} />;

  return (
    <div className="admin-shell">
      <div className="admin-nav">
        <NavLink to="/admin" end>
          Settings
        </NavLink>
        <NavLink to="/admin/history">History</NavLink>
        <button
          className="secondary-button"
          style={{ marginLeft: "auto" }}
          onClick={() => adminLogout().then(() => setAuthed(false))}
        >
          Log out
        </button>
      </div>
      <Routes>
        <Route index element={<AdminSettings />} />
        <Route path="history" element={<AdminHistory />} />
        <Route path="history/:id" element={<AdminHistoryDetail />} />
      </Routes>
    </div>
  );
}
