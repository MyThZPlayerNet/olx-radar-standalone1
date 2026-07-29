"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import type {
  Account,
  Platform,
  PublicOffer,
  RadarConfig,
  RadarSearch,
  RadarStatus,
} from "@/lib/types";

type RadarMap<T> = Record<Platform, T>;

type ConfigResponse = {
  account: Account;
  configs: RadarMap<RadarConfig>;
};

type Preview = {
  fetched: number;
  matched: number;
  offers: PublicOffer[];
};

type PreviewMap = Partial<Record<Platform, Record<string, Preview>>>;
type WebhookDraftMap = Record<Platform, Record<string, string>>;

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

const marketCopy = {
  olx: {
    label: "OLX",
    short: "Ogłoszenia lokalne i wysyłkowe",
    sourceLabel: "Link wyszukiwania OLX",
  },
  vinted: {
    label: "Vinted",
    short: "Moda, elektronika i okazje",
    sourceLabel: "Link wyników Vinted",
  },
} satisfies Record<
  Platform,
  { label: string; short: string; sourceLabel: string }
>;

const conditionOptions: RadarMap<Array<[string, string]>> = {
  olx: [
    ["new", "Nowe"],
    ["used", "Używane"],
    ["damaged", "Uszkodzone"],
  ],
  vinted: [
    ["Nowy z metką", "Nowy z metką"],
    ["Nowy bez metki", "Nowy bez metki"],
    ["Bardzo dobry", "Bardzo dobry"],
    ["Dobry", "Dobry"],
    ["Zadowalający", "Zadowalający"],
  ],
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
  const normalizedValue = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(
    value,
  )
    ? `${value.replace(" ", "T")}Z`
    : value;
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Europe/Warsaw",
  }).format(new Date(normalizedValue));
}

export default function UserPanel() {
  const [account, setAccount] = useState<Account | null>(null);
  const [configs, setConfigs] = useState<RadarMap<RadarConfig> | null>(null);
  const [statuses, setStatuses] = useState<RadarMap<RadarStatus>>({
    olx: emptyStatus,
    vinted: emptyStatus,
  });
  const [previews, setPreviews] = useState<PreviewMap>({});
  const [webhooks, setWebhooks] = useState<WebhookDraftMap>({
    olx: {},
    vinted: {},
  });
  const [platform, setPlatform] = useState<Platform>("olx");
  const [activeSearchIds, setActiveSearchIds] = useState<RadarMap<string>>({
    olx: "",
    vinted: "",
  });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{
    error?: boolean;
    text: string;
  } | null>(null);
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    repeat: "",
  });

  const config = configs?.[platform] ?? null;
  const search =
    config?.searches.find(
      (item) => item.id === activeSearchIds[platform],
    ) ??
    config?.searches[0] ??
    null;
  const status = statuses[platform];
  const preview = search ? previews[platform]?.[search.id] : undefined;
  const market = marketCopy[platform];

  const notify = useCallback((text: string, error = false) => {
    setMessage({ error, text });
    window.setTimeout(() => setMessage(null), 4500);
  }, []);

  const refreshStatuses = useCallback(async () => {
    try {
      setStatuses(await api<RadarMap<RadarStatus>>("/api/me/status"));
    } catch {
      // The shared API helper handles an expired session.
    }
  }, []);

  useEffect(() => {
    Promise.all([
      api<ConfigResponse>("/api/me/config"),
      api<RadarMap<RadarStatus>>("/api/me/status"),
    ])
      .then(([configResult, statusResult]) => {
        setAccount(configResult.account);
        setConfigs(configResult.configs);
        setStatuses(statusResult);
        setActiveSearchIds({
          olx: configResult.configs.olx.searches[0]?.id ?? "",
          vinted: configResult.configs.vinted.searches[0]?.id ?? "",
        });
      })
      .catch((error: Error) => notify(error.message, true));
  }, [notify]);

  useEffect(() => {
    const timer = window.setInterval(refreshStatuses, 10_000);
    return () => window.clearInterval(timer);
  }, [refreshStatuses]);

  useEffect(() => {
    if (!status.active) return;
    const selectedPlatform = platform;
    const check = () =>
      api<RadarStatus & { offers?: PublicOffer[] }>("/api/me/check", {
        method: "POST",
        body: JSON.stringify({ platform: selectedPlatform }),
      })
        .then((result) => {
          setStatuses((current) => ({
            ...current,
            [selectedPlatform]: result,
          }));
        })
        .catch((error: Error) => notify(error.message, true));
    void check();
    const timer = window.setInterval(check, 15_000);
    return () => window.clearInterval(timer);
  }, [notify, platform, status.active]);

  const priceLabel = useMemo(() => {
    if (!search) return "—";
    const from = search.minPrice?.toLocaleString("pl-PL") ?? "0";
    const to = search.maxPrice?.toLocaleString("pl-PL") ?? "∞";
    return `${from}–${to} zł`;
  }, [search]);

  const activeCount = Number(statuses.olx.active) + Number(statuses.vinted.active);

  function patch(update: Partial<RadarConfig>) {
    setConfigs((current) =>
      current
        ? {
            ...current,
            [platform]: { ...current[platform], ...update },
          }
        : current,
    );
  }

  function patchSearch(update: Partial<RadarSearch>) {
    if (!search) return;
    setConfigs((current) => {
      if (!current) return current;
      const selectedConfig = current[platform];
      const searches = selectedConfig.searches.map((item) =>
        item.id === search.id ? { ...item, ...update } : item,
      );
      const nextConfig: RadarConfig = {
        ...selectedConfig,
        searches,
      };
      if (selectedConfig.searches[0]?.id === search.id) {
        Object.assign(nextConfig, update);
      }
      return {
        ...current,
        [platform]: nextConfig,
      };
    });
  }

  function addSearch() {
    if (!config || !search) return;
    if (config.searches.length >= 10) {
      notify("Możesz utworzyć maksymalnie 10 zakładek.", true);
      return;
    }
    const id =
      typeof crypto.randomUUID === "function"
        ? `search-${crypto.randomUUID()}`
        : `search-${Date.now()}`;
    const next: RadarSearch = {
      ...search,
      id,
      name: `${market.label} — wyszukiwanie ${config.searches.length + 1}`,
      webhookConfigured: false,
    };
    patch({ searches: [...config.searches, next] });
    setActiveSearchIds((current) => ({ ...current, [platform]: id }));
    setPreviews((current) => ({ ...current, [platform]: {} }));
    window.setTimeout(
      () => document.querySelector("#search")?.scrollIntoView({ behavior: "smooth" }),
      0,
    );
  }

  function removeSearch() {
    if (!config || !search || config.searches.length === 1) return;
    if (
      !window.confirm(
        `Usunąć zakładkę „${search.name}”? Zmiana zostanie utrwalona po zapisaniu.`,
      )
    ) {
      return;
    }
    const searches = config.searches.filter((item) => item.id !== search.id);
    patch({ searches });
    setActiveSearchIds((current) => ({
      ...current,
      [platform]: searches[0]?.id ?? "",
    }));
    setPreviews((current) => ({ ...current, [platform]: {} }));
  }

  async function save(
    selectedPlatform: Platform = platform,
    silent = false,
  ): Promise<boolean> {
    const selectedConfig = configs?.[selectedPlatform];
    if (!selectedConfig) return false;
    const selectedSearchId =
      activeSearchIds[selectedPlatform] ||
      selectedConfig.searches[0]?.id ||
      "";
    setBusy(`save:${selectedPlatform}`);
    try {
      const result = await api<{ config: RadarConfig; message: string }>(
        "/api/me/config",
        {
          method: "PUT",
          body: JSON.stringify({
            ...selectedConfig,
            platform: selectedPlatform,
            webhookSearchId: selectedSearchId,
            webhookUrl: webhooks[selectedPlatform][selectedSearchId] ?? "",
          }),
        },
      );
      setConfigs((current) =>
        current
          ? { ...current, [selectedPlatform]: result.config }
          : current,
      );
      setWebhooks((current) => ({
        ...current,
        [selectedPlatform]: {
          ...current[selectedPlatform],
          [selectedSearchId]: "",
        },
      }));
      if (!silent) notify(result.message);
      await refreshStatuses();
      return true;
    } catch (error) {
      notify((error as Error).message, true);
      return false;
    } finally {
      setBusy("");
    }
  }

  async function loadPreview() {
    const selectedPlatform = platform;
    const selectedSearchId = search?.id;
    if (!selectedSearchId) return;
    if (!(await save(selectedPlatform, true))) return;
    setBusy(`preview:${selectedPlatform}`);
    try {
      const result = await api<Preview>("/api/me/preview", {
        method: "POST",
        body: JSON.stringify({
          platform: selectedPlatform,
          searchId: selectedSearchId,
        }),
      });
      setPreviews((current) => ({
        ...current,
        [selectedPlatform]: {
          ...(current[selectedPlatform] ?? {}),
          [selectedSearchId]: result,
        },
      }));
      notify(
        result.matched
          ? `Znaleziono ${result.matched} pasujących ofert ${marketCopy[selectedPlatform].label}.`
          : `Brak ofert ${marketCopy[selectedPlatform].label} spełniających filtry.`,
      );
      document.querySelector("#offers")?.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setBusy("");
    }
  }

  async function toggleRadar() {
    const selectedPlatform = platform;
    const selectedStatus = statuses[selectedPlatform];
    if (!selectedStatus.active && !(await save(selectedPlatform, true))) return;
    setBusy(`toggle:${selectedPlatform}`);
    try {
      const result = await api<{ message: string; status: RadarStatus }>(
        "/api/me/toggle",
        {
          method: "POST",
          body: JSON.stringify({
            active: !selectedStatus.active,
            platform: selectedPlatform,
          }),
        },
      );
      setStatuses((current) => ({
        ...current,
        [selectedPlatform]: result.status,
      }));
      setConfigs((current) =>
        current
          ? {
              ...current,
              [selectedPlatform]: {
                ...current[selectedPlatform],
                active: result.status.active,
              },
            }
          : current,
      );
      notify(result.message);
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setBusy("");
    }
  }

  async function testDiscord() {
    const selectedPlatform = platform;
    if (!(await save(selectedPlatform, true))) return;
    setBusy(`discord:${selectedPlatform}`);
    try {
      const result = await api<{ message: string }>("/api/me/test-discord", {
        method: "POST",
        body: JSON.stringify({
          platform: selectedPlatform,
          searchId: search?.id,
        }),
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

  if (!configs || !config || !search || !account) {
    return (
      <main className="panel-loading">
        <span className="saas-brand-mark">R</span>
        <div>
          <strong>Radar Market</strong>
          <p>Ładuję Twój prywatny panel…</p>
        </div>
      </main>
    );
  }

  const isBusy = (action: string) => busy === `${action}:${platform}`;

  return (
    <div className={`dashboard-shell market-${platform}`}>
      <aside className="dash-sidebar">
        <a className="saas-brand" href="#top">
          <span className="saas-brand-mark">R</span>
          <span>Radar Market</span>
        </a>
        <nav>
          <a href="#overview"><span>01</span> Przegląd</a>
          <a href="#search"><span>02</span> Wyszukiwanie</a>
          <a href="#filters"><span>03</span> Filtry</a>
          <a href="#discord"><span>04</span> Discord</a>
          <a href="#offers"><span>05</span> Wyniki</a>
        </nav>
        <div className="sidebar-radars">
          <span className={statuses.olx.active ? "active" : ""}>
            <i /> OLX
          </span>
          <span className={statuses.vinted.active ? "active" : ""}>
            <i /> Vinted
          </span>
        </div>
        <div className="dash-user">
          <span>{account.displayName.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{account.displayName}</strong>
            <small>@{account.username} · aktywne: {activeCount}/2</small>
          </div>
        </div>
      </aside>

      <main className="dash-main" id="top">
        <header className="dash-topbar">
          <div>
            <p className="saas-eyebrow">PRYWATNY PANEL</p>
            <span className={`live-label ${status.active ? "on" : ""}`}>
              <i /> {market.label}: {status.active ? "radar aktywny" : "radar zatrzymany"}
            </span>
          </div>
          <div className="dash-actions">
            {account.role === "admin" && (
              <a className="saas-button subtle" href="/admin">
                Konta użytkowników
              </a>
            )}
            <button className="saas-button subtle" onClick={logout}>
              Wyloguj
            </button>
            <button
              className="saas-button primary"
              disabled={isBusy("save")}
              onClick={() => save()}
            >
              {isBusy("save") ? "Zapisuję…" : `Zapisz ${market.label}`}
            </button>
          </div>
        </header>

        {account.mustChangePassword ? (
          <section className="password-banner">
            <div>
              <p className="saas-eyebrow">PIERWSZE LOGOWANIE</p>
              <h2>Ustaw własne hasło</h2>
              <p>Hasło tymczasowe służy tylko do pierwszego wejścia.</p>
            </div>
            <PasswordFields
              busy={busy === "password"}
              buttonLabel="Zmień hasło"
              passwords={passwords}
              setPasswords={setPasswords}
              onSubmit={changePassword}
            />
          </section>
        ) : (
          <details className="account-security-card">
            <summary>Zmień hasło do konta</summary>
            <PasswordFields
              busy={busy === "password"}
              buttonLabel="Zapisz nowe hasło"
              passwords={passwords}
              setPasswords={setPasswords}
              onSubmit={changePassword}
            />
          </details>
        )}

        <section className={`market-switch ${platform}`} aria-label="Wybór serwisu">
          <div className="market-switch-copy">
            <p className="saas-eyebrow">WYBIERZ RADAR</p>
            <strong>Dwa serwisy. Jedno konto.</strong>
          </div>
          <div className="market-switch-track" role="tablist">
            {(["olx", "vinted"] as const).map((item) => (
              <button
                aria-selected={platform === item}
                className={platform === item ? "selected" : ""}
                key={item}
                onClick={() => setPlatform(item)}
                role="tab"
                type="button"
              >
                <span>{item === "olx" ? "O" : "V"}</span>
                <div>
                  <strong>{marketCopy[item].label}</strong>
                  <small>{marketCopy[item].short}</small>
                </div>
                <i className={statuses[item].active ? "active" : ""} />
              </button>
            ))}
          </div>
        </section>

        <section className="radar-hero" id="overview">
          <div>
            <p className="saas-eyebrow">TWÓJ RADAR {market.label.toUpperCase()}</p>
            <h1>
              {search.query}
              <em>{priceLabel}</em>
            </h1>
            <p>
              {search.name} jest jedną z {config.searches.length} zakładek. Radar
              sprawdza wszystkie co {config.intervalSeconds} sekund i wysyła
              wyłącznie oferty, które przejdą filtry właściwej zakładki.
            </p>
            <div className="radar-buttons">
              <button
                className={`saas-button radar-toggle ${status.active ? "stop" : ""}`}
                disabled={isBusy("toggle") || account.mustChangePassword}
                onClick={toggleRadar}
              >
                {status.active ? `Zatrzymaj ${market.label}` : `Uruchom ${market.label}`}
              </button>
              <button
                className="saas-button outline"
                disabled={isBusy("preview") || account.mustChangePassword}
                onClick={loadPreview}
              >
                {isBusy("preview") ? "Sprawdzam…" : "Podejrzyj wyniki"}
              </button>
            </div>
          </div>
          <div
            className={`radar-visual ${status.active ? "is-active" : "is-idle"}`}
            aria-hidden="true"
          >
            <i className="ring one" />
            <i className="ring two" />
            <i className="sweep" />
            <i className="radar-blip blip-one" />
            <i className="radar-blip blip-two" />
            <i className="radar-blip blip-three" />
            <small>{market.label}</small>
            <span>{search.query.slice(0, 18)}</span>
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

        <Section id="search" number="01" kicker={market.label} title="Co obserwujemy?">
          {platform === "vinted" && (
            <div className="platform-note">
              <strong>Jak zachować filtry Vinted?</strong>
              <span>
                Ustaw kategorię, markę, rozmiar i pozostałe opcje na Vinted,
                a następnie skopiuj tutaj pełny adres strony z wynikami.
              </span>
            </div>
          )}
          <div className="search-tabs-panel">
            <div
              aria-label={`Zakładki wyszukiwania ${market.label}`}
              className="search-tabs"
              role="tablist"
            >
              {config.searches.map((item, index) => (
                <button
                  aria-selected={item.id === search.id}
                  className={item.id === search.id ? "selected" : ""}
                  key={item.id}
                  onClick={() =>
                    setActiveSearchIds((current) => ({
                      ...current,
                      [platform]: item.id,
                    }))
                  }
                  role="tab"
                  type="button"
                >
                  <small>{String(index + 1).padStart(2, "0")}</small>
                  <span>{item.name}</span>
                  <i
                    className={`tab-channel-state ${
                      item.webhookConfigured ? "connected" : ""
                    }`}
                    title={
                      item.webhookConfigured
                        ? "Kanał Discord ustawiony"
                        : "Brak kanału Discord"
                    }
                  />
                </button>
              ))}
              <button
                aria-label="Dodaj kolejne wyszukiwanie"
                className="add-search-tab"
                disabled={config.searches.length >= 10}
                onClick={addSearch}
                title="Dodaj kolejne wyszukiwanie"
                type="button"
              >
                +
              </button>
            </div>
            <div className="search-tab-meta">
              <span>
                Zakładka {config.searches.findIndex((item) => item.id === search.id) + 1}
                {" "}z {config.searches.length}
              </span>
              <button
                disabled={config.searches.length === 1}
                onClick={removeSearch}
                type="button"
              >
                Usuń zakładkę
              </button>
            </div>
          </div>
          <div className="form-grid">
            <Field label="Nazwa zakładki" wide>
              <input
                value={search.name}
                onChange={(event) => patchSearch({ name: event.target.value })}
              />
            </Field>
            <Field
              help={
                platform === "vinted"
                  ? "Przykład: https://www.vinted.pl/catalog?search_text=nike"
                  : undefined
              }
              label={market.sourceLabel}
              wide
            >
              <input
                value={search.sourceUrl}
                onChange={(event) => patchSearch({ sourceUrl: event.target.value })}
              />
            </Field>
            <Field label="Fraza">
              <input
                value={search.query}
                onChange={(event) => patchSearch({ query: event.target.value })}
              />
            </Field>
            {platform === "olx" && (
              <Field label="ID kategorii">
                <input
                  min="0"
                  type="number"
                  value={search.categoryId}
                  onChange={(event) =>
                    patchSearch({ categoryId: Number(event.target.value) })
                  }
                />
              </Field>
            )}
            <Field label="Cena od">
              <input
                min="0"
                type="number"
                value={search.minPrice ?? ""}
                onChange={(event) =>
                  patchSearch({
                    minPrice: event.target.value ? Number(event.target.value) : null,
                  })
                }
              />
            </Field>
            <Field label="Cena do">
              <input
                min="0"
                type="number"
                value={search.maxPrice ?? ""}
                onChange={(event) =>
                  patchSearch({
                    maxPrice: event.target.value ? Number(event.target.value) : null,
                  })
                }
              />
            </Field>
            <Field
              label="Sprawdzaj wszystkie zakładki co (sek.)"
              help="Wspólna częstotliwość dla wybranego serwisu."
            >
              <input
                max="86400"
                min="30"
                type="number"
                value={config.intervalSeconds}
                onChange={(event) =>
                  patch({ intervalSeconds: Number(event.target.value) })
                }
              />
            </Field>
            {platform === "olx" && (
              <Field label="Maksymalny wiek (min.)">
                <input
                  min="0"
                  type="number"
                  value={search.maxAgeMinutes}
                  onChange={(event) =>
                    patchSearch({ maxAgeMinutes: Number(event.target.value) })
                  }
                />
              </Field>
            )}
          </div>
        </Section>

        <Section
          id="filters"
          number="02"
          kicker="SELEKCJA"
          title={`Filtry: ${search.name}`}
        >
          <div className="form-grid">
            <Field label="Musi zawierać — oddziel przecinkami" wide>
              <input
                placeholder="np. pro, 256gb"
                value={search.includeKeywords.join(", ")}
                onChange={(event) =>
                  patchSearch({ includeKeywords: listFromText(event.target.value) })
                }
              />
            </Field>
            <Field label="Odrzuć, jeśli zawiera" wide>
              <input
                placeholder="np. uszkodzony, zamienię"
                value={search.excludeKeywords.join(", ")}
                onChange={(event) =>
                  patchSearch({ excludeKeywords: listFromText(event.target.value) })
                }
              />
            </Field>
            {platform === "olx" && (
              <Field label="Lokalizacje" wide>
                <input
                  placeholder="Pusto = cała Polska"
                  value={search.locations.join(", ")}
                  onChange={(event) =>
                    patchSearch({ locations: listFromText(event.target.value) })
                  }
                />
              </Field>
            )}
            <Field label="Sprzedający">
              <select
                value={search.sellerType}
                onChange={(event) =>
                  patchSearch({
                    sellerType: event.target.value as RadarConfig["sellerType"],
                  })
                }
              >
                <option value="all">Wszyscy</option>
                <option value="private">Osoby prywatne</option>
                <option value="business">Firmy</option>
              </select>
            </Field>
            <div className={`field-card condition-card ${platform}`}>
              <span>Stan przedmiotu</span>
              <div className={`choice-row ${platform}`}>
                {conditionOptions[platform].map(([value, label]) => (
                  <label className="choice" key={value}>
                    <input
                      checked={search.conditions.includes(value)}
                      onChange={(event) =>
                        patchSearch({
                          conditions: event.target.checked
                            ? [...search.conditions, value]
                            : search.conditions.filter((item) => item !== value),
                        })
                      }
                      type="checkbox"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <Toggle
              checked={search.matchAllKeywords}
              label="Wymagaj wszystkich słów"
              onChange={(value) => patchSearch({ matchAllKeywords: value })}
            />
            {platform === "olx" && (
              <Toggle
                checked={search.deliveryRequired}
                label="Tylko z dostawą OLX"
                onChange={(value) => patchSearch({ deliveryRequired: value })}
              />
            )}
            <Toggle
              checked={search.skipPromoted}
              label="Pomiń promowane"
              onChange={(value) => patchSearch({ skipPromoted: value })}
            />
          </div>
        </Section>

        <Section
          id="discord"
          number="03"
          kicker="POWIADOMIENIA"
          title={`Kanał dla: ${search.name}`}
        >
          <div className="discord-grid">
            <div className="discord-mock">
              <span className="discord-logo">{platform === "olx" ? "O" : "V"}</span>
              <div>
                <p>
                  <strong>{config.discordUsername}</strong> <b>BOT</b>{" "}
                  <small>dzisiaj, 12:04</small>
                </p>
                <article
                  style={{
                    borderColor: `#${config.discordColor
                      .toString(16)
                      .padStart(6, "0")}`,
                  }}
                >
                  <strong>
                    {platform === "olx"
                      ? "iPhone 15 Pro 256 GB — świetny stan"
                      : "Kurtka vintage — bardzo dobry stan"}
                  </strong>
                  <p>
                    Nowa oferta {market.label} spełnia wszystkie ustawione filtry.
                  </p>
                  <dl>
                    <div><dt>Cena</dt><dd>{platform === "olx" ? "3 899 zł" : "149 zł"}</dd></div>
                    <div><dt>Źródło</dt><dd>{market.label}</dd></div>
                  </dl>
                </article>
              </div>
            </div>
            <div className="discord-settings">
              <div
                className={`connection-state ${
                  search.webhookConfigured ? "connected" : ""
                }`}
              >
                <i />{" "}
                {search.webhookConfigured
                  ? `Osobny kanał dla „${search.name}” jest zapisany i zaszyfrowany`
                  : `Zakładka „${search.name}” nie ma jeszcze przypisanego kanału`}
              </div>
              <Field
                label={
                  search.webhookConfigured
                    ? "Zmień kanał — wklej nowy webhook"
                    : "Webhook kanału Discord"
                }
                help="Każda zakładka może wysyłać ogłoszenia na inny kanał."
              >
                <input
                  autoComplete="off"
                  placeholder="https://discord.com/api/webhooks/…"
                  type="password"
                  value={webhooks[platform][search.id] ?? ""}
                  onChange={(event) =>
                    setWebhooks((current) => ({
                      ...current,
                      [platform]: {
                        ...current[platform],
                        [search.id]: event.target.value,
                      },
                    }))
                  }
                />
              </Field>
              <Field label="Nazwa nadawcy">
                <input
                  value={config.discordUsername}
                  onChange={(event) =>
                    patch({ discordUsername: event.target.value })
                  }
                />
              </Field>
              <Field label="ID roli do oznaczenia">
                <input
                  placeholder="Opcjonalnie"
                  value={config.discordRoleId}
                  onChange={(event) =>
                    patch({ discordRoleId: event.target.value })
                  }
                />
              </Field>
              <button
                className="saas-button discord-button"
                disabled={isBusy("discord") || account.mustChangePassword}
                onClick={testDiscord}
              >
                {isBusy("discord")
                  ? "Wysyłam…"
                  : `Testuj kanał: ${search.name}`}
              </button>
            </div>
          </div>
        </Section>

        <Section
          id="offers"
          number="04"
          kicker="PODGLĄD"
          title={`Pasujące oferty ${market.label}`}
        >
          {preview ? (
            <>
              <p className="offer-summary">
                Pobrano {preview.fetched}, pasuje <strong>{preview.matched}</strong>.
              </p>
              <div className="offer-list">
                {preview.offers.map((offer) => (
                  <article className="offer-tile" key={offer.id}>
                    <div className="offer-image">
                      {offer.imageUrl ? (
                        <Image
                          alt=""
                          height={450}
                          src={offer.imageUrl}
                          unoptimized
                          width={600}
                        />
                      ) : (
                        <span>Brak zdjęcia</span>
                      )}
                    </div>
                    <div>
                      <small>
                        {offer.condition ||
                          offer.location ||
                          `Oferta z ${market.label}`}
                      </small>
                      <h3>{offer.title}</h3>
                      <strong>{offer.priceLabel || "Brak ceny"}</strong>
                      <a href={offer.url} rel="noreferrer" target="_blank">
                        Otwórz na {market.label} ↗
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-offers">
              <div className="mini-radar"><i /></div>
              <h3>Sprawdź filtry bez wysyłania</h3>
              <p>
                Kliknij „Podejrzyj wyniki”, aby zobaczyć aktualne dopasowania
                z {market.label}.
              </p>
            </div>
          )}
        </Section>

        <footer className="dash-footer">
          <span>
            Radar Market · OLX + Vinted · prywatna konfiguracja @{account.username}
          </span>
          <span>Każdy webhook jest szyfrowany i nigdy nie jest wyświetlany.</span>
        </footer>
      </main>

      {message && (
        <div
          className={`saas-toast ${message.error ? "error" : ""}`}
          role="status"
        >
          <i>{message.error ? "!" : "✓"}</i>
          {message.text}
        </div>
      )}
    </div>
  );
}

function PasswordFields({
  busy,
  buttonLabel,
  onSubmit,
  passwords,
  setPasswords,
}: {
  busy: boolean;
  buttonLabel: string;
  onSubmit: () => void;
  passwords: { current: string; next: string; repeat: string };
  setPasswords: (
    value: { current: string; next: string; repeat: string },
  ) => void;
}) {
  return (
    <div className="password-fields">
      <input
        placeholder="Obecne lub tymczasowe hasło"
        type="password"
        value={passwords.current}
        onChange={(event) =>
          setPasswords({ ...passwords, current: event.target.value })
        }
      />
      <input
        placeholder="Nowe bezpieczne hasło"
        type="password"
        value={passwords.next}
        onChange={(event) =>
          setPasswords({ ...passwords, next: event.target.value })
        }
      />
      <input
        placeholder="Powtórz nowe hasło"
        type="password"
        value={passwords.repeat}
        onChange={(event) =>
          setPasswords({ ...passwords, repeat: event.target.value })
        }
      />
      <button
        className="saas-button dark"
        disabled={busy}
        onClick={onSubmit}
      >
        {buttonLabel}
      </button>
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
        <div>
          <p className="saas-eyebrow">{kicker}</p>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  children,
  help,
  label,
  wide = false,
}: {
  children: ReactNode;
  help?: string;
  label: string;
  wide?: boolean;
}) {
  return (
    <label className={`field-card ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      {children}
      {help && <small className="field-help">{help}</small>}
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
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <i />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="dash-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
