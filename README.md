# Lunchlady Land

Proof of concept for running school cafeteria paperwork from one small web app. The district keeps one
catalog of food items and menus; each cafeteria manager starts the day's **Production Record** from a menu,
prints a pre-filled **Pull Sheet** for the kitchen, types the paper counts back in after service, and
finalizes and prints the Production Record.

Kitchen staff never log in. They work on the printed Pull Sheet, as today.

## Run it locally

Needs Node 22.

```bash
npm install
npm run dev        # http://localhost:3000
```

No database setup is needed: with `DATABASE_URL` unset the app uses an embedded Postgres (PGlite) stored in
`./.data`, creates the schema and loads sample data on first start. `npm run db:reset` wipes it.

Sign in by picking a sample user:

| User | Role |
| --- | --- |
| Dana District | District admin |
| Maria Lopez | Cafeteria manager, Maple Elementary |
| Jim Carter | Cafeteria manager, Riverside K-8 |
| Pat Nguyen | Cafeteria manager, Central High |

To run against a real Postgres (for example Supabase), set `DATABASE_URL` and `SESSION_SECRET`
(see `.env.example`). The schema is applied automatically to an empty database.

```bash
npm test           # data-layer tests (locking, amendments, USDA checks, school scoping)
npm run build
```

## Daily workflow

1. **Start the record.** Manager picks the date, meal and district menu. Items, creditable amounts and
   planned servings are copied onto the record.
2. **Adjust.** Add or remove catalog items and change planned servings to match what is actually served.
3. **Print the Pull Sheet** (and a draft Production Record if wanted). The Pull Sheet lists exactly that
   day's items with blank columns for initials, quantity pulled, two temperatures, amounts and leftover code.
4. **Type in the paper counts** after service, plus actual meal counts. The Production Record's actual
   servings are filled from the Pull Sheet: *Amt Prep'd* = cases/cans pulled, *Num Svg Prepared* = amount
   prepared, *Num Served* = amount used minus sold à la carte/adult, *Amt Leftover* and *CODE* from the
   leftover columns.
5. **Finalize.** The app checks the record; once it passes, the record locks and a copy of the printed
   Production Record is archived with a SHA-256 checksum. Print and file it.

A finalized record can only be changed by an **amendment**, which requires a reason. Each amendment
records exactly which fields changed (old and new values), bumps the version, and archives a new printed
copy. Earlier versions stay viewable.

## Checks before finalizing

Blocking errors:

- Prepared by is filled in; if not all grades are Offer vs. Serve, a reason is given.
- Meal counts are entered.
- At least 2 types of milk are listed.
- Fruit offered is at least ½ cup for PK-8 and 1 cup for 9-12 (sum of the Fruit creditable amount of items
  planned for that group).
- Every line has Amount Prepared and Amount Used; any leftover has a usage code (F, R, SND, D).

Warnings (do not block): used + leftover ≠ prepared, sold à la carte more than used, HACCP 2/3 items missing
a temperature, general items with no preparer initials.

## Roles

| Data | District admin | Cafeteria manager |
| --- | --- | --- |
| Schools, users | Read/write | — |
| Food items, menus | Read/write | Read only |
| Production Records and Pull Sheet counts | All schools | Own school only, until finalized (then amend) |
| Audit log | Read only | — |

## How records are protected

These rules live in the database (`db/schema.sql`), not just the app:

- A trigger refuses any change to a finalized record, its lines or its Pull Sheet counts unless the
  transaction is an amendment. Production Records can never be deleted.
- Every insert, update and delete on the main tables is written to `audit_events` with the user, time,
  old and new values, and the amendment reason.
- `amendments`, `record_archives` and `audit_events` are append-only.

## Code map

```
db/schema.sql          tables, audit trigger, lock trigger
db/seed.ts             sample schools, users, food items, menus
lib/db.ts              PGlite or node-postgres; withTx() tags each transaction with the acting user
lib/records.ts         create / save / finalize / amend Production Records
lib/validate.ts        finalize checks and Pull Sheet → Production Record mapping
lib/print.ts           printable Production Record and Pull Sheet HTML (also what gets archived)
lib/catalog.ts         food items, menus, schools, users, audit log
app/                   Next.js pages and server actions
test/                  vitest tests against an in-memory database
```

## POC shortcuts, and what production needs

| In this POC | For production (per the architecture doc) |
| --- | --- |
| Pick-a-user sign-in with a signed cookie | Supabase Auth with the district's Google or Microsoft accounts |
| School scoping checked in the app | Also enforce with Postgres row-level security |
| Archived copy stored as HTML in the database | Render to PDF and store in a Supabase Storage bucket |
| Embedded local database | Supabase Postgres (Pro for daily backups) |
| Runs on a laptop | Deploy to Vercel from this repo |

Open questions carried over: the state's record retention period (keep 5 years until confirmed), which
sign-in provider the district uses, and whether IT must approve a hosted service.
