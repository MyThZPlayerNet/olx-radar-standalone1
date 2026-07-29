:root {
  --ink: #10201c;
  --ink-soft: #38504a;
  --paper: #f4f5f1;
  --surface: #ffffff;
  --line: #d8dfd9;
  --line-strong: #b9c6bd;
  --acid: #c9ff63;
  --acid-deep: #a5e735;
  --mint: #dff7e9;
  --coral: #ff785f;
  --purple: #5865f2;
  --shadow: 0 18px 48px rgba(24, 44, 37, 0.08);
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background:
    radial-gradient(circle at 70% 0%, rgba(201, 255, 99, 0.12), transparent 28rem),
    var(--paper);
  color: var(--ink);
  font-family:
    Inter, "Segoe UI", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

button,
input,
select {
  font: inherit;
}

button,
a {
  -webkit-tap-highlight-color: transparent;
}

button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 3px solid rgba(71, 110, 255, 0.35);
  outline-offset: 2px;
}

.app-shell {
  min-height: 100vh;
}

.sidebar {
  background: var(--ink);
  color: #f8fff9;
  display: flex;
  flex-direction: column;
  height: 100vh;
  justify-content: space-between;
  left: 0;
  padding: 30px 22px 24px;
  position: fixed;
  top: 0;
  width: 236px;
  z-index: 20;
}

.brand {
  align-items: center;
  color: inherit;
  display: flex;
  gap: 12px;
  text-decoration: none;
}

.brand-mark,
.loading-mark {
  align-items: center;
  background: var(--acid);
  color: var(--ink);
  display: inline-flex;
  font-size: 22px;
  font-weight: 900;
  height: 42px;
  justify-content: center;
  transform: rotate(-4deg);
  width: 42px;
}

.brand strong {
  display: block;
  font-size: 16px;
  letter-spacing: -0.02em;
}

.brand small {
  color: #a8bab2;
  display: block;
  font-size: 11px;
  margin-top: 2px;
}

.sidebar nav {
  display: grid;
  gap: 5px;
  margin: 48px 0 auto;
}

.nav-link {
  align-items: center;
  border-left: 2px solid transparent;
  color: #9cb0a8;
  display: flex;
  font-size: 13px;
  gap: 12px;
  padding: 11px 12px;
  text-decoration: none;
  transition:
    background 160ms ease,
    color 160ms ease;
}

.nav-link span {
  color: #60776e;
  font-family: Consolas, monospace;
  font-size: 10px;
}

.nav-link:hover,
.nav-link.active {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--acid);
  color: #fff;
}

.sidebar-status {
  border-top: 1px solid #334941;
  padding-top: 18px;
}

.status-line {
  align-items: center;
  display: flex;
  font-size: 12px;
  font-weight: 700;
  gap: 8px;
}

.status-dot {
  background: #899991;
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgba(137, 153, 145, 0.12);
  display: inline-block;
  height: 8px;
  width: 8px;
}

.status-dot.live {
  animation: pulse 2.2s infinite;
  background: var(--acid);
  box-shadow: 0 0 0 4px rgba(201, 255, 99, 0.12);
}

.sidebar-status p {
  color: #82988e;
  font-size: 11px;
  line-height: 1.55;
  margin: 10px 0 0 16px;
}

.main-content {
  margin-left: 236px;
  min-height: 100vh;
  padding: 0 54px 40px;
}

.topbar {
  align-items: center;
  border-bottom: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  min-height: 82px;
}

.eyebrow {
  color: #647971;
  font-family: Consolas, "Courier New", monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  margin: 0 0 6px;
}

.breadcrumb {
  color: #73867e;
  font-size: 12px;
  margin: 0;
}

.top-actions,
.hero-actions {
  align-items: center;
  display: flex;
  gap: 10px;
}

.button {
  align-items: center;
  border: 1px solid transparent;
  cursor: pointer;
  display: inline-flex;
  font-size: 12px;
  font-weight: 800;
  gap: 8px;
  justify-content: center;
  min-height: 42px;
  padding: 0 18px;
  transition:
    transform 150ms ease,
    box-shadow 150ms ease,
    background 150ms ease;
}

.button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.button:disabled {
  cursor: wait;
  opacity: 0.62;
}

.button.primary {
  background: var(--ink);
  color: #fff;
  box-shadow: 0 8px 18px rgba(16, 32, 28, 0.15);
}

.button.ghost {
  background: transparent;
  border-color: var(--line-strong);
  color: var(--ink);
}

.button.dark {
  background: var(--ink);
  color: #fff;
  white-space: nowrap;
}

.hero {
  display: grid;
  gap: 40px;
  grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.75fr);
  min-height: 410px;
  overflow: hidden;
  padding: 62px 0 52px;
  position: relative;
}

.hero::before {
  color: rgba(16, 32, 28, 0.035);
  content: "RADAR";
  font-size: 190px;
  font-weight: 950;
  letter-spacing: -0.08em;
  position: absolute;
  right: 0;
  top: -20px;
  z-index: -1;
}

.hero-copy {
  align-self: center;
}

.hero-kicker {
  align-items: center;
  display: flex;
  font-family: Consolas, monospace;
  font-size: 10px;
  font-weight: 800;
  gap: 10px;
  letter-spacing: 0.15em;
  margin-bottom: 22px;
}

.hero h1 {
  font-size: clamp(40px, 5vw, 72px);
  letter-spacing: -0.065em;
  line-height: 0.96;
  margin: 0;
}

.hero h1 em {
  color: #4f6a60;
  font-family: Georgia, "Times New Roman", serif;
  font-weight: 400;
}

.hero-copy > p {
  color: #556a62;
  font-size: 15px;
  line-height: 1.7;
  margin: 26px 0;
  max-width: 590px;
}

.button.monitor {
  background: var(--acid);
  color: var(--ink);
  min-height: 50px;
  padding: 0 24px;
}

.button.monitor:hover {
  background: var(--acid-deep);
  box-shadow: 0 10px 26px rgba(138, 204, 44, 0.2);
}

.button.monitor.stop {
  background: #ffded8;
  color: #9c2f1f;
}

.interval-note {
  color: #6d8179;
  font-size: 11px;
}

.signal-card {
  align-items: center;
  aspect-ratio: 1;
  align-self: center;
  background: var(--ink);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  justify-self: end;
  max-width: 355px;
  overflow: hidden;
  position: relative;
  width: 100%;
}

.signal-card::before,
.signal-card::after,
.signal-orbit {
  border: 1px solid rgba(201, 255, 99, 0.2);
  border-radius: 50%;
  content: "";
  inset: 10%;
  position: absolute;
}

.signal-card::after {
  inset: 24%;
}

.signal-orbit.orbit-one {
  border-color: transparent transparent var(--acid) var(--acid);
  inset: 4%;
  transform: rotate(25deg);
}

.signal-orbit.orbit-two {
  border-color: var(--acid) transparent transparent var(--acid);
  inset: 37%;
  transform: rotate(-40deg);
}

.signal-center {
  color: #fff;
  display: grid;
  max-width: 210px;
  position: relative;
  text-align: center;
  z-index: 2;
}

.signal-center span {
  color: var(--acid);
  font-family: Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.16em;
}

.signal-center strong {
  font-size: clamp(24px, 3vw, 38px);
  letter-spacing: -0.05em;
  line-height: 1;
  margin: 10px 0;
  overflow-wrap: anywhere;
}

.signal-center small {
  color: #9fb4ab;
}

.metric-grid {
  border-bottom: 1px solid var(--line);
  border-top: 1px solid var(--line);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
}

.metric {
  border-right: 1px solid var(--line);
  display: grid;
  min-height: 118px;
  padding: 24px;
}

.metric:last-child {
  border-right: 0;
}

.metric > span {
  color: #71847d;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.metric strong {
  align-self: end;
  font-size: 22px;
  letter-spacing: -0.04em;
}

.metric small {
  color: #84968f;
  font-size: 10px;
  margin-top: 4px;
}

.metric small.good {
  color: #31854a;
}

.metric small.warn {
  color: #bf5a34;
}

.notice {
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  font-size: 12px;
  gap: 3px;
  margin-top: 24px;
  padding: 14px 16px;
}

.notice.error {
  background: #fff0ed;
  border-left: 3px solid var(--coral);
  color: #7e3024;
}

.workspace-section {
  border-bottom: 1px solid var(--line);
  padding: 72px 0;
  scroll-margin-top: 20px;
}

.section-heading {
  align-items: start;
  display: grid;
  gap: 24px;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  margin-bottom: 34px;
}

.section-number {
  align-items: center;
  border: 1px solid var(--line-strong);
  color: #667a72;
  display: inline-flex;
  font-family: Consolas, monospace;
  font-size: 10px;
  height: 34px;
  justify-content: center;
  width: 34px;
}

.section-heading h2 {
  font-size: clamp(26px, 3vw, 40px);
  letter-spacing: -0.05em;
  line-height: 1.05;
  margin: 0 0 10px;
}

.section-heading > div > p:last-child {
  color: #657970;
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
  max-width: 650px;
}

.section-action {
  align-self: center;
}

.config-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.panel,
.field {
  min-width: 0;
}

.panel {
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: 0 5px 20px rgba(28, 48, 41, 0.025);
  padding: 24px;
}

.panel-wide {
  grid-column: span 2;
}

.search-grid .url-panel {
  grid-column: 1 / -1;
}

label,
legend,
.tag-editor > label {
  color: #344a42;
  display: block;
  font-size: 11px;
  font-weight: 800;
  margin-bottom: 8px;
}

fieldset {
  border: 0;
  margin: 0 0 24px;
  padding: 0;
}

input,
select {
  background: #fbfcfa;
  border: 1px solid var(--line-strong);
  color: var(--ink);
  min-height: 46px;
  padding: 0 13px;
  width: 100%;
}

input::placeholder {
  color: #9aa9a3;
}

input:focus,
select:focus {
  background: #fff;
  border-color: #6f8c80;
  outline: none;
}

.input-action {
  display: flex;
  gap: 8px;
}

.input-action input {
  flex: 1;
}

.field-help {
  color: #82928c;
  display: block;
  font-size: 10px;
  line-height: 1.45;
  margin: 8px 0 0;
}

.with-suffix {
  position: relative;
}

.with-suffix input {
  padding-right: 52px;
}

.with-suffix > span {
  color: #72847d;
  font-size: 10px;
  position: absolute;
  right: 13px;
  top: 17px;
}

.tag-box {
  align-content: flex-start;
  background: #fbfcfa;
  border: 1px solid var(--line-strong);
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  min-height: 94px;
  padding: 10px;
}

.tag-box:focus-within {
  background: #fff;
  border-color: #6f8c80;
}

.tag-box input {
  background: transparent;
  border: 0;
  flex: 1;
  min-height: 32px;
  min-width: 190px;
  padding: 0 4px;
}

.tag-box input:focus {
  background: transparent;
}

.tag {
  align-items: center;
  background: #e6ede8;
  border: 0;
  color: #30473e;
  cursor: pointer;
  display: inline-flex;
  font-size: 11px;
  font-weight: 700;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
}

.tag-box.accent .tag {
  background: #e4fac1;
}

.tag-box.danger .tag {
  background: #ffebe6;
  color: #8f3a2b;
}

.tag span {
  font-size: 15px;
  font-weight: 400;
}

.toggle-row {
  align-items: center;
  border-top: 1px solid #e5eae6;
  cursor: pointer;
  display: grid;
  gap: 14px;
  grid-template-columns: 1fr auto;
  margin: 18px 0 0;
  padding-top: 18px;
  position: relative;
}

.toggle-row:first-child {
  border-top: 0;
  margin-top: 0;
  padding-top: 0;
}

.toggle-row strong,
.toggle-row small {
  display: block;
}

.toggle-row strong {
  font-size: 11px;
}

.toggle-row small {
  color: #82928c;
  font-size: 10px;
  font-weight: 400;
  margin-top: 3px;
}

.toggle-row input {
  height: 1px;
  opacity: 0;
  position: absolute;
  width: 1px;
}

.toggle-row i {
  background: #c7d0ca;
  height: 24px;
  position: relative;
  transition: background 160ms ease;
  width: 42px;
}

.toggle-row i::after {
  background: #fff;
  box-shadow: 0 2px 6px rgba(16, 32, 28, 0.2);
  content: "";
  height: 18px;
  left: 3px;
  position: absolute;
  top: 3px;
  transition: transform 160ms ease;
  width: 18px;
}

.toggle-row input:checked + i {
  background: #76a900;
}

.toggle-row input:checked + i::after {
  transform: translateX(18px);
}

.check-grid {
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(3, 1fr);
}

.check-option {
  margin: 0;
  position: relative;
}

.check-option input {
  height: 1px;
  opacity: 0;
  position: absolute;
  width: 1px;
}

.check-option span {
  align-items: center;
  border: 1px solid var(--line-strong);
  color: #63766e;
  display: flex;
  font-size: 10px;
  justify-content: center;
  min-height: 38px;
}

.check-option input:checked + span {
  background: var(--ink);
  border-color: var(--ink);
  color: #fff;
}

.compact-fields {
  display: grid;
  gap: 16px;
}

.discord-layout {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1.2fr) minmax(360px, 0.8fr);
}

.discord-preview {
  align-items: flex-start;
  background: #313338;
  color: #dbdee1;
  display: grid;
  gap: 14px;
  grid-template-columns: 42px 1fr;
  min-height: 330px;
  padding: 34px;
}

.discord-avatar {
  align-items: center;
  background: var(--acid);
  border-radius: 50%;
  color: var(--ink);
  display: flex;
  font-weight: 900;
  height: 42px;
  justify-content: center;
}

.discord-name {
  align-items: center;
  color: #f2f3f5;
  display: flex;
  font-size: 13px;
  font-weight: 700;
  gap: 7px;
}

.discord-name span {
  background: var(--purple);
  border-radius: 3px;
  color: #fff;
  font-size: 8px;
  padding: 2px 4px;
}

.discord-name time {
  color: #949ba4;
  font-size: 9px;
  font-weight: 400;
}

.discord-embed {
  background: #2b2d31;
  border-left: 4px solid var(--acid);
  display: grid;
  gap: 16px;
  grid-template-columns: 138px 1fr;
  margin-top: 8px;
  max-width: 580px;
  padding: 14px;
}

.embed-image-placeholder {
  align-items: center;
  background:
    linear-gradient(135deg, rgba(201, 255, 99, 0.7), rgba(80, 131, 232, 0.55)),
    #18211d;
  display: flex;
  height: 118px;
  justify-content: center;
}

.embed-image-placeholder span {
  color: var(--ink);
  font-size: 26px;
  font-weight: 950;
  letter-spacing: -0.08em;
  transform: rotate(-5deg);
}

.discord-embed strong {
  color: #fff;
  font-size: 14px;
}

.discord-embed p {
  color: #b5bac1;
  font-size: 10px;
  line-height: 1.5;
  margin: 6px 0 12px;
}

.discord-embed dl {
  display: flex;
  gap: 26px;
  margin: 0;
}

.discord-embed dt {
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}

.discord-embed dd {
  color: #b5bac1;
  font-size: 9px;
  margin: 2px 0 0;
}

.discord-form {
  padding: 28px;
}

.connection-badge {
  align-items: center;
  background: #eef3ef;
  display: flex;
  font-size: 10px;
  font-weight: 800;
  gap: 9px;
  margin-bottom: 22px;
  padding: 11px 12px;
}

.two-columns {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr 1fr;
  margin-top: 16px;
}

.discord-button {
  background: var(--purple);
  color: #fff;
  margin-top: 20px;
  width: 100%;
}

.results-summary {
  color: #677b73;
  font-size: 12px;
  margin: -8px 0 18px 68px;
}

.results-summary strong {
  color: var(--ink);
}

.offer-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.offer-card {
  background: var(--surface);
  border: 1px solid var(--line);
  min-width: 0;
  overflow: hidden;
  transition:
    box-shadow 160ms ease,
    transform 160ms ease;
}

.offer-card:hover {
  box-shadow: var(--shadow);
  transform: translateY(-2px);
}

.offer-card > a {
  background: #e7ebe7;
  display: block;
  height: 185px;
  overflow: hidden;
}

.offer-card img {
  height: 100%;
  object-fit: cover;
  transition: transform 240ms ease;
  width: 100%;
}

.offer-card:hover img {
  transform: scale(1.025);
}

.no-image {
  align-items: center;
  color: #85958f;
  display: flex;
  font-size: 11px;
  height: 100%;
  justify-content: center;
}

.offer-body {
  padding: 18px;
}

.offer-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.offer-meta span {
  background: #eef2ef;
  color: #667a72;
  font-size: 8px;
  font-weight: 700;
  padding: 4px 6px;
  text-transform: uppercase;
}

.offer-body h3 {
  font-size: 15px;
  line-height: 1.3;
  margin: 12px 0;
}

.offer-body h3 a {
  color: inherit;
  text-decoration: none;
}

.offer-price {
  font-size: 19px;
  letter-spacing: -0.03em;
}

.offer-body > p {
  color: #74867f;
  font-size: 10px;
  margin: 6px 0 20px;
}

.offer-link {
  border-top: 1px solid var(--line);
  color: var(--ink);
  display: block;
  font-size: 10px;
  font-weight: 800;
  padding-top: 12px;
  text-decoration: none;
}

.skeleton-card {
  padding: 12px;
}

.empty-state {
  align-items: center;
  background: rgba(255, 255, 255, 0.6);
  border: 1px dashed var(--line-strong);
  display: flex;
  flex-direction: column;
  min-height: 330px;
  justify-content: center;
  padding: 40px;
  text-align: center;
}

.empty-radar {
  align-items: center;
  border: 1px solid #acc0b6;
  border-radius: 50%;
  display: flex;
  height: 72px;
  justify-content: center;
  margin-bottom: 18px;
  position: relative;
  width: 72px;
}

.empty-radar::after {
  border: 1px solid #d3ddd7;
  border-radius: 50%;
  content: "";
  height: 42px;
  position: absolute;
  width: 42px;
}

.empty-radar span {
  background: var(--acid-deep);
  border-radius: 50%;
  height: 8px;
  width: 8px;
}

.empty-state h3 {
  font-size: 22px;
  letter-spacing: -0.04em;
  margin: 0;
}

.empty-state p {
  color: #71847d;
  font-size: 12px;
  line-height: 1.6;
  margin: 8px auto 20px;
  max-width: 450px;
}

footer {
  color: #7c8e87;
  display: flex;
  font-size: 10px;
  justify-content: space-between;
  padding: 26px 0 0;
}

.toast {
  align-items: center;
  background: var(--ink);
  bottom: 24px;
  box-shadow: var(--shadow);
  color: #fff;
  display: flex;
  font-size: 12px;
  gap: 10px;
  max-width: 420px;
  padding: 15px 18px;
  position: fixed;
  right: 24px;
  z-index: 50;
}

.toast > span {
  align-items: center;
  background: var(--acid);
  color: var(--ink);
  display: flex;
  font-weight: 900;
  height: 22px;
  justify-content: center;
  width: 22px;
}

.toast.error > span {
  background: var(--coral);
  color: #fff;
}

.loading-screen {
  align-items: center;
  display: flex;
  gap: 22px;
  justify-content: center;
  min-height: 100vh;
}

.loading-screen h1 {
  font-size: 26px;
  letter-spacing: -0.04em;
  margin: 0 0 15px;
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 0 4px rgba(201, 255, 99, 0.1);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(201, 255, 99, 0.02);
  }
}

@media (max-width: 1080px) {
  .main-content {
    padding: 0 30px 40px;
  }

  .hero {
    grid-template-columns: 1fr 300px;
  }

  .config-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .panel-wide {
    grid-column: 1 / -1;
  }

  .discord-layout {
    grid-template-columns: 1fr;
  }

  .offer-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 780px) {
  .sidebar {
    align-items: center;
    bottom: 0;
    flex-direction: row;
    height: 64px;
    padding: 8px 14px;
    top: auto;
    width: 100%;
  }

  .brand span:last-child,
  .sidebar-status {
    display: none;
  }

  .brand-mark {
    height: 36px;
    width: 36px;
  }

  .sidebar nav {
    display: flex;
    gap: 0;
    margin: 0;
  }

  .nav-link {
    border-bottom: 2px solid transparent;
    border-left: 0;
    font-size: 0;
    height: 42px;
    justify-content: center;
    padding: 0 11px;
  }

  .nav-link span {
    color: inherit;
    font-size: 10px;
  }

  .main-content {
    margin-left: 0;
    padding: 0 18px 92px;
  }

  .topbar {
    align-items: flex-start;
    gap: 16px;
    padding: 18px 0;
  }

  .top-actions {
    align-items: stretch;
    flex-direction: column-reverse;
  }

  .top-actions .button {
    min-height: 36px;
    padding: 0 12px;
  }

  .hero {
    grid-template-columns: 1fr;
    padding: 48px 0;
  }

  .signal-card {
    justify-self: center;
    max-width: 280px;
  }

  .metric-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .metric:nth-child(2) {
    border-right: 0;
  }

  .metric:nth-child(-n + 2) {
    border-bottom: 1px solid var(--line);
  }

  .section-heading {
    grid-template-columns: 34px minmax(0, 1fr);
  }

  .section-action {
    grid-column: 2;
  }

  .config-grid,
  .offer-grid {
    grid-template-columns: 1fr;
  }

  .panel-wide {
    grid-column: auto;
  }

  .input-action {
    align-items: stretch;
    flex-direction: column;
  }

  .discord-preview {
    padding: 24px 18px;
  }

  .discord-embed {
    grid-template-columns: 1fr;
  }

  .embed-image-placeholder {
    height: 140px;
  }

  .two-columns {
    grid-template-columns: 1fr;
  }

  footer {
    flex-direction: column;
    gap: 5px;
  }
}

@media (max-width: 480px) {
  .hero h1 {
    font-size: 42px;
  }

  .hero-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .metric {
    min-height: 100px;
    padding: 18px 14px;
  }

  .metric strong {
    font-size: 18px;
  }

  .workspace-section {
    padding: 54px 0;
  }

  .panel {
    padding: 18px;
  }

  .check-grid {
    grid-template-columns: 1fr;
  }

  .discord-preview {
    grid-template-columns: 1fr;
  }

  .toast {
    bottom: 78px;
    left: 14px;
    right: 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition: none !important;
  }

  .status-dot.live {
    animation: none;
  }
}
