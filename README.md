# IcestomSite

The web panel for [IceStom](https://github.com/ice-stom/Icestom): a browser UI for building event
definitions and running them live on a server.

## How it fits together

```
  in game:  /panel  ──►  a one time link:  http://your-server:8080/#<token>
                                                     │
  browser:  opens the link ─────────────────────────►│  IceStom's built in HTTP server
            reads the token out of the fragment      │  ├── /            the files in site/
            sends it as a bearer token               │  └── /api/…       the panel API
            holds /api/stream open for live state    │
```