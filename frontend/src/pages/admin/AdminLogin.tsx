import { FormEvent, useState } from "react";
import { adminLogin } from "../../api/client";

export default function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

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
