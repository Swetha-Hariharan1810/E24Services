# Deployment and Hosting Guide

Step-by-step instructions in plain language. Every command and output below was
run against this repository and confirmed.

---

## First: which "deploy" do you mean?

"Deploying this project" means one of two quite different things, and it is worth
being clear which one you want before you start.

| | **Path A — Ship the library** | **Path B — Host the tester** |
| --- | --- | --- |
| What you deploy | A `.tgz` package installed into another application | A website (HTML/JS/CSS files) |
| Who consumes it | Developers of the portal, Axis, AIP, UM apps | People opening a browser |
| Where it ends up | Inside someone else's app bundle | On a web server (Tomcat, nginx, IIS…) |
| How often | Whenever the control changes | Rarely — it is a developer test tool |

**Path A is the real product.** This repository exists to produce a reusable
control. The tester is a harness for trying it out.

One thing neither path changes: **the backend is not in this repository.** The
control talks to the Clinical Content Service (`api/E24Proxy/...`), which lives in
a separate repo and is deployed separately. Deploying anything here does not
deploy that.

---

# Path A — Shipping the library to a consuming application

## Step 1 — Decide the version number

Open `projects/assessment-ctrl/package.json` and bump `version`. It is currently
`2.0.1`.

This matters more than it looks: **the version number becomes the filename of the
package.** Version `2.0.1` produces `assessment-ctrl-2.0.1.tgz`. If you ship a
change without bumping the version, consuming applications can easily end up
installing a stale cached copy.

Also add a line to `projects/assessment-ctrl/README.md` describing what changed —
that file is the control's change log.

> ⚠️ **Heads-up:** the root `README.md` deploy instructions refer to
> `assessment-ctrl-0.0.1.tgz`. That filename is out of date. The build currently
> produces **`assessment-ctrl-2.0.1.tgz`**. Use the filename that the build
> actually writes, not the one in the README, or `npm install` will fail with a
> file-not-found error.

## Step 2 — Build and package

From the repository root:

```bash
npm run buildandpackagectrl
```

That is a shortcut for a production build followed by `npm pack`. Confirmed
output:

```
Built assessment-ctrl → dist/assessment-ctrl
filename: assessment-ctrl-2.0.1.tgz
package size: 151.5 kB
unpacked size: 919.3 kB
total files: 29
```

Your package is at:

```
dist/assessment-ctrl/assessment-ctrl-2.0.1.tgz
```

It contains the compiled bundles, TypeScript type definitions, and the control's
three images under `package/assets/images/`.

## Step 3 — Copy the package into the consuming application

Copy the `.tgz` into the target application's controls folder. For the portal and
Axis projects that is `controls/`:

```bash
cp dist/assessment-ctrl/assessment-ctrl-2.0.1.tgz  /path/to/portal/controls/
```

## Step 4 — Install it in the consuming application

Work inside the consuming application from here on.

The dependency is installed from a local file path, not from a registry. The line
in its `package.json` looks like:

```json
"assessment-ctrl": "file:./controls/assessment-ctrl-2.0.1.tgz"
```

Because npm caches file-path packages aggressively, a plain `npm install` over the
top often does **not** pick up a new build. Do the uninstall/reinstall dance:

1. Copy that dependency line somewhere — you are about to delete it.
2. `npm uninstall assessment-ctrl`
3. Paste the line back into `package.json`, with the **new** filename if the
   version changed.
4. `npm install`
5. Confirm `node_modules/assessment-ctrl/` now exists and its `package.json`
   shows the version you expect.

## Step 5 — Wire up the control's images ⚠️

**This step is missing from the root README and is a common cause of broken
icons.**

The control's template references images by relative path:

```html
<img src="assets/images/help_text.png">
<img src="assets/images/loading_small.gif">
```

Those files ship *inside* the package (`node_modules/assessment-ctrl/assets/images/`),
but Angular does **not** automatically copy a library's assets into your app's
output. If you skip this, the control works but shows broken-image icons where the
help and loading indicators should be.

Pick one of two fixes in the consuming application's `angular.json`, under the
build target's `assets` array:

**Option 1 — copy them from the package at build time (preferred, stays in sync):**

```json
"assets": [
  "src/favicon.ico",
  "src/assets",
  {
    "glob": "**/*",
    "input": "node_modules/assessment-ctrl/assets",
    "output": "assets"
  }
]
```

**Option 2 — copy the three images into your own `src/assets/images/` folder.**
This is what the tester app in this repository does. Simpler, but the copies drift
out of date if the control's images ever change.

The three files are `help_text.png`, `loading_small.gif` and
`calendar_icon_small.png`.

## Step 6 — Build the consuming application

```bash
npm run build          # or: ng build --configuration production
```

## Step 7 — Deploy the consuming application

Copy the contents of its `dist/` folder to wherever that application is served —
for example an external Tomcat instance's `webapps/<your-app>/` folder.

## Step 8 — Clear the browser cache, then test ⚠️

Do not skip this. Stale cached JavaScript is the single most common reason a
freshly deployed control change "didn't work". In Chrome, `Ctrl+Shift+Delete` →
clear cached files, or use a hard reload (`Ctrl+F5`), or test in a private window.

Then start the application and walk through an assessment end to end.

---

# Path B — Hosting the tester application

The tester is a plain static single-page application: HTML, JavaScript, CSS and
images. Any static web server can host it — Tomcat, nginx, Apache, IIS, S3 behind
CloudFront. No Node.js runtime is needed on the server.

## Step 1 — Build the library first

```bash
npm install
npx ng build assessment-ctrl --configuration production
```

The tester will not compile without this — it imports the library from `dist/`.

## Step 2 — Build the tester for production

```bash
npx ng build assessment-ctrl-tester --configuration production
```

Confirmed output — about 1.4 MB raw, 265 kB over the wire:

```
main.8012351481ca158d.js      | main      | 1.02 MB
styles.cacb651d9fb605e4.css   | styles    | 259.75 kB
scripts.506571f04a65adfc.js   | scripts   | 88.53 kB
polyfills.82b4b771a5779515.js | polyfills | 34.91 kB
runtime.2400f07608cc0ae4.js   | runtime   | 1.15 kB
```

Everything lands in **`dist/assessment-ctrl-tester/`** — `index.html` sits at the
top level of that folder, with the bundles, fonts and an `assets/` folder beside
it. Filenames carry a content hash, so browsers pick up new deployments
automatically instead of serving stale files.

## Step 3 — Set the base href if you are hosting in a subfolder ⚠️

The build writes `<base href="/">` into `index.html`. That is correct only if the
app sits at the **root** of its domain (`https://server/`).

If it will live in a subdirectory — which is exactly what Tomcat does, serving
`webapps/assessment-tester/` as `https://server/assessment-tester/` — you must say
so at build time:

```bash
npx ng build assessment-ctrl-tester --configuration production --base-href /assessment-tester/
```

Include both leading and trailing slashes. Get this wrong and you get a blank
white page with 404s for every `.js` file in the browser console.

## Step 4 — Copy the files to the server

Copy the **contents** of `dist/assessment-ctrl-tester/` (not the folder itself) to
the server's document root.

**Tomcat**
```bash
cp -r dist/assessment-ctrl-tester/  $TOMCAT_HOME/webapps/assessment-tester/
```
No WAR file or `web.xml` is needed for static content.

**nginx**
```bash
cp -r dist/assessment-ctrl-tester/*  /usr/share/nginx/html/
```

**Any quick local check** — confirmed working:
```bash
cd dist/assessment-ctrl-tester && python3 -m http.server 8088
# then open http://localhost:8088/
```
Verified: `index.html`, the JS bundles and `assets/images/help_text.png` all
return HTTP 200 from a plain static server with no extra configuration.

## Step 5 — Reach the backend

A hosted tester still needs something to talk to, and now the browser is on a real
server rather than your laptop:

- `http://localhost:9991` will **not** work for anyone but you. Set the "Sagility
  Web Service URL Base" field to a hostname the user's browser can actually
  resolve.
- Mixed content: if the tester is served over **https**, the browser blocks calls
  to **http** backends. Serve both over https, or neither.
- CORS: the backend must allow requests from the tester's origin. In direct mode
  (talking straight to Expert24 from the browser) this is very likely to be
  blocked — that is the whole reason the proxy exists.

---

## Things worth knowing before you deploy

**Source maps are switched on in production builds.**
`angular.json` sets `"sourceMap": true` under the production configuration for the
tester, so the build emits five `.map` files alongside the bundles. Anyone who
opens developer tools can read the original TypeScript. That is fine for an
internal developer tool, but if this is ever exposed more widely, either set
`"sourceMap": false` or delete the `*.map` files before copying to the server.

**Pick the right Expert24 environment.**
Authoring, QA, UAT and production each have their own URL. The tester defaults to
UAT (`https://aph-uat.expert-24.net`). Shipping something pointed at the wrong
environment means real data in the wrong place.

**The assessment dropdown is hand-maintained.**
The list of assessments in the tester is hard-coded in `app.component.ts`. It is
not fetched from Expert24, so it silently goes stale as clinical content changes.

**Nothing here deploys the backend.**
The `api/E24Proxy` service is a separate repository with its own deployment
process. Both documents in this repo's root describe its API, but not how to
release it.

---

## Quick reference

**Ship a new version of the library:**
```bash
# 1. bump "version" in projects/assessment-ctrl/package.json
# 2. note the change in projects/assessment-ctrl/README.md
npm run buildandpackagectrl
# 3. copy dist/assessment-ctrl/assessment-ctrl-<version>.tgz to the consuming app
# 4. in that app: npm uninstall assessment-ctrl → restore the file: line → npm install
# 5. make sure its angular.json copies the control's assets (Step 5 above)
# 6. build and deploy that app, then clear the browser cache
```

**Host the tester:**
```bash
npm install
npx ng build assessment-ctrl --configuration production
npx ng build assessment-ctrl-tester --configuration production --base-href /your-path/
# copy the contents of dist/assessment-ctrl-tester/ to the web server
```

Related documents:
[`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) — what the project is and how it works ·
[`RUNNING_LOCALLY.md`](./RUNNING_LOCALLY.md) — running it on your own machine
