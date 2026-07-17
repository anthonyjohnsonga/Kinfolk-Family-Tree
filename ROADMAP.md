# Kinfolk Roadmap

This roadmap records the planned feature sequence for Kinfolk. Completed work may remain on `main` until it is included in a tagged release.

| # | Feature | Status | Notes |
|---:|---|---|---|
| 1 | Complete relationship management | Complete (`v0.0.4`) | Add, edit, and remove multiple typed sibling relationships. |
| 2 | Person details, life events, and locations | Complete (`v0.0.4`) | Person detail view, birth/death places, and structured timelines. |
| 3 | Sources, citations, photographs, and documents | Planned | Attach evidence and server-stored media to people and facts. |
| 4 | GEDCOM import and export | Complete (`v0.0.5`) | Use an open genealogy interchange format to avoid data lock-in. |
| 5 | Explicit links between related family trees | Planned | Link people and trees deliberately instead of matching surnames automatically. |
| 6 | Multiple users, permissions, and audit history | Partially complete (`v0.0.6`) | Administrator, editor, and viewer roles with account management are done; change history is still planned. |
| 7 | Tree navigation: pan, zoom, and focus | Complete (`v0.0.6`) | Treat the tree as a navigable canvas and focus on one person's direct family. |
| 8 | People search and index | Complete (`v0.0.6`) | Find any person by name, maiden name, or place and open their details. |
| 9 | Relationship calculator | Complete (`v0.0.6`) | Explain how any two people are related through their nearest shared ancestor. |

## Design principles

- Keep family data private and stored on the user's server.
- Preserve existing data through tracked, forward-only database migrations.
- Prefer explicit relationships over inferred surname matches.
- Keep deployment versioned and reproducible through Docker Compose.
- Add import/export before the internal model becomes difficult to exchange with other genealogy tools.
