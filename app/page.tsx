"use client";

import { useEffect, useState, type FormEvent } from "react";

type LoginState = {
  error: string;
  loading: boolean;
  password: string;
  username: string;
};

export default function LoginPage() {
  const [form, setForm] = useState<LoginState>({
    error: "",
    loading: false,
    password: "",
    username: "",
  });

  useEffect(() => {
    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((data) => {
        if (data.account) window.location.replace("/panel");
      })
      .catch(() => undefined);
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setForm((current) => ({ ...current, error: "", loading: true }));
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: form.password,
          username: form.username,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Nie udało się zalogować.");
      window.location.assign(data.account.role === "admin" ? "/admin" : "/panel");
    } catch (error) {
      setForm((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Nie udało się zalogować.",
        loading: false,
      }));
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <a className="saas-brand" href="/" aria-label="OLX Radar">
          <span className="saas-brand-mark">R</span>
          <span>OLX Radar</span>
        </a>
        <div className="auth-copy">
          <p className="saas-eyebrow">PRYWATNY MONITOR OKAZJI</p>
          <h1>
            Nowe ogłoszenie.
            <br />
            <em>Zanim zobaczą je inni.</em>
          </h1>
          <p>
            Twój osobisty radar przegląda OLX, odrzuca nietrafione wyniki
            i wysyła wybrane oferty prosto na Twój kanał Discord.
          </p>
        </div>
        <div className="auth-proof">
          <div><strong>30 s</strong><span>minimalny interwał</span></div>
          <div><strong>24/7</strong><span>monitorowanie ofert</span></div>
          <div><strong>1:1</strong><span>prywatne ustawienia</span></div>
        </div>
      </section>

      <section className="login-zone">
        <div className="login-card">
          <div className="login-heading">
            <span className="status-pill"><i /> DOSTĘP ZAMKNIĘTY</span>
            <h2>Zaloguj się do radaru</h2>
            <p>Użyj danych dostępu otrzymanych od administratora.</p>
          </div>
          <form onSubmit={login}>
            <label htmlFor="username">Login</label>
            <input
              autoComplete="username"
              id="username"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  username: event.target.value,
                }))
              }
              placeholder="np. kuba.nowak"
              required
              value={form.username}
            />
            <label htmlFor="password">Hasło</label>
            <input
              autoComplete="current-password"
              id="password"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder="••••••••••••"
              required
              type="password"
              value={form.password}
            />
            {form.error && <p className="form-error" role="alert">{form.error}</p>}
            <button className="saas-button primary wide" disabled={form.loading}>
              {form.loading ? "Logowanie…" : "Wejdź do panelu"}
            </button>
          </form>
          <div className="login-security">
            <span>🔒</span>
            <p>
              Nie ma publicznej rejestracji. Każde konto tworzy administrator,
              a webhook jest szyfrowany przed zapisaniem.
            </p>
          </div>
        </div>
        <p className="login-footnote">
          Nie masz danych dostępu? Skontaktuj się z administratorem usługi.
        </p>
      </section>
    </main>
  );
}
