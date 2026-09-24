# E24Services — Project Overview

A detailed, plain-language guide to what this repository contains, how the pieces
fit together, and how to build, run and ship it.

---

## 1. The short version

This repository builds **a reusable Angular UI component that shows a health
assessment (a questionnaire) to a user, one question at a time.**

The questions themselves do not live in this repository. They live in the cloud,
in a third-party system called **Expert24 (E24)** — a clinical-content platform
based in England that Sagility uses to author and run assessments. Expert24 holds
the questions, the answer options, the branching rules ("if the member says yes,
ask this next"), and the final scoring/recommendations.

So this repository is essentially **the face of Expert24**: it asks Expert24
"what's the next question?", draws that question on screen, collects the answer,
sends it back, and repeats until Expert24 says the assessment is finished. At the
end it hands the host application a single package of results — every question and
answer, plus any alerts, care-plan items and recommendations the assessment
produced.

The repository contains two Angular projects:

| Project | Type | What it is |
| --- | --- | --- |
| `assessment-ctrl` | Angular **library** | The shippable product: the assessment control. Packaged as a `.tgz` and installed into other applications. |
| `assessment-ctrl-tester` | Angular **application** | A developer harness: a web page with input boxes for every setting, so you can start an assessment and click through it without needing a host app. |

Plus two Word specifications that describe the same system from the
integration/API side:

- `Assessment Control Integration-v3.docx` — how to embed the control in an Angular app.
- `Assessment Expert24 Proxy Integration-v1.docx` — describes the Sagility backend
  proxy (`api/E24Proxy`). **That backend is not in this repository and is not
  available to us today** — see the status box below.

> ### ⚠️ Current status: we do NOT have the `api/E24Proxy` backend
>
> The control can talk to Expert24 in two ways: through a Sagility backend proxy
> (`api/E24Proxy`), or directly. **Only the direct route works for us right now.**
>
> | Piece | In this repo? | Usable today? |
> | --- | --- | --- |
> | `api/E24Proxy` backend (ASP.NET, Clinical Content Service) | **No** — lives in a separate repo we don't have | **No** |
> | `E24ProxyHttpService` — the Angular *client* that would call that backend | Yes | Only against the mock below |
> | `proxy.config.json` — the Angular dev-server proxy that forwards `/webbuilder/*` to Expert24 UAT | Yes | **Yes** — this is what we actually use |
> | `scripts/mock_e24_proxy.py` — a fake `api/E24Proxy` with canned answers | Yes | Yes, for offline testing only |
>
> Although it contains the word "proxy", `proxy.config.json` is **not** the
> `api/E24Proxy` backend. It's a development-only feature of `ng serve` that
> forwards requests straight to Expert24, so the control is running in **direct mode**.
> How to set it up is in [`RUNNING_LOCALLY.md`](RUNNING_LOCALLY.md) under
> *Making Mode B work locally*.
>
> Anything in this document about "proxy mode" describes the **intended**
> production design from the Word spec, not something we can run.

---

## 2. Why the project exists

Sagility applications (AIP, Utilization Management, the Agent Portal, Axis, and
others) all need to put assessments in front of members — health risk
assessments, satisfaction surveys, care-manager intake questionnaires, UM review
questionnaires, and so on.

Without a shared component, every application would have to learn Expert24's API,
understand its question format, and re-implement radio buttons, checkboxes,
height/weight spinners, date pickers, "Don't know" handling, Spanish labels,
validation and the Next/Previous flow. That is a lot of duplicated, easy-to-get-wrong work.

This project solves that once. A host application drops in one HTML tag, passes a
handful of inputs, and listens for one "assessment is complete" event.

---

## 3. The big picture — how a question gets on screen

```
┌──────────────────────────────────────────────────────────────────────┐
│ Consuming Angular application (AIP / UM / portal / the tester app)   │
│                                                                      │
│   <assmnt-assessment-ctrl  [memberId]=… [assessmentAlgorithmId]=…    │
│                            (assessmentIsComplete)=…>                 │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │ assessment-ctrl  (this repository's library)                 │   │
│   │                                                              │   │
│   │   AssessmentCtrlComponent   ← screen + buttons + validation  │   │
│   │            │                                                 │   │
│   │   E24MapperService          ← E24 answer rows → asset shape  │   │
│   │   AssessmentMapperService   ← asset shape → UI question model│   │
│   │            │                                                 │   │
│   │   E24ProxyHttpService  or  E24HttpService    ← HTTP calls    │   │
│   └──────────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  HTTPS
              ┌─────────────────┴──────────────────┐
              │                                    │
   ┌──────────▼───────────┐             ┌──────────▼─────────────┐
   │ Clinical Content     │             │ ng serve dev-server    │
   │ Service              │             │ proxy (localhost:4200) │
   │  api/E24Proxy/*      │             │ proxy.config.json      │
   │ ✗ NOT IN THIS REPO   │             │ ✓ WHAT WE USE TODAY    │
   │ ✗ NOT AVAILABLE      │             │   (dev only)           │
   └──────────┬───────────┘             └──────────┬─────────────┘
              │ forwards                           │ forwards
              └─────────────────┬──────────────────┘
                     ┌──────────▼─────────────┐
                     │  Expert24 cloud APIs   │
                     │  /webbuilder/          │
                     │   TraversalService/*   │
                     │  (England)             │
                     └────────────────────────┘
      "proxy mode"                          "direct mode"
   (intended design)                      (current reality)
```

Two routes to the same destination:

- **Proxy mode — the intended production design, but not available to us.** The
  control calls a Sagility-hosted backend (`api/E24Proxy/...`) which forwards the
  request to Expert24. The Word spec describes this as the production route: it
  keeps Expert24 credentials and endpoints on the server, gives one place to log and
  secure traffic, and avoids browser cross-origin problems. The backend lives in
  the Clinical Content Service repo
  (`/source/Components/ClinicalContent/ContentService`), which is **not part of
  this repository and which we do not currently have**. This repository contains
  only the *client* side (`E24ProxyHttpService`) and a mock
  (`scripts/mock_e24_proxy.py`) for testing it.
- **Direct mode — what actually works today.** The control calls Expert24's
  `/webbuilder/TraversalService/...` endpoints itself. From a browser this is
  normally blocked by CORS, so during development we route it through the Angular
  dev server: `proxy.config.json` forwards `/webbuilder/*` from `localhost:4200`
  to `https://aph-uat.expert-24.net`. This only works while `ng serve` is running,
  so a deployed build can't use it.

**How to tell the two "proxies" apart:** `api/E24Proxy` is the Sagility backend
we don't have. `proxy.config.json` is a setting for Angular's own dev server that
passes requests straight through to Expert24. They share a name but are unrelated.

---

## 4. Key vocabulary

| Term | Meaning |
| --- | --- |
| **Expert24 / E24** | The third-party cloud platform that authors and runs the assessments. |
| **Algorithm ID** (`assessmentAlgorithmId`) | The numeric ID of a specific assessment inside Expert24 — e.g. `9045` = Care Manager Initial Assessment. Choosing an assessment means choosing an algorithm ID. |
| **Traversal ID** (`e24TraversalId`) | The ID of *one run* of an assessment by *one member*. Created when the assessment starts. Save it if you ever want to resume an unfinished assessment. |
| **E24 Member ID** (`e24MemberId`) | Expert24's own internal ID for the member, returned at start time. Distinct from your application's `memberId`. |
| **Node ID** | Expert24's pointer to the current position in the question flow. The control tracks it and sends it back when asking for the next question. |
| **Prepop** | "Pre-populated" data. A JSON object of facts you already know about the member (date of birth, gender, first name, risk flags…). Expert24's rule engine uses it to skip questions or steer branching. |
| **Conclusion** | An outcome Expert24 emits at the end — categorised as `Alert`, `Goal` (care plan), `Default`, or report information. |
| **Traversal** | Expert24's word for walking through the question flow. Hence `TraversalService`. |

---

## 5. Repository layout

```
E24Services/
├── angular.json                  Angular workspace: defines both projects
├── package.json                  Workspace dependencies + build scripts
├── tsconfig.json                 Maps the name "assessment-ctrl" to dist/
├── tslint.json                   Linting rules (legacy TSLint)
├── README.md                     Build + deploy cheat-sheet
├── AssessmentControl.code-workspace
├── proxy.config.json             ng serve dev-server proxy: /webbuilder → Expert24 UAT
│                                 (NOT the api/E24Proxy backend)
│
├── Assessment Control Integration-v3.docx        Integration spec
├── Assessment Expert24 Proxy Integration-v1.docx Spec for the api/E24Proxy
│                                                 backend (not in this repo)
│
├── docs/
│   ├── PROJECT_OVERVIEW.md       ← this file
│   ├── RUNNING_LOCALLY.md        Local setup, the three run modes, troubleshooting
│   └── DEPLOYMENT.md             Shipping the control
│
├── scripts/                      Command-line API tools (Python, stdlib only)
│   ├── e24_direct_client.py      Talks to Expert24 /webbuilder directly
│   ├── e24_proxy_client.py       Talks to an api/E24Proxy backend (only the mock today)
│   └── mock_e24_proxy.py         Fake api/E24Proxy + /webbuilder with canned answers
│
└── projects/
    ├── assessment-ctrl/                    THE LIBRARY (the product)
    │   ├── ng-package.json                 ng-packagr build config
    │   ├── package.json                    Published name + version (2.0.1)
    │   ├── README.md                       Version history
    │   ├── assets/images/                  Help icon, loading gif, calendar icon
    │   └── src/
    │       ├── public-api.ts               What consumers are allowed to import
    │       └── lib/
    │           ├── assessment-ctrl.component.ts    ~1,400 lines: the brain
    │           ├── assessment-ctrl.component.html  The question screen
    │           ├── assessment-ctrl.component.css   Themable styling
    │           ├── assessment-ctrl.module.ts       NgModule wiring
    │           ├── assessment-api-client.ts        Interface + DI tokens
    │           ├── e24-http.service.ts             Direct-to-Expert24 calls
    │           ├── e24-proxy-http.service.ts       Client for api/E24Proxy (backend not in repo)
    │           ├── e24-mapper.service.ts           E24 payload → asset model
    │           ├── assessment-mapper.service.ts    Asset model → UI model
    │           ├── e24.dtos.ts                     Expert24 wire shapes
    │           └── assessment-ctrl.dtos.ts         UI-facing shapes + enums
    │
    └── assessment-ctrl-tester/             THE TEST HARNESS
        ├── src/app/app.component.ts        Form state + event handlers
        ├── src/app/app.component.html      Settings on the left, control on the right
        ├── src/app/app.module.ts           Imports PrimeNG + the library
        ├── src/environments/               prod / dev flags
        └── src/assets/theme/theme.css      CSS variables that skin the control
```

---

## 6. The library, file by file

### 6.1 `assessment-ctrl.component.ts` — the orchestrator

This is the heart of the project. It is an Angular component with the selector
`assmnt-assessment-ctrl`. Its responsibilities:

1. **Validate its own configuration** on `ngOnInit`. If `memberId`,
   `assessmentAlgorithmId` or `webserviceUrlBase` is missing, it emits an error
   and stops rather than making a doomed HTTP call.
2. **Decide whether to start fresh or resume.** If both `e24TraversalId` and
   `e24MemberId` were supplied, it resumes (begin-continue → continue). Otherwise
   it starts a new assessment (start → first question).
3. **Drive the question loop.** `getNextQuestion()` and `getPreviousQuestion()`
   call the API, pipe the response through the two mapper services, and refresh
   the screen state.
4. **Validate the user's input before advancing** — required questions must be
   answered (`isUserInputValid`), numeric entries must be within Expert24's
   min/max (`isUserInputInrange`), and pregnancy due dates must land between one
   month in the past and ten months in the future (`checkPregnancyDate`).
   Failures raise a PrimeNG confirm dialog rather than silently blocking.
5. **Handle the special "Don't know" / "Declined" radio buttons**, which disable
   the main input and substitute the corresponding Expert24 answer ID.
6. **Finish the assessment.** On the last question it calls the QA endpoint,
   assembles an `AssessmentFinalDto`, and emits it to the host.
7. **Localise.** `setLabels()` holds English strings and Spanish overrides;
   `translateToSpanish()` handles unit words (feet/inches/pounds).
8. **Clean up.** Every HTTP subscription is stored and unsubscribed in `ngOnDestroy`.

**Inputs (what the host application sets):**

| Input | Purpose |
| --- | --- |
| `memberId` | The host application's member identifier. Required. |
| `assessmentAlgorithmId` | Which Expert24 assessment to run. Required. |
| `webserviceUrlBase` | Base URL of the backend being called. Required. |
| `e24UrlBase` | Base URL of the Expert24 environment (authoring / QA / UAT / prod). |
| `useE24ProxyApi` | Selects which HTTP service is used (see the note in §10). |
| `language` | `'eng'` or `'spa'`. |
| `assessmentName` | Friendly name, used in the completion message. |
| `assessmentStartPrepop` | JSON string of prepopulation values. |
| `assessmentCompletedLabel` | Custom completion text; defaults to "The &lt;name&gt; has been completed." |
| `showAssessmentCompletedLabel` | Whether to show that text at all. |
| `e24TraversalId`, `e24MemberId` | Supply both to resume an unfinished assessment. |

**Outputs (what the host application listens for):**

| Output | Payload | When |
| --- | --- | --- |
| `assessmentTraversalIdSet` | `E24MemberIdTraversalIdDto` | Right after the assessment is initialised. **Persist this** — it is the only way to resume later. |
| `assessmentIsComplete` | `AssessmentFinalDto` | When the last question is answered; contains all Q&A plus conclusions. |
| `assessmentErrorOccurred` | `AssessmentErrorDto` | On any configuration or HTTP failure. |

### 6.2 `assessment-ctrl.component.html` — the screen

One template that renders whichever control type the current question needs,
selected by `questionType`:

- `MULTIPLE_CHOICE_SINGLE_SELECT` → PrimeNG radio buttons
- `MULTIPLE_CHOICE_MULTIPLE_SELECT` → PrimeNG checkboxes (with "none of the above" exclusivity)
- `FREE_TEXT` → a 200-character textarea
- `VALUEENTRY_WEIGHT` → one numeric spinner + unit label + min/max hint
- `VALUEENTRY_HEIGHT` → two numeric spinners (feet and inches)
- `VALUEENTRY_DATE` → a PrimeNG calendar

Plus the shared furniture: a help/info icon beside questions and answers that
opens a dialog, the optional "Don't know" and "Declined" radios, a loading
spinner, the completion message, and the Previous/Next buttons. Previous is
hidden on the first question; Next is disabled while loading or once the
assessment is ready to submit.

### 6.3 The two HTTP services

Both implement the same `AssessmentApiClient` interface, so the component can use
either interchangeably. The interface has eight methods, matching the eight
Expert24 operations.

**`E24HttpService` (direct)** builds Expert24 URLs itself:

| Method | Expert24 route |
| --- | --- |
| `startNewAssessment` | `POST /webbuilder/TraversalService/Member` |
| `beginContinueAssessment` | `POST /webbuilder/TraversalService/Prepop/{traversalId}/{e24MemberId}` |
| `continueAssessment` | `GET /webbuilder/TraversalService/GoBack/{traversalId}/{e24MemberId}/0/-1` |
| `getFirstQuestion` | `POST /webbuilder/TraversalService/First/{traversalId}/{e24MemberId}/{algoId}/0?Language=…` |
| `navigateToNextQuestion` | `POST /webbuilder/TraversalService/Next/{traversalId}/{e24MemberId}/{algoId}/{previousNodeId}` |
| `navigateToPreviousQuestion` | `GET /webbuilder/TraversalService/Previous/{traversalId}` |
| `getItemInfoText` | `GET /webbuilder/TraversalService/Info/{traversalId}/{noteType}/{itemId}` |
| `getPostCompleteData` | `GET /webbuilder/TraversalService/QA/{traversalId}` |

It also normalises language for Expert24's benefit: `spa`/`spanish` → `SPANISH`,
anything else → `MEMBER`.

It's the service used in the working setup today, with `proxy.config.json`
forwarding its `/webbuilder` calls to Expert24.

**`E24ProxyHttpService` (via the backend — client only)** is written to call the
Sagility proxy under `/api/E24Proxy`, URL-encoding every path segment and appending
`?expert24urlBase=<encoded e24UrlBase>` so the backend knows which Expert24
environment to forward to. The code is complete, but **the backend it calls is not
in this repository and we don't have access to it**. For now the only thing it can
talk to is `scripts/mock_e24_proxy.py`.

| Method | Proxy route |
| --- | --- |
| `startNewAssessment` | `POST /api/E24Proxy/start` |
| `beginContinueAssessment` | `POST /api/E24Proxy/begin-continue/{traversalId}/{e24MemberId}` |
| `continueAssessment` | `GET /api/E24Proxy/continue/{traversalId}/{e24MemberId}` |
| `getFirstQuestion` | `POST /api/E24Proxy/first/{traversalId}/{e24MemberId}/{algoId}?language=…` |
| `navigateToNextQuestion` | `POST /api/E24Proxy/next/{traversalId}/{e24MemberId}/{algoId}/{previousNodeId}` |
| `navigateToPreviousQuestion` | `GET /api/E24Proxy/previous/{traversalId}` |
| `getItemInfoText` | `GET /api/E24Proxy/info/{traversalId}/{noteType}/{itemId}` |
| `getPostCompleteData` | `GET /api/E24Proxy/qa/{traversalId}` |

The client sends structured JSON bodies (`{ MemberId, Prepop }`) and parses the
prepop string defensively: if the JSON is malformed it logs a message and sends
`{}` instead of throwing. (The Word spec also says the *backend* passes Expert24's
status code, body and content type back unchanged. That describes the missing
service, so we can't verify it from this repo.)

### 6.4 The two mapper services — why there are two

Expert24's response format is awkward: a question is a `Questions[0]` object whose
`Answers` array mixes real answer choices with UI hints (a "Feet" row and an
"Inches" row are two entries in the same array, as are the "Don't know" and
"Declined" radios). Rendering directly from that would put a lot of Expert24
trivia into the template.

So the payload is normalised in two hops:

**Hop 1 — `E24MapperService`: Expert24 wire format → a neutral "asset" model
(`E24WorkboxResponse`).**
It walks `Questions[0].Answers` and infers the shape of the question from the
`ControlType`/`ControlSubType` of each row:

- `checkbox` → multi-select
- `radio` → single-select, *unless* a checkbox or value-entry row was already
  seen, in which case the radio is an exclusive option or a Don't-know/Declined flag
- `text` + `number` → a value-entry question; `Feet`, `Inches` and `Pounds` rows
  become measure-unit values with hard-coded ranges (feet 0–10, inches 0–12, pounds 0–500)
- anything else → free text

It also extracts end-of-assessment data: `mapE24responseToAlertConclusions`
(category `Alert`), `…CarePlanConclusions` (category `Goal`),
`…DefaultConclusions` (everything else), plus content version, HRA status and
care-plan group, each pulled out of specially-named conclusion properties.

**Hop 2 — `AssessmentMapperService`: asset model → the UI model (`AssessmentDto`).**
It turns the asset into a `QuestionDto` carrying a concrete `QUESTION_TYPE`, a
built answer list, a status (`START` / `IN_PROGRESS` / `READY_TO_SUBMIT` /
`COMPLETE`), literacy text variants, a `responseUOM` array driving the numeric
spinners, and flags such as `isPregnancyDueDateQuestion` (matched by a known GUID).
It also cleans display text — newlines become `<br>`, `<b>` markers become an
`isToBeBold` flag — and subtracts 1 from each maximum so the spinner max is
exclusive.

### 6.5 The DTO files

- `e24.dtos.ts` — mirrors of the Expert24 wire format (`E24QuestionResponseDto`,
  `E24StartResponseDto`, `E24WorkboxResponse`, `Conclusion`, `Bullet`,
  `AssessmentFinalDto`, …). Names use Expert24's PascalCase because they are
  deserialised straight from its JSON.
- `assessment-ctrl.dtos.ts` — the UI-facing shapes and the two enums that the rest
  of the code branches on:
  - `QUESTION_TYPE`: `FREE_TEXT`, `MULTIPLE_CHOICE_SINGLE_SELECT`,
    `MULTIPLE_CHOICE_MULTIPLE_SELECT`, `RECOMMENDATION_FINALIZATION`,
    `RECOMMENDATION_DEFAULT`, `VALUEENTRY_DATE`, `VALUEENTRY_HEIGHT`, `VALUEENTRY_WEIGHT`
  - `ASSESSMENT_STATUS`: `NOT_STARTED`, `START`, `IN_PROGRESS`, `READY_TO_SUBMIT`, `COMPLETE`

### 6.6 `public-api.ts` — the published surface

Only five things are exported, and that is deliberate — the DTOs and mappers stay
internal:

```ts
export * from './lib/e24-http.service';
export * from './lib/e24-proxy-http.service';
export * from './lib/assessment-api-client';
export * from './lib/assessment-ctrl.component';
export * from './lib/assessment-ctrl.module';
```

---

## 7. The tester application

`assessment-ctrl-tester` is a single-page harness. The left pane is a form with
one field per control input; the right pane hosts the live control and, once the
assessment finishes, a read-only textarea containing the completion JSON
pretty-printed.

Useful details:

- **"Use Expert24 Direct APIs" checkbox** switches between direct and proxy mode.
  When it is ticked, the tester hides the Sagility service URL field and points
  `webserviceUrlBase` at `e24UrlBase`; when unticked it restores the previously
  typed Sagility URL. **It starts unticked (proxy mode), which fails for us** because
  nothing is running at `localhost:9991`. To get real questions, tick it and set
  **Expert24 URL Base** to `http://localhost:4200` so requests go through
  `proxy.config.json`. To test without any backend, leave it unticked, run
  `python3 scripts/mock_e24_proxy.py`, and point the Sagility URL at
  `http://127.0.0.1:8099`.
- **Assessment dropdown** is a hand-maintained list of algorithm IDs (Check In
  With Us `10798`, Healthy Aging Member Satisfaction Survey `10657`, Healthy Aging
  Assessment `10583`, Member Health Preference `10591`, Care Manager Initial
  Assessment `9045`, and several UM assessments). Expert24 does not publish this
  list, so it must be updated by hand as content changes.
- **Restart Assessment** tears the control down, waits one second on an RxJS
  `timer`, and re-creates it — a clean way to force a fresh `ngOnInit`.
- **Defaults** point at `http://localhost:9991` for the Sagility service (where the
  missing Clinical Content Service would run) and `https://aph-uat.expert-24.net`
  for Expert24 UAT, with a sample prepop payload.
- Errors emitted by the control are flattened into a red banner at the top left.

---

## 8. The assessment lifecycle, step by step

**Starting fresh** (no traversal ID supplied):

1. `ngOnInit` validates inputs and calls `startAssessment()`.
2. `startNewAssessment` → Expert24 creates the run and returns
   `Table[0].TraversalID` and `Table[0].MemberID`, which the control stores.
3. `getFirstQuestion` → the first question payload arrives.
4. The payload goes through both mappers; `assessmentTraversalIdSet` is emitted
   so the host can persist the IDs; the question renders.

**Resuming** (both traversal ID and E24 member ID supplied):

1. `ngOnInit` calls `beginContinueAssessment()`.
2. `begin-continue` re-applies prepop to the existing run.
3. `continue` (Expert24's `GoBack/.../0/-1`) returns the question the member left off on.
4. Same mapping and rendering path as above.

**Each Next click:**

1. Validate required-ness and numeric ranges; show a dialog and stop if invalid.
2. Build the answer body as `{"answerId":"value", …}` — answer IDs are Expert24's
   `Index` values, and free-text/numeric answers carry the typed value.
3. `navigateToNextQuestion` with the current node ID and algorithm ID.
   The algorithm ID is re-read from every response, because Expert24 can move the
   traversal into a different algorithm mid-assessment.
4. If the mapped status is `COMPLETE`, go to completion; otherwise render the next question.

**Each Previous click:** `navigateToPreviousQuestion` with just the traversal ID —
Expert24 remembers the position.

**Completion:**

1. Conclusions are sorted into alerts, care-plan goals, report information and
   defaults; content version, HRA status and care-plan group are extracted.
2. `getPostCompleteData` (QA) returns every answered question.
3. All of it is assembled into an `AssessmentFinalDto` and emitted via
   `assessmentIsComplete`. **This is the moment the host application saves the results** —
   the control itself persists nothing.

---

## 9. Building, running and shipping

### Technology

Angular 18.2, TypeScript 5.5, PrimeNG 18 with the Aura theme preset, PrimeFlex,
PrimeIcons, RxJS 7.8, ng-packagr for library packaging, Karma/Jasmine configured
for unit tests, Protractor for e2e, TSLint for linting.

### First-time setup

```bash
npm install
ng build assessment-ctrl --configuration production
ng build assessment-ctrl-tester
ng serve
```

Then open the tester in the browser (or press F5 against a VS Code debug launch
configuration).

Note the ordering constraint: `tsconfig.json` maps the import name
`assessment-ctrl` to `dist/assessment-ctrl`, so **the library must be built before
the tester can compile.**

### Day-to-day

- Changed the tester only → `ng serve` picks it up.
- Changed the library → rebuild the library, then `ng serve`.

### Handy scripts (`package.json`)

| Script | Does |
| --- | --- |
| `npm run buildctrl` | Production build of the library |
| `npm run packagectrl` | `npm pack` inside `dist/assessment-ctrl` → a `.tgz` |
| `npm run buildandpackagectrl` | Both of the above |

### Shipping to a consuming application

The library is distributed as a tarball installed from a local path, not from a
registry. The full procedure is in the root `README.md`; in outline:

1. `npm run buildandpackagectrl` to produce `assessment-ctrl-<version>.tgz`.
2. Copy the tarball into the consuming app (its `controls/` folder for portal and Axis).
3. In the consuming app: `npm uninstall assessment-ctrl`, restore the
   `"assessment-ctrl": "file:./controls/assessment-ctrl-0.0.1.tgz"` dependency
   line, then `npm install`.
4. Verify `node_modules/assessment-ctrl` exists, build the app, deploy `dist/` to
   the serving location (e.g. an external Tomcat `webapps/` folder).
5. Clear the browser cache — stale cached control files are a common cause of
   "my change didn't appear".

### Styling

The control deliberately inherits the host application's styling. It reads CSS
custom properties rather than hard-coding colours, so a host can restyle it by
redefining variables on `:root`:

```css
:root {
  --text-color: #000001;
  --primary-color: #0073e6;
  --primary-color-text: #ffffff;
  --font-family: Arial, Verdana, sans-serif;
  --font-size: .85rem;
  --letter-spacing: .05em;
}
```

Library version history lives in `projects/assessment-ctrl/README.md` (v0.0.8 dark
theme colour support, v0.0.9 fix for the Previous button being wrongly enabled on
the first question). Note that this history has not kept pace with the version in
`projects/assessment-ctrl/package.json`, which is `2.0.1`.

---

## 10. Observations and gotchas for maintainers

These are things a newcomer will otherwise lose time on. They are observations
about the current code, not instructions to change it.

1. **`useE24ProxyApi` reads backwards in the component.**
   `getAssessmentApiClient()` returns
   `this.useE24ProxyApi ? this._e24HttpService : this._e24ProxyHttpService` — so
   `true` selects the *direct* service. The tester compensates by labelling its
   checkbox "Use Expert24 Direct APIs", so the tester behaves correctly, but the
   input name means the opposite of what it does. Meanwhile
   `assessmentCtrlModule`'s `assessmentApiClientFactory` maps the flag the other
   way round (`useProxyApi ? proxyService : directService`). Any host application
   wiring this input from its own config should test both modes rather than trust
   the name.

2. **The `ASSESSMENT_API_CLIENT` injection token is effectively unused.**
   The module provides it via a factory, but the component injects
   `E24HttpService` and `E24ProxyHttpService` directly and picks between them
   itself. The token is dead weight unless a consumer opts into it deliberately.

3. **`showPreviousAnswer` is referenced in the template but never declared in the
   component.** Every "prior answer" block is therefore permanently hidden.
   `strictTemplates` is not enabled, which is why this compiles. The supporting
   code (`setPreviousAnswer`, `createPreviousAnswerModel`) exists but
   `createPreviousAnswerModel` is never called — prior-answer display looks like a
   half-finished feature.

4. **A dead branch in `E24MapperService`.** The date-question branch tests
   `answer.ControlType.toLowerCase() === 'text' && answer.ControlType.toLowerCase() === 'date'`
   — the same field compared to two different values, which can never both be
   true. The second and third comparisons were most likely meant to read
   `ControlSubType`. As written, date questions fall through to the free-text
   branch of this mapper.

5. **Value-entry ranges are hard-coded in the mapper** (feet 0–10, inches 0–12,
   pounds 0–500), and the template additionally hard-codes spinner `[min]`/`[max]`
   attributes (0–499, 0–9, 0–11). Expert24 content changes will not move these
   limits; the code has to.

6. **"Don't know" and "Declined" are detected by matching English answer text**
   (`don't know`, `doesn't know`, `does not know`, `do not know`, and any text
   starting with `decline`). Spanish or reworded content will not match, and the
   special handling will silently not engage.

7. **`E24HttpService` ignores the trailing `e24UrlBase` argument.** Its methods
   declare fewer parameters than the `AssessmentApiClient` interface — legal in
   TypeScript — because in direct mode `webserviceUrlBase` already *is* the
   Expert24 base URL.

8. **Error text is matched by prefix.** Expert24 signals missing prepop values by
   returning a question whose `DisplayText` begins with "We have encountered a
   problem". If Expert24 rewords that string, the control will render the error as
   a normal question.

9. **`projects/assessment-ctrl/__init__.py`** is an empty Python file in an
   Angular library. It has no function here.

10. **No unit tests are checked in.** Karma, Jasmine and Protractor are all
    configured and `src/test.ts` exists, but there are no `.spec.ts` files, so
    `npm test` currently exercises nothing.

---

## 11. Where to start reading

| If you want to… | Read |
| --- | --- |
| Embed the control in an app | `projects/assessment-ctrl-tester/src/app/app.component.html`, then §6.1 above |
| Understand the question flow | `assessment-ctrl.component.ts`: `ngOnInit`, `getFirstQuestion`, `getNextQuestion`, `completeAssessment` |
| Change how a question renders | `assessment-ctrl.component.html` + `QUESTION_TYPE` in `assessment-ctrl.dtos.ts` |
| Debug a wrong-looking question | `e24-mapper.service.ts` first, then `assessment-mapper.service.ts` |
| Change an endpoint | `e24-proxy-http.service.ts` (proxy) or `e24-http.service.ts` (direct) |
| Run it locally against real Expert24 | `docs/RUNNING_LOCALLY.md` → *Making Mode B work locally* (`proxy.config.json`) |
| Test with no backend at all | `scripts/mock_e24_proxy.py` and `scripts/README.md` |
| Understand the `api/E24Proxy` backend | `Assessment Expert24 Proxy Integration-v1.docx`. It's a spec only: the code lives in the Clinical Content Service repo, which we don't have |
| Ship a new version | root `README.md`, deploy section |
