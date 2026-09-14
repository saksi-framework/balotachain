# apps/admin

The election administrator's console: a browser app served by the
saksi-campaign console at `/admin/` (built with `tools/build-web.{sh,ps1}` into
`dist-web/admin`, served with `saksi-campaign serve --web-dir`).

It drives one election through the console API:

| Step | Console calls |
|---|---|
| Sign in | `GET /api/me`, `POST /api/login`, `POST /api/logout` |
| Elections | `GET /runs`, `GET /api/capabilities` |
| 1 Election | `POST /generate` (`ElectionConfig`) |
| 2 Population (read-only) | `GET /api/runs/<id>/status`, `GET /api/check/<id>`, `GET /export/<id>/election.csv` |
| 3 Run | `POST /ceremony/start`, `GET /events?run=`, `GET /api/ceremony/<id>` |
| 4 Ceremony | `GET /api/ceremony/<id>`, `POST /ceremony/publish` |
| 5 Results | `POST /verify`, `GET /export/<id>/correctness.csv` |

The Population step shows what the generator made; nothing here issues real
voter credentials. When the console has no auth routes (`/api/me` answers 404),
the app runs without a login.

Dev: `pnpm --filter admin dev` proxies the console prefixes to
`http://127.0.0.1:8090`. The `src-tauri` crate is no longer a delivery path.
