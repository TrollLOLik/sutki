# Global style composition

`global.css` is intentionally only an ordered composition file. The section files preserve the cascade of the original application while making ownership and later extraction visible.

Order matters:

1. foundations and home shell;
2. desktop navigation;
3. search and filter overlays;
4. smooth-scroll integration;
5. listing detail and booking flows;
6. calendars, create-listing and profile;
7. scrollbar policy;
8. final theme/audit overrides.

When a selector becomes owned by one component or page, move it to that owner and import it from the corresponding `ui/*.tsx`. Do not reorder section imports casually: the final theme override file intentionally wins the cascade.
