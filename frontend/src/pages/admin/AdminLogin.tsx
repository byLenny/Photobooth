import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin } from "../../api/client";

const IDLE_TIMEOUT_MS = 30_000;

export default function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate("/"), IDLE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pin, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await adminLogin(pin);
      onSuccess();
    } catch {
      setError("Incorrect PIN");
    }
  }

  return (
    <div className="screen">
      <button className="secondary-button admin-close" onClick={() => navigate("/")}>
        Close
      </button>
      <h1>Admin Login</h1>
      <form onSubmit={handleSubmit}>
        <div className="admin-field">
          <label htmlFor="pin">PIN</label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoFocus
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="big-button" type="submit">
          Log in
        </button>
      </form>
    </div>
  );
}
