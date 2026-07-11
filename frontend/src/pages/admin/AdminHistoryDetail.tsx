import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminGetSession } from "../../api/client";
import type { SessionDetail } from "../../api/types";

export default function AdminHistoryDetail() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionDetail | null>(null);

  useEffect(() => {
    if (id) adminGetSession(id).then(setSession);
  }, [id]);

  if (!session) return <p>Loading…</p>;

  const shareUrl = `${window.location.origin}${session.shareUrl}`;

  return (
    <div>
      <p>
        <Link to="/admin/history">&larr; Back to history</Link>
      </p>
      <h2>Session {session.id}</h2>
      <p>{new Date(session.createdAt).toLocaleString()}</p>

      <h3>Branded photo</h3>
      <img src={session.brandedUrl} alt="Branded" style={{ maxWidth: "100%", borderRadius: 12 }} />

      <h3>Originals</h3>
      <div className="session-grid">
        {session.originalUrls.map((url) => (
          <img key={url} src={url} alt="Original shot" />
        ))}
      </div>

      <h3>Share link / QR code</h3>
      <p>
        <a href={shareUrl} target="_blank" rel="noreferrer">
          {shareUrl}
        </a>
      </p>
      <div className="qr-code" style={{ display: "inline-block" }}>
        <img src={session.qrCodeUrl} alt="QR code" />
      </div>
    </div>
  );
}
