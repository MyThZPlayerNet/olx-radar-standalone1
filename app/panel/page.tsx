"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  Account,
  PublicOffer,
  RadarConfig,
  RadarStatus,
} from "@/lib/types";

type ConfigResponse = {
  account: Account;
  config: RadarConfig;
};

type Preview = {
  fetched: number;
  matched: number;
  offers: PublicOffer[];
};

const emptyStatus: RadarStatus = {
  active: false,
  initialized: false,
  lastCheckAt: null,
  lastError: null,
  lastFetched: 0,
  lastMatched: 0,
  lastSent: 0,
  nextCheckAt: null,
  webhookConfigured: false,
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  if (response.status === 401) {
    window.location.replace("/");
    throw new Error("Sesja wygasła.");
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Operacja nie powiodła się.");
  return data;
}

function listFromText(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value: string | null): string {
  if (!value) return "Jeszcze nie";
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

export default function UserPanel() {
  const [account, setAccount] = useState<Account | null>(null);
  const [config, setConfig] = useState<RadarConfig | null>(null);
  const [status, setStatus] = useState<RadarStatus>(emptyStatus);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ error?: boolean; text: string } | null>(
    null,
  );
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    repeat: "",
  });

  const notify = useCallback((text: string, error = false) => {
    setMessage({ error, text });
    window.setTimeout(() => setMessage(null), 4500);
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await api<RadarStatus>("/api/me/status"));
    } catch {
      // The shared API helper handles an expired session.
    }
  }, []);

  useEffect(() => {
    Promise.all([
      api<ConfigResponse>("/api/me/config"),
      api<RadarStatus>("/api/me/status"),
    ])
      .then(([configResult, statusResult]) => {
        setAccount(configResult.account);
        setConfig(configResult.config);
        setStatus(statusResult);
      })
      .catch((error: Error) => notify(error.message, true));
  }, [notify]);

  useEffect(() => {
    const timer = window.setInterval(refreshStatus, 10_000);
    return () => window.clearInterval(timer);
  }, [refreshStatus]);

  useEffect(() => {
    if (!status.active) return;
    const check = () =>
      api<RadarStatus & { offers?: PublicOffer[] }>("/api/me/check", {
        method: "POST",
        body: "{}",
      })
        .then((result) => {
          setStatus(result);
          if (result.offers?.length) {
            setPreview({
              fetched: result.lastFetched,
              matched: result.lastMatched,
              offers: result.offers,
            });
          }
        })
        .catch((error: Error) => notify(error.message, true));
    void check();
    const timer = window.setInterval(check, 15_000);
    return () => window.clearInterval(timer);
  }, [notify, status.active]);

  const priceLabel = useMemo(() => {
    if (!config) return "—";
    const from = config.minPrice?.toLocaleString("pl-PL") ?? "0";
    const to = config.maxPrice?.toLocaleString("pl-PL") ?? "∞";
    return `${from}–${to} zł`;
  }, [config]);

  function patch(update: Partial<RadarConfig>) {
    setConfig((current) => (current ? { ...current, ...update } : current));
  }

  async function save(silent = false): Promise<boolean> {
    if (!config) return false;
    setBusy("save");
    try {
      const result = await api<{ config: RadarConfig; message: string }>(
        "/api/me/config",
        {
          method: "PUT",
          body: JSON.stringify({ ...config, webhookUrl }),
        },
      );
      setConfig(result.config);
      setWebhookUrl("");
      if (!silent) notify(result.message);
      await refreshStatus();
      return true;
    } catch (error) {
      notify((error as Error).message, true);
      return false;
    } finally {
      setBusy("");
    }
  }

  async function loadPreview() {
    if (!(await save(true))) return;
    setBusy("preview");
    try {
      const result = await api<Preview>("/api/me/preview", {
        method: "POST",
        body: "{}",
      });
      setPreview(result);
      notify(
        result.matched
          ? `Znaleziono ${result.matched} pasujących ofert.`
          : "Brak ofert spełniających obecne filtry.",
      );
      document.querySelector("#offers")?.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setBusy("");
    }
  }

  async function toggleRadar() {
    if (!config) return;
    if (!status.active && !(await save(true))) return;
    setBusy("toggle");
    try {
      const result = await api<{ message: string; status: RadarStatus }>(
        "/api/me/toggle",
        {
          method: "POST",
          body: JSON.stringify({ active: !status.active }),
        },
      );
      setStatus(result.status);
      patch({ active: result.status.active });
      notify(result.message);
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setBusy("");
    }
  }

  async function testDiscord() {
    if (!(await save(true))) return;
    setBusy("discord");
    try {
      const result = await api<{ message: string }>("/api/me/test-discord", {
        method: "POST",
        body: "{}",
      });
      notify(result.message);
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setBusy("");
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
    window.location.assign("/");
  }

  async function changePassword() {
    if (passwords.next !== passwords.repeat) {
      notify("Nowe hasła nie są identyczne.", true);
      return;
    }
    setBusy("password");
    try {
      const result = await api<{ message: string }>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.next,
        }),
      });
      window.alert(result.message);
      window.location.assign("/");
    } catch (error) {
      notify((error as Error).message, true);
      setBusy("");
    }
  }

  if (!config || !account) {
    return (
      <main className="panel-loading">
        <span className="saas-brand-mark">R</span>
        <div><strong>OLX Radar</strong><p>Ładuję Twój prywatny panel…</p></div>
      </main>
    );
  }

  return (
    <div className="dashboard-shell">
      <aside className="dash-sidebar">
        <a className="saas-brand" href="#top">
          <span className="saas-brand-mark">R</span><span>OLX Radar</span>
        </a>
        <nav>
          <a href="#overview"><span>01</span> Przegląd</a>
          <a href="#search"><span>02</span> Wyszukiwanie</a>
          <a href="#filters"><span>03</span> Filtry</a>
          <a href="#discord"><span>04</span> Discord</a>
          <a href="#offers"><span>05</span> Wyniki</a>
        </nav>
        <div className="dash-user">
          <span>{account.displayName.slice(0, 1).toUpperCase()}</span>
          <div><strong>{account.displayName}</strong><small>@{account.username}</small></div>
        </div>
      </aside>

      <main className="dash-main" id="top">
        <header className="dash-topbar">
          <div>
            <p className="saas-eyebrow">PRYWATNY PANEL</p>
            <span className={`live-label ${status.active ? "on" : ""}`}>
              <i /> {status.active ? "Radar aktywny" : "Radar zatrzymany"}
            </span>
          </div>
          <div className="dash-actions">
            {account.role === "admin" && (
              <a className="saas-button subtle" href="/admin">Konta użytkowników</a>
            )}
            <button className="saas-button subtle" onClick={logout}>Wyloguj</button>
            <button
              className="saas-button primary"
              disabled={busy === "save"}
              onClick={() => save()}
            >
              {busy === "save" ? "Zapisuję…" : "Zapisz ustawienia"}
            </button>
          </div>
        </header>

        {account.mustChangePassword && (
          <section className="password-banner">
            <div>
              <p className="saas-eyebrow">PIERWSZE LOGOWANIE</p>
              <h2>Ustaw własne hasło</h2>
              <p>Hasło tymczasowe służy tylko do pierwszego wejścia.</p>
            </div>
            <div className="password-fields">
              <input
                type="password"
                placeholder="Hasło tymczasowe"
                value={passwords.current}
                onChange={(event) =>
                  setPasswords({ ...passwords, current: event.target.value })
                }
              />
              <input
                type="password"
                placeholder="Nowe bezpieczne hasło"
                value={passwords.next}
                onChange={(event) =>
                  setPasswords({ ...passwords, next: event.target.value })
                }
              />
              <input
                type="password"
                placeholder="Powtórz nowe hasło"
                value={passwords.repeat}
                onChange={(event) =>
                  setPasswords({ ...passwords, repeat: event.target.value })
                }
              />
              <button
                className="saas-button dark"
                disabled={busy === "password"}
                onClick={changePassword}
              >
                Zmień hasło
              </button>
            </div>
          </section>
        )}

        {!account.mustChangePassword && (
          <details className="account-security-card">
            <summary>Zmień hasło do konta</summary>
            <div className="password-fields">
              <input
                type="password"
                placeholder="Obecne hasło"
                value={passwords.current}
                onChange={(event) =>
                  setPasswords({ ...passwords, current: event.target.value })
                }
              />
              <input
                type="password"
                placeholder="Nowe bezpieczne hasło"
                value={passwords.next}
                onChange={(event) =>
                  setPasswords({ ...passwords, next: event.target.value })
                }
              />
              <input
                type="password"
                placeholder="Powtórz nowe hasło"
                value={passwords.repeat}
                onChange={(event) =>
                  setPasswords({ ...passwords, repeat: event.target.value })
                }
              />
              <button
                className="saas-button dark"
                disabled={busy === "password"}
                onClick={changePassword}
              >
                Zapisz nowe hasło
              </button>
            </div>
          </details>
        )}

        <section className="radar-hero" id="overview">
          <div>
            <p className="saas-eyebrow">TWÓJ RADAR</p>
            <h1>
              {config.query}
              <em>{priceLabel}</em>
            </h1>
            <p>
              {config.name} sprawdza nowe ogłoszenia co {config.intervalSeconds} sekund
              i wysyła tylko te, które przejdą wszystkie Twoje filtry.
            </p>
            <div className="radar-buttons">
              <button
                className={`saas-button radar-toggle ${status.active ? "stop" : ""}`}
                disabled={busy === "toggle" || account.mustChangePassword}
                onClick={toggleRadar}
              >
                {status.active ? "Zatrzymaj radar" : "Uruchom radar"}
              </button>
              <button
                className="saas-button outline"
                disabled={busy === "preview" || account.mustChangePassword}
                onClick={loadPreview}
              >
                {busy === "preview" ? "Sprawdzam…" : "Podejrzyj wyniki"}
              </button>
            </div>
          </div>
          <div className="radar-visual" aria-hidden="true">
            <i className="ring one" /><i className="ring two" /><i className="sweep" />
            <span>{config.query.slice(0, 18)}</span>
          </div>
        </section>

        <section className="metric-row">
          <Metric label="Ostatnie sprawdzenie" value={formatDate(status.lastCheckAt)} />
          <Metric label="Pobrane" value={String(status.lastFetched || "—")} />
          <Metric label="Pasujące" value={String(status.lastMatched || "—")} />
          <Metric label="Wysłane" value={String(status.lastSent || "—")} />
        </section>

        {status.lastError && (
          <div className="dash-alert" role="alert">{status.lastError}</div>
        )}

        <Section id="search" number="01" kicker="WYSZUKIWANIE" title="Co obserwujemy?">
          <div className="form-grid">
            <Field label="Nazwa radaru" wide>
              <input value={config.name} onChange={(e) => patch({ name: e.target.value })} />
            </Field>
            <Field label="Link wyszukiwania OLX" wide>
              <input value={config.olxUrl} onChange={(e) => patch({ olxUrl: e.target.value })} />
            </Field>
            <Field label="Fraza">
              <input value={config.query} onChange={(e) => patch({ query: e.target.value })} />
            </Field>
            <Field label="ID kategorii">
              <input type="number" min="0" value={config.categoryId} onChange={(e) => patch({ categoryId: Number(e.target.value) })} />
            </Field>
            <Field label="Cena od">
              <input type="number" min="0" value={config.minPrice ?? ""} onChange={(e) => patch({ minPrice: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Cena do">
              <input type="number" min="0" value={config.maxPrice ?? ""} onChange={(e) => patch({ maxPrice: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Sprawdzaj co (sek.)">
              <input type="number" min="30" max="86400" value={config.intervalSeconds} onChange={(e) => patch({ intervalSeconds: Number(e.target.value) })} />
            </Field>
            <Field label="Maksymalny wiek (min.)">
              <input type="number" min="0" value={config.maxAgeMinutes} onChange={(e) => patch({ maxAgeMinutes: Number(e.target.value) })} />
            </Field>
          </div>
        </Section>

        <Section id="filters" number="02" kicker="SELEKCJA" title="Filtry pod Twój cel">
          <div className="form-grid">
            <Field label="Musi zawierać — oddziel przecinkami" wide>
              <input value={config.includeKeywords.join(", ")} onChange={(e) => patch({ includeKeywords: listFromText(e.target.value) })} placeholder="np. pro, 256gb" />
            </Field>
            <Field label="Odrzuć, jeśli zawiera" wide>
              <input value={config.excludeKeywords.join(", ")} onChange={(e) => patch({ excludeKeywords: listFromText(e.target.value) })} placeholder="np. uszkodzony, zamienię" />
            </Field>
            <Field label="Lokalizacje" wide>
              <input value={config.locations.join(", ")} onChange={(e) => patch({ locations: listFromText(e.target.value) })} placeholder="Pusto = cała Polska" />
            </Field>
            <Field label="Sprzedający">
              <select value={config.sellerType} onChange={(e) => patch({ sellerType: e.target.value as RadarConfig["sellerType"] })}>
                <option value="all">Wszyscy</option>
                <option value="private">Osoby prywatne</option>
                <option value="business">Firmy</option>
              </select>
            </Field>
            <div className="field-card">
              <span>Stan przedmiotu</span>
              <div className="choice-row">
                {[
                  ["new", "Nowe"],
                  ["used", "Używane"],
                  ["damaged", "Uszkodzone"],
                ].map(([value, label]) => (
                  <label className="choice" key={value}>
                    <input
                      checked={config.conditions.includes(value)}
                      onChange={(e) =>
                        patch({
                          conditions: e.target.checked
                            ? [...config.conditions, value]
                            : config.conditions.filter((item) => item !== value),
                        })
                      }
                      type="checkbox"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <Toggle label="Wymagaj wszystkich słów" checked={config.matchAllKeywords} onChange={(value) => patch({ matchAllKeywords: value })} />
            <Toggle label="Tylko z dostawą OLX" checked={config.deliveryRequired} onChange={(value) => patch({ deliveryRequired: value })} />
            <Toggle label="Pomiń promowane" checked={config.skipPromoted} onChange={(value) => patch({ skipPromoted: value })} />
          </div>
        </Section>

        <Section id="discord" number="03" kicker="POWIADOMIENIA" title="Twój kanał Discord">
          <div className="discord-grid">
            <div className="discord-mock">
              <span className="discord-logo">R</span>
              <div>
                <p><strong>{config.discordUsername}</strong> <b>BOT</b> <small>dzisiaj, 12:04</small></p>
                <article style={{ borderColor: `#${config.discordColor.toString(16).padStart(6, "0")}` }}>
                  <strong>iPhone 15 Pro 256 GB — świetny stan</strong>
                  <p>Nowe ogłoszenie spełnia wszystkie ustawione filtry.</p>
                  <dl><div><dt>Cena</dt><dd>3 899 zł</dd></div><div><dt>Lokalizacja</dt><dd>Warszawa</dd></div></dl>
                </article>
              </div>
            </div>
            <div className="discord-settings">
              <div className={`connection-state ${config.webhookConfigured ? "connected" : ""}`}>
                <i /> {config.webhookConfigured ? "Webhook zapisany i zaszyfrowany" : "Webhook nie jest jeszcze ustawiony"}
              </div>
              <Field label={config.webhookConfigured ? "Nowy webhook (opcjonalnie)" : "Webhook Discord"}>
                <input type="password" autoComplete="off" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/…" />
              </Field>
              <Field label="Nazwa nadawcy">
                <input value={config.discordUsername} onChange={(e) => patch({ discordUsername: e.target.value })} />
              </Field>
              <Field label="ID roli do oznaczenia">
                <input value={config.discordRoleId} onChange={(e) => patch({ discordRoleId: e.target.value })} placeholder="Opcjonalnie" />
              </Field>
              <button className="saas-button discord-button" disabled={busy === "discord" || account.mustChangePassword} onClick={testDiscord}>
                {busy === "discord" ? "Wysyłam…" : "Wyślij wiadomość testową"}
              </button>
            </div>
          </div>
        </Section>

        <Section id="offers" number="04" kicker="PODGLĄD" title="Pasujące ogłoszenia">
          {preview ? (
            <>
              <p className="offer-summary">
                Pobrano {preview.fetched}, pasuje <strong>{preview.matched}</strong>.
              </p>
              <div className="offer-list">
                {preview.offers.map((offer) => (
                  <article className="offer-tile" key={offer.id}>
                    <div className="offer-image">
                      {offer.imageUrl ? <img alt="" src={offer.imageUrl} /> : <span>Brak zdjęcia</span>}
                    </div>
                    <div>
                      <small>{offer.location || "Brak lokalizacji"}</small>
                      <h3>{offer.title}</h3>
                      <strong>{offer.priceLabel || "Brak ceny"}</strong>
                      <a href={offer.url} rel="noreferrer" target="_blank">Otwórz na OLX ↗</a>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-offers">
              <div className="mini-radar"><i /></div>
              <h3>Sprawdź filtry bez wysyłania</h3>
              <p>Kliknij „Podejrzyj wyniki”, aby zobaczyć aktualne dopasowania.</p>
            </div>
          )}
        </Section>

        <footer className="dash-footer">
          <span>OLX Radar • prywatna konfiguracja @{account.username}</span>
          <span>Webhook nigdy nie jest wyświetlany po zapisaniu.</span>
        </footer>
      </main>
      {message && (
        <div className={`saas-toast ${message.error ? "error" : ""}`} role="status">
          <i>{message.error ? "!" : "✓"}</i>{message.text}
        </div>
      )}
    </div>
  );
}

function Section({
  children,
  id,
  kicker,
  number,
  title,
}: {
  children: ReactNode;
  id: string;
  kicker: string;
  number: string;
  title: string;
}) {
  return (
    <section className="dash-section" id={id}>
      <div className="section-title">
        <span>{number}</span>
        <div><p className="saas-eyebrow">{kicker}</p><h2>{title}</h2></div>
      </div>
      {children}
    </section>
  );
}

function Field({
  children,
  label,
  wide = false,
}: {
  children: ReactNode;
  label: string;
  wide?: boolean;
}) {
  return (
    <label className={`field-card ${wide ? "wide" : ""}`}>
      <span>{label}</span>{children}
    </label>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="toggle-card">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="dash-metric"><span>{label}</span><strong>{value}</strong></div>;
}
