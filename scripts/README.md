# Assessment API scripts

Three command-line tools for talking to the assessment API without a browser —
useful for checking a deployment is alive, walking an assessment end to end, or
seeing exactly what the control sends.

All three are **standard library only**. No `pip install`. Python 3.8 or newer.

| Script | Speaks | Use it when |
| --- | --- | --- |
| `e24_direct_client.py` | Expert24 direct — `/webbuilder/TraversalService/*` | You are on the dev-server proxy setup (the **Use Expert24 Direct APIs** path) |
| `e24_proxy_client.py` | Sagility proxy — `/api/E24Proxy/*` | The Clinical Content Service is running |
| `mock_e24_proxy.py` | Both, with canned answers | You want to test with no backend and no network |

Picking the wrong client gives you a 404 on every call. If you are unsure which
you are on: if you had to set **Expert24 URL Base** to `http://localhost:4200`,
you are on the direct path.

> **Neither client talks to the Angular app.** They talk to whatever serves the
> API. `ng serve` creates a web page on port 4200; on its own it creates no API.
> What makes `http://localhost:4200` a usable `--base-url` is `proxy.config.json`
> forwarding `/webbuilder` to Expert24.

---

## Quick start

With `ng serve` already running (it picks up `proxy.config.json` automatically):

```bash
./scripts/e24_direct_client.py run --member-id ABC_TMJarrett --algorithm-id 10657
```

`--base-url` defaults to `http://localhost:4200`, so you can leave it out.

To try the scripts with no backend at all, start the mock in one terminal:

```bash
python3 scripts/mock_e24_proxy.py
```

and point a command at it:

```bash
./scripts/e24_direct_client.py run --base-url http://127.0.0.1:8099 \
    --member-id ABC_TMJarrett --algorithm-id 10657 --auto
```

(The proxy client needs `--e24-url` as well, since that parameter is what it
passes along to say which Expert24 to forward to.)

---

## The three calls

An assessment runs on three endpoints, one subcommand each.

| Subcommand | Endpoint | What it gives you |
| --- | --- | --- |
| `start` | `POST /Member` | A traversal id and an Expert24 member id |
| `question` | `POST /First` or `POST /Next` | One question at a time |
| `qa` | `GET /QA/{traversalId}` | Every question and answer recorded |

`run` does all three in sequence. Start there.

### `start` — open a traversal

```bash
./scripts/e24_direct_client.py start --member-id ABC_TMJarrett
```

**Success looks like this:**

```
traversal id  : T-1
e24 member id : M-99

Both are needed by every later call. Pass them to 'question' and 'qa'.
```

Two ids, no error. Keep both — every later call needs them. If you see them, the
member exists in that Expert24 environment and the network path works, which is
most of what can go wrong.

### `question` — fetch a question

Omit `--node-id` for the first question; pass it to answer one and get the next.

```bash
./scripts/e24_direct_client.py question \
    --traversal-id T-1 --e24-member-id M-99 --algorithm-id 10657
```

**Success looks like this:**

```
Do you currently smoke?
  [1] Yes
  [2] No

  node=1  algo=555  type=single
```

A question, its options, and the three values you need for the next call. The
`type` tells you what an answer must look like:

| `type` | Means | Answer with |
| --- | --- | --- |
| `single` | Radio buttons — pick one | `--answer 1` |
| `multi` | Checkboxes — pick any number | `--answer 1 --answer 2` |
| `value` | Type something in | `--answer 1=180` |

Answering node 1 with option 1:

```bash
./scripts/e24_direct_client.py question \
    --traversal-id T-1 --e24-member-id M-99 --algorithm-id 555 \
    --node-id 1 --answer 1
```

**Watch `algo=` between questions.** It changes — `555` then `556` in the sample
run below. Expert24 moves a traversal between algorithms mid-assessment, so pass
the id from the *latest* response, not the one you started with. (`run` handles
this for you.)

When there are no questions left:

```
The assessment is complete - no further questions.
```

### `qa` — read back what was recorded

```bash
./scripts/e24_direct_client.py qa --traversal-id T-1
```

**Success looks like this:**

```
3 recorded answer(s):

  Q: Do you currently smoke?
  A: Yes

  Q: Which of these apply to you?
  A: High blood pressure

  Q: What is your current weight?
  A: 180 Pounds
```

A count above zero and the answers you gave. `The QA endpoint returned no
recorded answers.` means the call worked but Expert24 has nothing stored for that
traversal — usually the wrong traversal id, or an assessment that was never
answered.

---

## `run` — all three, end to end

```bash
./scripts/e24_direct_client.py run --member-id ABC_TMJarrett --algorithm-id 10657
```

It prompts for each answer. Add `--auto` to take the first option every time and
run unattended, and `--save results.json` to write the final response and the QA
to a file.

**A successful run looks like this** (against the mock, `--auto`):

```
Expert24 via : http://127.0.0.1:8099/webbuilder/TraversalService
Member       : ABC_TMJarrett
Assessment   : 10657

[1] POST /Member ...
    traversal id T-1, e24 member id M-99

[2] POST /First ...
    assessment 'Mock Health Assessment'

----------------------------------------------------------------------
Do you currently smoke?
  [1] Yes
  [2] No

  node=1  algo=555  type=single
----------------------------------------------------------------------
  auto-answering: {'1': ''}
[3] POST /Next/T-1/M-99/555/1 ...

... one block per question ...

======================================================================
Finished after 3 question(s).
======================================================================

Conclusions: 3
  [Alert] Smoking risk identified
  [Goal] Agree a quit-smoking plan
  [Goal] Review weight at next visit

[4] GET /QA/T-1 ...
3 recorded answer(s):

  Q: Do you currently smoke?
  A: Yes
  ...
```

The four things that say it worked:

1. **`[1]` prints two ids** — the traversal opened.
2. **`[2]` names the assessment** — `assessment 'Mock Health Assessment'`. A real
   run names the real questionnaire. An empty name means Expert24 has no such
   algorithm for that member.
3. **`Finished after N question(s)`** — the traversal ran to completion rather
   than stopping on an error.
4. **`[4]` lists the answers back** — Expert24 stored what you sent.

Exit code `0` means all of that. Check it in a script with `echo $?`.

---

## When it does not work

| Exit code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | The call failed — bad URL, network, or Expert24 returned an error |
| `2` | A required option is missing |
| `130` | You pressed Ctrl-C |

Every failure prints what went wrong and what to check. The ones you are most
likely to hit:

**`Could not reach ... Connection refused`**
Nothing is listening. Is `ng serve` running? Is `--base-url` right?

**`... did not return JSON. first bytes: <!doctype html ...`**
`--base-url` points at a web page, not the API. If it is the Angular dev server,
`proxy.config.json` is missing or `ng serve` did not pick it up.

**`HTTP 401` or `HTTP 403`**
You reached Expert24 and it refused. This is progress — it means the network path
works and the problem is credentials or permissions for that member.

**`HTTP 404`**
Wrong path or wrong base URL. Most often the two clients mixed up: this one wants
`/webbuilder/TraversalService`, the other wants `/api/E24Proxy`.

**`The start response carried no Table entry`**
Expert24 accepted the call but opened no traversal. Usually the member id is
unknown in that environment, or a required prepop value is missing.

Add `-v` to any command to print every request and response on stderr. That is
the fastest way to see what actually went over the wire.

---

## Testing offline

`mock_e24_proxy.py` stands in for both backends with canned answers — a
three-question assessment, conclusions, and a QA response.

```bash
python3 scripts/mock_e24_proxy.py            # 127.0.0.1:8099, Ctrl-C to stop
python3 scripts/mock_e24_proxy.py --port 9000 --quiet
```

It prints every request it receives, which makes it a practical way to compare
what a script sends against what the control sends. It also serves CORS headers,
so the Angular tester can point at it too — put `http://127.0.0.1:8099` in the
**Sagility Web Service URL Base** field.

It is a test double: fixed answers, nothing stored, no authentication. Do not run
it anywhere it could be mistaken for a real service.

---

## Environment variables

Instead of repeating options:

| Variable | Replaces |
| --- | --- |
| `E24_DIRECT_URL` | `--base-url` (direct client) |
| `E24_BASE_URL` | `--base-url` (proxy client) |
| `E24_URL_BASE` | `--e24-url` (proxy client) |
| `E24_MEMBER_ID` | `--member-id` |
| `E24_ALGORITHM_ID` | `--algorithm-id` |
| `E24_LANGUAGE` | `--language` |

One trap: the two clients use different language values — the direct API wants
`MEMBER` or `SPANISH`, the proxy API wants `eng` or `spa`. `E24_LANGUAGE` is read
by both, so a value set for one is wrong for the other. Prefer `--language` if you
use both.

```bash
export E24_MEMBER_ID=ABC_TMJarrett
export E24_ALGORITHM_ID=10657

./scripts/e24_direct_client.py run
```

---

For how the local setup fits together, and why the dev-server proxy is needed at
all, see [`../docs/RUNNING_LOCALLY.md`](../docs/RUNNING_LOCALLY.md).
