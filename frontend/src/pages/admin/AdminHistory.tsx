import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminListSessions } from "../../api/client";
import type { SessionDetail } from "../../api/types";

const PAGE_SIZE = 24;

export default function AdminHistory() {
  const [items, setItems] = useState<SessionDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    adminListSessions(PAGE_SIZE, offset).then((res) => {
      setItems(res.items);
      setTotal(res.total);
    });
  }, [offset]);

  return (
    <div>
      <h2>Session history ({total})</h2>
      <div className="session-grid">
        {items.map((s) => (
          <Link key={s.id} to={`/admin/history/${s.id}`}>
            <img src={s.brandedUrl} alt="" />
          </Link>
        ))}
      </div>
      <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
        <button
          className="secondary-button"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
        >
          Previous
        </button>
        <button
          className="secondary-button"
          disabled={offset + PAGE_SIZE >= total}
          onClick={() => setOffset(offset + PAGE_SIZE)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
