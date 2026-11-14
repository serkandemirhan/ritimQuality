# Ritim Quality release discipline

- Every database schema change must have a new sequential, immutable migration under server/db/migrations. Never edit an applied migration.
- For every frontend release, increment the application minor version (for example 1.1.0 to 1.2.0). Version components are integers; 1.10 follows 1.9.
- Keep package.json, package-lock.json and src/releaseHistory.ts application versions aligned. Add a user-facing Turkish changelog entry describing changes and the applicable database migration version.
- Do not invent a production publication date. Mark a release pending until deployed; update its actual production date when known.
- Database schema versions and control-plan revisions are separate from application versions. Deploy required migrations before code that uses them.
