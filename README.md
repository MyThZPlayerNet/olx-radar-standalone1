# Radar Market Standalone

Samodzielna, wieloużytkownikowa aplikacja do monitorowania ofert OLX i Vinted.
Każdy użytkownik ma dwa niezależne radary, własne filtry, osobną historię
ogłoszeń i osobny webhook Discord dla każdego serwisu.
Nie ma publicznej rejestracji — konta i hasła tymczasowe tworzy administrator.

Ta wersja nie korzysta z `chatgpt.site`, Cloudflare D1 ani zewnętrznej bazy
danych. Panel, monitor i baza SQLite działają na Twoim serwerze.

## Najprostsze uruchomienie: Docker

Wymagania:

- serwer VPS z Dockerem i Docker Compose,
- domena kierująca na adres IP serwera,
- otwarte porty 80 i 443 dla reverse proxy.

### 1. Przygotuj konfigurację

W katalogu projektu uruchom:

```bash
node scripts/create-env.mjs
```

Skrypt tworzy `.env`, losuje klucz szyfrowania i pokazuje jednorazowo hasło
administratora. Zapisz je w menedżerze haseł.

Jeżeli na serwerze masz tylko Dockera, ten sam plik wygenerujesz bez
instalowania Node.js:

```bash
docker run --rm -v "$PWD:/app" -w /app node:22-bookworm-slim \
  node scripts/create-env.mjs
```

Przed publicznym uruchomieniem zmień w `.env`:

```dotenv
APP_URL=https://radar.twojadomena.pl
```

Możesz też skopiować `.env.example` do `.env` i wpisać wartości samodzielnie.
`APP_ENCRYPTION_KEY` musi być kluczem Base64 reprezentującym dokładnie 32 bajty.

### 2. Uruchom aplikację

```bash
docker compose up -d --build
```

Aplikacja nasłuchuje lokalnie na `127.0.0.1:3000`. Dane są zapisywane w trwałym
wolumenie `olx-radar-data`, więc aktualizacja kontenera ich nie usuwa.

### 3. Dodaj domenę i HTTPS

Najprościej użyć Caddy. Przykład znajduje się w `Caddyfile.example`:

```caddyfile
radar.twojadomena.pl {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3000
}
```

Caddy automatycznie pobierze i odnowi certyfikat HTTPS. Po uruchomieniu wejdź
na swoją domenę i zaloguj się kontem administratora.

## Uruchomienie bez Dockera

Wymagany jest Node.js 22.13 lub nowszy:

```bash
corepack enable
pnpm install --frozen-lockfile
node scripts/create-env.mjs
pnpm build
pnpm start
```

W produkcji uruchom proces przez systemd, PM2 lub inne narzędzie, które
automatycznie wznowi aplikację po restarcie serwera.

## Jak działa monitor

- wbudowany harmonogram sprawdza aktywne radary co 10 sekund,
- faktyczna częstotliwość każdego radaru pochodzi z ustawień użytkownika,
- radary OLX i Vinted mogą działać równocześnie,
- panel pozwala przełączać ich pełne konfiguracje jednym suwakiem,
- minimalny interwał to 30 sekund,
- jedno ogłoszenie nie jest wysyłane ponownie,
- błąd jednego radaru nie zatrzymuje pozostałych kont.

Integracja Vinted korzysta z publicznych wyników wyszukiwania. Wklejony link
`vinted.pl/catalog` zachowuje filtry ustawione wcześniej na Vinted, np.
kategorię, markę i rozmiar. Vinted może okresowo ograniczać automatyczne
zapytania; taki błąd jest zapisany przy konkretnym radarze i monitor ponawia
sprawdzenie w następnym interwale.

Panel i harmonogram muszą działać jako jedna instancja aplikacji. Przy wielu
replikach blokada w bazie ogranicza duplikaty, ale zalecana jest jedna replika.

## Dane i kopie zapasowe

Cała baza znajduje się w:

```text
data/olx-radar.db
```

W Dockerze jest to wolumen `olx-radar-data`. Wykonuj regularną kopię tego
wolumenu. SQLite używa trybu WAL, dlatego najbezpieczniej zatrzymać kontener na
czas ręcznego kopiowania:

```bash
docker compose stop
docker run --rm -v olx-radar-data:/data \
  -v "$PWD:/backup" alpine \
  tar czf /backup/olx-radar-backup.tar.gz -C /data .
docker compose start
```

Wolumen ma stałą nazwę `olx-radar-data`.

## Aktualizacja

Po podmianie plików aplikacji:

```bash
docker compose up -d --build
```

Wolumen z bazą pozostaje bez zmian.

## Ważne zasady bezpieczeństwa

- nie udostępniaj pliku `.env`,
- nie publikuj portu 3000 bezpośrednio w internecie,
- używaj HTTPS,
- regularnie aktualizuj obraz Node.js i zależności,
- nie zmieniaj `APP_ENCRYPTION_KEY` po zapisaniu webhooków — bez starego klucza
  nie będzie można ich odszyfrować,
- zmiana `ADMIN_PASSWORD` w `.env` nie zmienia hasła istniejącego konta;
  później hasło zmienia się z poziomu panelu.

## Diagnostyka

Stan aplikacji:

```text
GET /api/health
```

Logi kontenera:

```bash
docker compose logs -f olx-radar
```
