"use client";

import { useEffect, useState, type FormEvent } from "react";
import type {
  Account,
  AdminAccountOverview,
  Platform,
  RadarSearch,
} from "@/lib/types";

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

function formatDate(value: string | null): string {
  if (!value) return "Brak";
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Europe/Warsaw",
  }).format(new Date(normalized));
}

function priceRange(search: RadarSearch): string {
  const from = search.minPrice?.toLocaleString("pl-PL") ?? "0";
  const to = search.maxPrice?.toLocaleString("pl-PL") ?? "∞";
  return `${from}–${to} zł`;
}

export default function AdminPage() {
  const [accounts, setAccounts] = useState<AdminAccountOverview[]>([]);
  const [form, setForm] = useState({ displayName: "", username: "" });
  const [credential, setCredential] = useState<{
    displayName: string;
    password: string;
    username: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyRadar, setBusyRadar] = useState("");
  const [error, setError] = useState("");

  async function loadAccounts() {
    const result = await api<{ accounts: AdminAccountOverview[] }>(
      "/api/admin/accounts",
    );
    setAccounts(result.accounts);
  }

  useEffect(() => {
    void api<{ accounts: AdminAccountOverview[] }>("/api/admin/accounts")
      .then((result) => setAccounts(result.accounts))
      .catch((reason: Error) => setError(reason.message));
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

  async function toggleRadar(
    username: string,
    platform: Platform,
    active: boolean,
  ) {
    const key = `${username}:${platform}`;
    setBusyRadar(key);
    setError("");
    try {
      await api("/api/admin/accounts", {
        method: "PATCH",
        body: JSON.stringify({ active, platform, username }),
      });
      await loadAccounts();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusyRadar("");
    }
  }

  async function copyCredentials() {
    if (!credential) return;
    await navigator.clipboard.writeText(
      `Radar Market\nLogin: ${credential.username}\nHasło tymczasowe: ${credential.password}`,
    );
  }

  const activeRadars = accounts.reduce(
    (total, account) =>
      total +
      Number(account.radars.olx?.status.active) +
      Number(account.radars.vinted?.status.active),
    0,
  );
  const configuredSearches = accounts.reduce(
    (total, account) =>
      total +
      (account.radars.olx?.config.searches.length ?? 0) +
      (account.radars.vinted?.config.searches.length ?? 0),
    0,
  );
  const usersSearching = accounts.filter(
    (account) =>
      account.radars.olx?.status.active ||
      account.radars.vinted?.status.active,
  ).length;

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a className="saas-brand" href="/panel"><span className="saas-brand-mark">R</span><span>Radar Market</span></a>
        <a className="saas-button subtle" href="/panel">← Wróć do radaru</a>
      </header>
      <section className="admin-intro">
        <p className="saas-eyebrow">CENTRUM ADMINISTRACYJNE</p>
        <h1>Użytkownicy i radary</h1>
        <p>
          Twórz konta, sprawdzaj czego szukają użytkownicy i kontroluj działanie
          ich radarów.
        </p>
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
      <section className="admin-monitor">
        <div className="admin-card-title">
          <span>03</span>
          <div>
            <h2>Monitoring użytkowników</h2>
            <p>Aktualna konfiguracja i stan wszystkich radarów.</p>
          </div>
        </div>

        <div className="admin-overview-metrics">
          <div><span>Użytkownicy</span><strong>{accounts.length}</strong></div>
          <div><span>Teraz wyszukuje</span><strong>{usersSearching}</strong></div>
          <div><span>Aktywne radary</span><strong>{activeRadars}</strong></div>
          <div><span>Wyszukiwania</span><strong>{configuredSearches}</strong></div>
        </div>

        {error && <p className="admin-global-error">{error}</p>}

        <div className="admin-user-list">
          {accounts.map((account) => (
            <article className="admin-user-card" key={account.username}>
              <header className="admin-user-head">
                <span className="account-avatar">
                  {account.displayName.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>{account.displayName}</strong>
                  <small>@{account.username}</small>
                </div>
                <div className="admin-user-presence">
                  <span
                    className={
                      account.radars.olx?.status.active ||
                      account.radars.vinted?.status.active
                        ? "searching"
                        : ""
                    }
                  >
                    <i />
                    {account.radars.olx?.status.active ||
                    account.radars.vinted?.status.active
                      ? "Wyszukuje"
                      : "Radary wyłączone"}
                  </span>
                  <small>Ostatnie logowanie: {formatDate(account.lastLoginAt)}</small>
                </div>
                <span
                  className={`password-state ${
                    account.mustChangePassword ? "waiting" : ""
                  }`}
                >
                  {account.mustChangePassword
                    ? "Hasło tymczasowe"
                    : "Hasło zmienione"}
                </span>
                <button
                  className="admin-disable-user"
                  onClick={() => deactivate(account.username)}
                >
                  Wyłącz konto
                </button>
              </header>

              <div className="admin-radar-grid">
                {(["olx", "vinted"] as const).map((platform) => {
                  const radar = account.radars[platform];
                  if (!radar) {
                    return (
                      <section className="admin-radar-card missing" key={platform}>
                        Brak konfiguracji {platform.toUpperCase()}
                      </section>
                    );
                  }
                  const actionKey = `${account.username}:${platform}`;
                  return (
                    <section
                      className={`admin-radar-card ${
                        radar.status.active ? "active" : ""
                      }`}
                      key={platform}
                    >
                      <header>
                        <span className="admin-market-icon">
                          {platform === "olx" ? "O" : "V"}
                        </span>
                        <div>
                          <strong>
                            {platform === "olx" ? "OLX" : "Vinted"}
                          </strong>
                          <small>
                            {radar.status.active
                              ? `Aktywny · co ${radar.config.intervalSeconds} sek.`
                              : "Zatrzymany"}
                          </small>
                        </div>
                        <button
                          className={radar.status.active ? "stop" : ""}
                          disabled={busyRadar === actionKey}
                          onClick={() =>
                            toggleRadar(
                              account.username,
                              platform,
                              !radar.status.active,
                            )
                          }
                        >
                          {busyRadar === actionKey
                            ? "Zapisuję…"
                            : radar.status.active
                              ? "Zatrzymaj"
                              : "Uruchom"}
                        </button>
                      </header>

                      <div className="admin-radar-stats">
                        <div>
                          <span>Ostatnio</span>
                          <strong>{formatDate(radar.status.lastCheckAt)}</strong>
                        </div>
                        <div>
                          <span>Pobrane</span>
                          <strong>{radar.status.lastFetched}</strong>
                        </div>
                        <div>
                          <span>Pasujące</span>
                          <strong>{radar.status.lastMatched}</strong>
                        </div>
                        <div>
                          <span>Wysłane</span>
                          <strong>{radar.status.lastSent}</strong>
                        </div>
                      </div>

                      {radar.status.lastError && (
                        <p className="admin-radar-error">
                          {radar.status.lastError}
                        </p>
                      )}

                      <div className="admin-search-list">
                        {radar.config.searches.map((search) => (
                          <div className="admin-search-row" key={search.id}>
                            <div>
                              <strong>{search.name}</strong>
                              <small>
                                {search.query} · {priceRange(search)}
                              </small>
                            </div>
                            <span
                              className={
                                search.webhookConfigured ? "configured" : ""
                              }
                            >
                              {search.webhookConfigured
                                ? "Kanał OK"
                                : "Brak kanału"}
                            </span>
                            <a
                              href={search.sourceUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Otwórz wyszukiwanie ↗
                            </a>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </article>
          ))}
          {!accounts.length && (
            <p className="empty-row">Nie utworzono jeszcze żadnych kont.</p>
          )}
        </div>
      </section>
    </main>
  );
}
