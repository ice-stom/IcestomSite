# IcestomSite

The web panel for [IceStom](https://github.com/ice-stom/Icestom): a browser UI for building event
definitions and running them live on a server.

It works like the LuckPerms editor in one respect — you run a command in game and get a link — but
the resemblance stops there. LuckPerms uploads a snapshot to a relay, you edit it offline, and you
paste a code back. Running an event needs a live two way connection, so this panel talks to the
game server directly for as long as the tab is open.

## How it fits together

```
  in game:  /panel  ──►  a one time link:  http://your-server:8080/#<token>
                                                     │
  browser:  opens the link ─────────────────────────►│  IceStom's built in HTTP server
            reads the token out of the fragment      │  ├── /            the files in site/
            sends it as a bearer token               │  └── /api/…       the panel API
            holds /api/stream open for live state    │
```

The site is served **by the game server itself**, from inside its jar. That is deliberate: a browser
refuses to let an HTTPS page call a plain HTTP server, so a panel hosted on a public domain would
force every server owner to get a TLS certificate for their API port. Same origin avoids the whole
problem.

## Layout

| Path              | What it is                                                          |
|-------------------|---------------------------------------------------------------------|
| `site/`           | The panel. Plain HTML, CSS and ES modules — no build step, no deps.  |
| `site/js/api.js`  | Token handling and every call to the server.                        |
| `site/js/run.js`  | The Run tab: start definitions, drive running events.               |
| `site/js/build.js`| The Build tab: assemble an event out of registered stages.          |
| `mock/server.mjs` | A fake IceStom, so the site can be worked on without Minecraft.     |

## Working on it

```bash
node mock/server.mjs
```

It prints a link with a fixed token. Open it, and you get a server with four fake players, four
tracks, the three built in stage types and two seeded events — including a hand written one, so you
can see how the panel treats a definition it cannot edit visually. Edits to `site/` are picked up on
reload; nothing needs rebuilding.

To work against a real server instead, set `web.dev_root` in the server's `config.toml` to the
absolute path of this repository's `site/` folder. The server will then serve the files off disk
rather than the copy baked into its jar.

## Shipping it

The IceStom build copies `site/` into the jar under `web/`. Clone this repository next to `Icestom`
and `./gradlew build` picks it up; otherwise point it at a path:

```bash
./gradlew build -Picestom.panelSite=/path/to/IcestomSite/site
```

If the site is missing at build time the jar still builds, the server still runs, and the panel URL
returns a 404 explaining what happened.

## The API

Every route lives under `/api/` and needs `Authorization: Bearer <token>`. The one exception is
`/api/stream`, which takes `?token=` because `EventSource` cannot set headers.

| Method | Path                          | Does                                                     |
|--------|-------------------------------|----------------------------------------------------------|
| GET    | `/api/bootstrap`              | Server info, session, stage schemas, tracks, definitions |
| GET    | `/api/state`                  | Running events and online players, once                  |
| GET    | `/api/stream`                 | The same state, pushed on every change (SSE)             |
| POST   | `/api/definitions`            | Generate and save a `.luau` from a builder document      |
| GET    | `/api/definitions/{name}`     | One definition, with its source                          |
| DELETE | `/api/definitions/{name}`     | Remove it from the server's `events/` folder             |
| POST   | `/api/events`                 | Run a definition with a list of participants             |
| DELETE | `/api/events/{id}`            | Cancel a running event                                   |
| POST   | `/api/events/{id}/transition` | Fire a stage transition, e.g. `StartCountdown`           |

The panel never writes Luau itself. It sends the server a document describing stages and options,
and the server generates the file, compiles it, and only then writes it — so the panel can only ever
produce definitions the server already knows how to run. The generated file carries a `-- @panel`
marker comment holding that document, which is how an event reopens in the builder later. Delete the
marker (or write a file by hand) and the panel treats it as run-only.
