"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Account } from "@/lib/types";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  if (response.status === 401) window.location.replace("/");
  if (response.status === 403) window.location.replace("/panel");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Operacja nie powiodła się.");
  return data;
}

export default function AdminPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({ displayName: "", username: "" });
  const [credential, setCredential] = useState<{
    displayName: string;
    password: string;
    username: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadAccounts() {
    const result = await api<{ accounts: Account[] }>("/api/admin/accounts");
    setAccounts(result.accounts);
  }

  useEffect(() => {
    loadAccounts().catch((reason: Error) => setError(reason.message));
  }, []);

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{
        account: Account;
        temporaryPassword: string;
      }>("/api/admin/accounts", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setCredential({
        displayName: result.account.displayName,
        password: result.temporaryPassword,
        username: result.account.username,
      });
      setForm({ displayName: "", username: "" });
      await loadAccounts();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(username: string) {
    if (!window.confirm(`Wyłączyć dostęp dla @${username}?`)) return;
    try {
      await api("/api/admin/accounts", {
        method: "DELETE",
        body: JSON.stringify({ username }),
      });
      await loadAccounts();
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function copyCredentials() {
    if (!credential) return;
    await navigator.clipboard.writeText(
      `OLX Radar\nLogin: ${credential.username}\nHasło tymczasowe: ${credential.password}`,
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a className="saas-brand" href="/panel"><span className="saas-brand-mark">R</span><span>OLX Radar</span></a>
        <a className="saas-button subtle" href="/panel">← Wróć do radaru</a>
      </header>
      <section className="admin-intro">
        <p className="saas-eyebrow">ADMINISTRACJA DOSTĘPEM</p>
        <h1>Konta użytkowników</h1>
        <p>Twórz zamknięte konta i przekazuj dane tylko wybranym osobom.</p>
      </section>
      <div className="admin-grid">
        <section className="admin-card">
          <div className="admin-card-title"><span>01</span><div><h2>Wygeneruj konto</h2><p>Hasło pojawi się tylko jeden raz.</p></div></div>
          <form onSubmit={createAccount}>
            <label>Nazwa użytkownika<input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="np. Kuba Nowak" required /></label>
            <label>Login<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} placeholder="np. kuba.nowak" required /></label>
            {error && <p className="form-error">{error}</p>}
            <button className="saas-button primary wide" disabled={busy}>{busy ? "Generuję…" : "Utwórz konto i hasło"}</button>
          </form>
        </section>
        <section className="admin-card credentials-card">
          <div className="admin-card-title"><span>02</span><div><h2>Dane do przekazania</h2><p>Po zamknięciu nie pokażemy hasła ponownie.</p></div></div>
          {credential ? (
            <div className="credential-box">
              <small>{credential.displayName}</small>
              <div><span>LOGIN</span><strong>{credential.username}</strong></div>
              <div><span>HASŁO TYMCZASOWE</span><strong>{credential.password}</strong></div>
              <button className="saas-button dark wide" onClick={copyCredentials}>Kopiuj dane logowania</button>
            </div>
          ) : (
            <div className="credential-empty">Wygeneruj pierwsze konto, aby zobaczyć dane dostępowe.</div>
          )}
        </section>
      </div>
      <section className="account-list-card">
        <div className="admin-card-title"><span>03</span><div><h2>Aktywne konta</h2><p>{accounts.length} użytkowników ma obecnie dostęp.</p></div></div>
        <div className="account-table">
          {accounts.map((account) => (
            <div className="account-row" key={account.username}>
              <span className="account-avatar">{account.displayName.slice(0, 1).toUpperCase()}</span>
              <div><strong>{account.displayName}</strong><small>@{account.username}</small></div>
              <span className={`password-state ${account.mustChangePassword ? "waiting" : ""}`}>{account.mustChangePassword ? "Hasło tymczasowe" : "Hasło zmienione"}</span>
              <time>{new Date(account.createdAt).toLocaleDateString("pl-PL")}</time>
              <button onClick={() => deactivate(account.username)}>Wyłącz dostęp</button>
            </div>
          ))}
          {!accounts.length && <p className="empty-row">Nie utworzono jeszcze żadnych kont.</p>}
        </div>
      </section>
    </main>
  );
}
