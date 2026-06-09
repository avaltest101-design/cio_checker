// Login page - stores user in localStorage (MVP). No real auth.
import React, { useState } from "react";
import Disclaimer from "../components/Disclaimer.jsx";
import { generateId } from "../utils/storage.js";

const ROLES = ["VA", "CSR", "Trainer", "Team Lead", "Manager"];

export default function Login({ onLogin, settings }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("VA");
  const [error, setError] = useState("");

  const submit = () => {
    if (!name.trim() || !email.trim()) {
      setError("Please enter your name and email to continue.");
      return;
    }
    onLogin({
      id: generateId("user"),
      name: name.trim(),
      email: email.trim(),
      role,
      loginAt: new Date().toISOString(),
    });
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark big">LAVA</span>
          <span className="brand-sub big">COI AI Checker</span>
        </div>
        <p className="login-tagline">
          Certificate of Insurance request &amp; ACORD 25 quality-control assistant
        </p>

        {error && <div className="form-error">{error}</div>}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@lava-agency.com"
          />
        </label>

        <label className="field">
          <span>Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </label>

        <label className="field">
          <span>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <button className="btn btn-primary btn-block" onClick={submit}>
          Enter App
        </button>

        <div className="login-disclaimer">
          <Disclaimer settings={settings} inline />
        </div>
      </div>
    </div>
  );
}
