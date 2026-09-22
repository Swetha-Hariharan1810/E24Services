# Running This Project Locally

A step-by-step guide in plain language. Every command below was run on a clean
checkout and confirmed to work.

---

## What you are about to run

This repository holds two things:

- **`assessment-ctrl`** — the library (the real product). It has no screen of its
  own; it gets packaged up and installed into other applications.
- **`assessment-ctrl-tester`** — a test web page with input boxes for every
  setting, used to try the library out.

So "running it locally" means: **build the library, then serve the tester page.**

One rule drives the whole ordering:

> **The library must be built before the tester will compile.**

The tester imports `assessment-ctrl` by name, and `tsconfig.json` points that name
at the `dist/` folder — not at the source. If `dist/` is empty, the tester build
fails with "cannot find module 'assessment-ctrl'".

---

## Before you start

You need **Node.js** and **npm**. Check what you have:

```bash
node --version
npm --version
```

Angular 18 needs Node **18.19+, 20.11+, or 22.x**. Verified working on Node
v22.22.2 with npm 10.9.7.

You do **not** need to install the Angular CLI globally. Every command below uses
`npx`, which runs the version already pinned in this project. (If you do have the
CLI installed globally, you can drop the `npx` prefix.)

---

## The four steps

Run all of these from the repository root.

### Step 1 — Install the dependencies

```bash
npm install
```

Takes about a minute and adds roughly 1,167 packages.

You will see warnings — a deprecation notice for `@primeng/themes` and an npm
audit summary listing vulnerabilities. **Both are expected and neither blocks
anything.** Do not run `npm audit fix --force`; it will upgrade packages past what
this project supports and break the build.

You only need to do this once, unless `package.json` changes.

### Step 2 — Build the library

```bash
npx ng build assessment-ctrl --configuration production
```

Takes a few seconds. You are looking for:

```
✔ Built assessment-ctrl
 - to: .../dist/assessment-ctrl
```

### Step 3 — Build the tester

```bash
npx ng build assessment-ctrl-tester
```

Takes roughly 30 seconds. It prints a table of bundle sizes (about 1.4 MB total)
and ends with a `Build at:` line.

This step is technically optional — step 4 builds it anyway — but running it
separately makes a compile error much easier to read.

### Step 4 — Start the dev server

```bash
npx ng serve
```

Wait for:

```
** Angular Live Development Server is listening on localhost:4200,
   open your browser on http://localhost:4200/ **
✔ Compiled successfully.
```

Now open **http://localhost:4200/** in a browser. You should see a page titled
**"Standalone Assessment Control Tester"**: settings on the left, and on the right
the message *"Configure values on the left and select Start Assessment."*

Press `Ctrl+C` in the terminal to stop the server.

**A note on `ng serve` with no project name:** it works, even though this
workspace has two projects. The library has no `serve` target, so the CLI picks
the tester automatically. You can be explicit if you prefer:
`npx ng serve assessment-ctrl-tester`.

---

## After you change code

This trips people up, so it is worth stating plainly:

| You changed… | What to do |
| --- | --- |
| Something in `projects/assessment-ctrl-tester/` | Nothing. `ng serve` watches these files and reloads the browser by itself. |
| Something in `projects/assessment-ctrl/` (the library) | **Stop the server, rebuild the library (step 2), start the server again.** `ng serve` does *not* watch the library — it only reads the already-built `dist/` folder. |

If a library change stubbornly refuses to show up, it is almost always because
step 2 was skipped.

---

## Making the assessment actually run

Serving the page is the easy part. Getting a real question to appear needs
something to talk to, because **the questions come from Expert24's cloud, and the
backend that normally talks to it is not in this repository.**

You have three modes. The first two are chosen by the **"Use Expert24 Direct
APIs"** checkbox at the top left; the third is Mode A pointed at a fake backend
this repo ships.

### Mode A — Through the Sagility backend (checkbox OFF, the default)

The control calls `http://localhost:9991/api/E24Proxy/...`, and that backend
forwards to Expert24.

This requires the **Clinical Content Service** running locally on port 9991. It
lives in a different repository — the specs place it at
`/source/Components/ClinicalContent/ContentService`. Get that running first, or
point the "Sagility Web Service URL Base" field at a deployed instance.

Without it, every request fails and a red error banner appears at the top left.
That banner is the control working correctly — it is reporting that it could not
reach the server.

### Mode B — Straight to Expert24 (checkbox ON)

The tester hides the Sagility URL field and sends requests directly to the
Expert24 URL instead (the default is the UAT environment,
`https://aph-uat.expert-24.net`). No local backend needed.

Be aware of two things:

- **The browser may block it.** These are cross-origin calls from
  `localhost:4200` to a different domain. Unless Expert24 returns permissive CORS
  headers for your origin, the browser will refuse the request and you will see a
  CORS error in the browser console. This is exactly the problem the proxy exists
  to solve.
- **You are hitting a real shared environment.** Pick the right Expert24 URL for
  what you are doing — authoring, QA, UAT and production each have their own.

### Mode C — Against the bundled mock backend (checkbox OFF)

If you have neither the Clinical Content Service nor Expert24 access, this repo
ships a stand-in that speaks the same API:

```bash
python3 scripts/mock_e24_proxy.py
```

It listens on `http://127.0.0.1:8099` and serves a canned three-question
assessment. Put that URL in the **Sagility Web Service URL Base** field and press
Start Assessment — the control cannot tell the difference. It sends permissive
CORS headers, so the browser will not block it, and it prints every request it
receives, which makes it a useful way to see exactly what the control sends.

It is a test double. The answers are fixed, nothing is stored, and there is no
authentication. Do not run it anywhere it could be mistaken for the real thing.

### What to fill in

The tester ships with working defaults, so you can usually just press **Start
Assessment**. The fields that matter:

| Field | What it is | Default |
| --- | --- | --- |
| Sagility Web Service URL Base | Your local/hosted backend (Mode A only) | `http://localhost:9991` |
| Expert24 URL Base | Which Expert24 environment to use | `https://aph-uat.expert-24.net` |
| Member Id | The member taking the assessment; must exist in the target environment | `ABC_TMJarrett` |
| Language | English or Spanish | English |
| E24 Assessment ID | Which questionnaire to run | Healthy Aging Member Satisfaction Survey (10657) |
| E24 Traversal ID / E24 Member ID | Fill **both** to resume an unfinished assessment; leave **both** blank to start fresh | blank |
| Assessment Start Data (prepop) | JSON facts the assessment's rules need (DOB, gender, …) | a sample payload |

Then:

- **Start Assessment** — loads the control and shows the first question.
- Answer, then **Next** / **Previous** to move through the questions.
- At the end, a **Assessment Completion JSON** box appears on the right with the
  full results — every question and answer, plus alerts, care-plan items and
  recommendations.
- **Restart Assessment** — tears the control down and rebuilds it from scratch.

---

## Driving it from Python locally

`scripts/e24_proxy_client.py` is a command-line client for the same assessment
API. One thing to get straight before you use it:

> **The Python client does not talk to the Angular app.** It talks to the
> backend. Starting `ng serve` creates a web page on port 4200 — it does not
> create an `/api/E24Proxy` endpoint for anything to call.

So "run it locally and hit it with the script" means running a *backend*
locally, and pointing the script at that. Two ways:

**With the mock (nothing else needed).** In one terminal:

```bash
python3 scripts/mock_e24_proxy.py
```

In another:

```bash
# Is it reachable? Starts an assessment, fetches question 1, stops.
./scripts/e24_proxy_client.py smoke \
    --base-url http://127.0.0.1:8099 \
    --e24-url  https://aph-uat.expert-24.net \
    --member-id ABC_TMJarrett --algorithm-id 10657

# Walk the whole assessment in the terminal.
./scripts/e24_proxy_client.py run \
    --base-url http://127.0.0.1:8099 \
    --e24-url  https://aph-uat.expert-24.net \
    --member-id ABC_TMJarrett --algorithm-id 10657 \
    --save results.json
```

**With the real Clinical Content Service.** Identical, but point `--base-url` at
wherever it is listening — `http://localhost:9991` for a local checkout, or the
deployed host:

```bash
./scripts/e24_proxy_client.py smoke \
    --base-url http://localhost:9991 \
    --e24-url  https://aph-uat.expert-24.net \
    --member-id ABC_TMJarrett --algorithm-id 10657
```

The two URL options are the pair people mix up:

| Option | What it means |
| --- | --- |
| `--base-url` | The service **you are calling** — the mock, a local Clinical Content Service, or a deployed one |
| `--e24-url` | The Expert24 environment that service should **forward to**; sent as the required `expert24urlBase` query parameter |

Both can come from the environment instead, which saves a lot of typing:

```bash
export E24_BASE_URL=http://127.0.0.1:8099
export E24_URL_BASE=https://aph-uat.expert-24.net
export E24_MEMBER_ID=ABC_TMJarrett
export E24_ALGORITHM_ID=10657

./scripts/e24_proxy_client.py run
```

Run `./scripts/e24_proxy_client.py --help` for the individual endpoint
subcommands (`start`, `first`, `next`, `previous`, `continue`, `info`, `qa`,
`begin-continue`), which are useful for poking at one call at a time.

### Running the UI and the script against the same backend

They are two clients of one service, so nothing stops you doing both at once:

```
  ng serve        →  http://localhost:4200   ─┐
                                              ├─→  http://127.0.0.1:8099   →  Expert24
  e24_proxy_client.py                        ─┘      (mock, or the real service)
```

Start the backend first, then the tester, then the script. With the mock running
in the foreground you will see both clients' requests appear in its log, which is
the quickest way to compare what the control sends against what the script sends.

---

## When things go wrong

**`sh: 1: ng: Permission denied`**
`node_modules/.bin/ng` lost its execute bit, or the disk is mounted `noexec`.
This happens when `node_modules` is copied from another machine, unzipped from an
archive, or installed by a different user than the one running the build. Run the
CLI through `node` instead — it works either way, because nothing is being
executed directly:
```bash
node node_modules/@angular/cli/bin/ng.js build assessment-ctrl --configuration production
```
To fix it properly so plain `npx ng` works again:
```bash
chmod +x node_modules/.bin/*
```
If that still fails, the exec bit was never the problem — reinstall as the user
who will run the build:
```bash
rm -rf node_modules package-lock.json
npm install
```

**"Cannot find module 'assessment-ctrl'"**
Step 2 was skipped or failed. Build the library, then try again.

**"Port 4200 is already in use"**
Something else is on that port — often a dev server you forgot to stop. Either
stop it, or pick another port:
```bash
npx ng serve --port 4300
```

**The Python client reports `HTTP 404` or `no such route`**
`--base-url` is pointing at something that is not the proxy service — commonly
the Angular dev server on port 4200, which serves a web page and has no API.
Point it at the backend: `http://127.0.0.1:8099` for the bundled mock, or
wherever the Clinical Content Service is listening.

**A red error banner in the tester**
The control could not reach its backend. Check which mode the checkbox is in, and
that the matching URL field points somewhere that is actually running.

**CORS errors in the browser console**
You are in direct mode (Mode B) and Expert24 is not allowing calls from
`localhost`. Use the proxy instead (Mode A).

**A library change isn't showing up**
Rebuild the library and restart the server. See the table above.

**`npm install` warnings about vulnerabilities**
Expected. Leave them. `npm audit fix --force` will break the build.

---

## Quick reference

```bash
# one time
npm install

# build the library (repeat after every library change)
npx ng build assessment-ctrl --configuration production

# build the tester (optional; ng serve does it too)
npx ng build assessment-ctrl-tester

# run it → http://localhost:4200/
npx ng serve
```

```bash
# a fake backend, so the UI and the Python client have something to call
python3 scripts/mock_e24_proxy.py

# check the backend from the command line
./scripts/e24_proxy_client.py smoke --base-url http://127.0.0.1:8099 \
    --e24-url https://aph-uat.expert-24.net \
    --member-id ABC_TMJarrett --algorithm-id 10657
```

Shortcut scripts already defined in `package.json`:

| Command | What it does |
| --- | --- |
| `npm run buildctrl` | Production build of the library (same as step 2) |
| `npm run packagectrl` | Packs `dist/assessment-ctrl` into a `.tgz` |
| `npm run buildandpackagectrl` | Both — this is what you run to ship a new version |
| `npm start` | Same as `ng serve` |

To install the packaged library into another application, see the deploy section
of the root `README.md`.

For what the project actually *is* and how the pieces fit together, see
[`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md).
