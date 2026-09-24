# Testing Expert24 with curl

A step-by-step guide for calling Expert24 from a terminal with **curl**, and
seeing every response. Use this when Postman isn't allowed.

Every URL, header and body here is **exactly what
`scripts/e24_direct_client.py` sends**. The example values come from a real
run on UAT:

| What | Value |
|---|---|
| Member | `ABC_TMJarrett` |
| Assessment (algorithm) | `10657`: Healthy Aging Member Satisfaction Survey |
| Traversal ID we got | `cd6ed911-5ba5-40ac-a72d-ad3650516b50` |
| E24 member ID we got | `1492375` |

> Every **Start** creates a **new** traversal ID and E24 member ID, so yours
> will be different. The node IDs (487, 908, …) come from the assessment
> content, so they should match as long as you give the same answers.

For what each call means in more depth, see
[`EXPERT24_API_README.md`](EXPERT24_API_README.md).

---

## 0. Before you start

**Run this on the same machine where the Python script worked** (e.g.
`sh-dev-vm2-cpu`). That machine can already reach Expert24, and curl uses the
same network path.

Check the two tools are there:

```bash
curl --version
python3 --version
```

`python3` is only used to **pretty-print** JSON and **pull values out** of it.
Nothing needs installing: `jq` is not required.

There's no login or token. The script sends none.

---

## 1. Set up (once per terminal)

Copy and paste these lines:

```bash
# Expert24 UAT, exactly as the script builds it
B=https://aph-uat.expert-24.net/webbuilder/TraversalService

# the script's --member-id and --algorithm-id
MEMBER=ABC_TMJarrett
ALGO=10657
LANG_E24=MEMBER          # MEMBER = English, SPANISH = Spanish

# a folder to keep every response in
mkdir -p e24 && cd e24
```

The script sends these two headers on **every** call, so every curl below does
too:

```
-H 'Content-Type: application/json' -H 'Accept: application/json'
```

---

## 2. START: open a new assessment run

```bash
curl -sS -X POST "$B/Member" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"@UserID":"'"$MEMBER"'","callback":"raw"}' \
  -o start.json

python3 -m json.tool start.json
```

This is the exact body the script sent. With your values filled in, the request
is:

```
POST https://aph-uat.expert-24.net/webbuilder/TraversalService/Member
{"@UserID":"ABC_TMJarrett","callback":"raw"}
```

The quotes in `'"$MEMBER"'` look odd. They just drop your member ID into the
text.

You'll see something like:

```json
{
    "Table": [
        {
            "TraversalID": "cd6ed911-5ba5-40ac-a72d-ad3650516b50",
            "MemberID": "1492375",
            ...
        }
    ],
    ...
}
```

**Save the two IDs** into variables:

```bash
TID=$(python3 -c 'import json;print(json.load(open("start.json"))["Table"][0]["TraversalID"])')
MID=$(python3 -c 'import json;print(json.load(open("start.json"))["Table"][0]["MemberID"])')
echo "traversal id = $TID   e24 member id = $MID"
```

**With prepop facts** (the script's `--prepop`), use this body instead:

```bash
curl -sS -X POST "$B/Member" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"@UserID":"'"$MEMBER"'","callback":"raw","Prepop":{"DOB":"2010-01-06","FallPrevRiskLevel":"No","Gender":"Male","FirstName":"Jarrett","source_application":"AgentPortal"}}' \
  -o start.json
```

❌ **If `Table` is empty,** the member is unknown in UAT or a required prepop
value is missing.

---

## 3. A small helper to read questions

The raw question JSON is long. Paste this **once**. It defines a `show` command
that prints the question, its choices, and the numbers you need next:

```bash
show() {
python3 - "$1" <<'PY'
import json, re, sys
r = json.load(open(sys.argv[1]))
clean = lambda t: " ".join(re.sub(r"<[^>]+>", " ", str(t or "")).split())
if r.get("Error"):
    print("EXPERT24 ERROR:", r["Error"])
if r.get("Report") or not r.get("AlgoName"):
    print("=== FINISHED - no more questions. Now run QA (step 6). ===")
    for c in r.get("Conclusions") or []:
        print("  [%s] %s" % (c.get("Category"), clean(c.get("DisplayText"))))
else:
    q = (r.get("Questions") or [{}])[0]
    print("NODE=%s  ALGO=%s  (%s)" % (r.get("NodeID"), r.get("AlgoID"), r.get("AlgoName")))
    if q.get("Title"): print(clean(q.get("Title")))
    print(clean(q.get("DisplayText")))
    answers = q.get("Answers") or []
    for a in answers:
        print("  [%s] %s  (%s %s)" % (a.get("Index"), clean(a.get("DisplayText")),
              a.get("ControlType"), a.get("ControlSubType") or ""))
    if not answers:
        print("  (no answers - send {} )")
PY
}

# and one to remember the node + algorithm for the next call
remember() {
  NODE=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("NodeID"))' "$1")
  ALGO=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("AlgoID"))' "$1")
  echo "next call will use NODE=$NODE ALGO=$ALGO"
}
```

You can always see the **full raw JSON** of any response with
`python3 -m json.tool <file>.json`.

---

## 4. FIRST: get question 1

```bash
curl -sS -X POST "$B/First/$TID/$MID/$ALGO/0?Language=$LANG_E24" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{}' \
  -o q.json

show q.json
remember q.json
```

The real URL was:

```
POST https://aph-uat.expert-24.net/webbuilder/TraversalService/First/cd6ed911-5ba5-40ac-a72d-ad3650516b50/1492375/10657/0?Language=MEMBER
{}
```

You'll see:

```
NODE=487  ALGO=10657  (Healthy Aging Member Satisfaction Survey)
Please tell us about your experiences with the Smart Step Aging in Place service ...
  (no answers - send {} )
next call will use NODE=487 ALGO=10657
```

❌ **If it says FINISHED straight away** (empty `AlgoName`), the algorithm ID is
wrong for UAT or the member can't take it.

---

## 5. NEXT: answer and get the next question (repeat)

Every NEXT call is the **same command**. Only the answer in `-d` changes:

```bash
curl -sS -X POST "$B/Next/$TID/$MID/$ALGO/$NODE" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d 'ANSWER_GOES_HERE' \
  -o q.json

show q.json
remember q.json
```

### What to put in `-d`

This is the script's `build_answer_body`: keys are the answer numbers in
`[ ]`, and a chosen option gets `""`.

| Question shows | Put in `-d` |
|---|---|
| `(no answers)` (intro or thank-you) | `'{}'` |
| Pick one: you want `[1] Yes` | `'{"1":""}'` |
| Pick many: you want `[1]` and `[3]` | `'{"1":"","3":""}'` |
| Type something: `[1] (text …)` | `'{"1":"your words here"}'` |
| A number, e.g. weight | `'{"1":"180"}'` |

`remember` updates `$NODE` and `$ALGO` after each call, so the URL is always
right. Expert24 can switch `ALGO` partway through, and the script handles that
the same way.

### The real run, copy-paste ready

These are the exact 10 NEXT calls from the UAT run, in order:

```bash
# helper so each line below is short
next() {
  curl -sS -X POST "$B/Next/$TID/$MID/$ALGO/$NODE" \
    -H 'Content-Type: application/json' -H 'Accept: application/json' \
    -d "$1" -o q.json
  show q.json; remember q.json; echo
}

next '{}'                 #  1  node 487  intro screen, no answers
next '{"1":""}'           #  2  node 908  Were you able to review resources?  -> [1] Yes
next '{"1":""}'           #  3  node 863  How helpful were the resources?     -> [1] Extremely Helpful
next '{"1":"dscvds"}'     #  4  node 903  What did you like most?             -> typed "dscvds"
next '{"1":"gfgd"}'       #  5  node 955  What changes would you like?        -> typed "gfgd"
next '{"1":""}'           #  6  node 966  Would you recommend us?             -> [1] Yes
next '{"1":""}'           #  7  node 889  Risk Level 3 recommendation?        -> [1] Yes
next '{"1":""}'           #  8  node 894  Were staff helpful?                 -> [1] Yes
next '{"1":""}'           #  9  node 881  Overall experience?                 -> [1] Extremely Helpful
next '{}'                 # 10  node 876  thank-you screen, no answers
```

Run them **one at a time** and read each question before answering. If the
question isn't what the comment says, choose your own answer from the `[ ]`
list.

The full URL for call #2, for example, was:

```
POST https://aph-uat.expert-24.net/webbuilder/TraversalService/Next/cd6ed911-5ba5-40ac-a72d-ad3650516b50/1492375/10657/908
{"1":""}
```

Each call answers the node **in the URL**, and the response is the **next**
question.

### How you know it's finished

After call #10, `show` prints:

```
=== FINISHED - no more questions. Now run QA (step 6). ===
  [Default] 2026.03.13.1
```

`2026.03.13.1` is the assessment's **content version**. To see the full final
response:

```bash
python3 -m json.tool q.json
```

---

## 6. QA: read back every answer

```bash
curl -sS "$B/QA/$TID" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -o qa.json

python3 -m json.tool qa.json
```

The real URL was:

```
GET https://aph-uat.expert-24.net/webbuilder/TraversalService/QA/cd6ed911-5ba5-40ac-a72d-ad3650516b50
```

For a short, readable list (the same format the script prints):

```bash
python3 - <<'PY'
import json, re
clean = lambda t: " ".join(re.sub(r"<[^>]+>", " ", str(t or "")).split())
rows = json.load(open("qa.json")).get("Table") or []
print(len(rows), "recorded answer(s):\n")
for r in rows:
    shown = (clean(r.get("SValue")) + " " + clean(r.get("Answer"))).strip()
    print("  Q:", clean(r.get("Question")))
    print("  A:", shown or "(blank)", "\n")
PY
```

The real run gave 10 answers:

```
  Q: Please tell us about your experiences with the Smart Step Aging in Place service ...
  A: Next >

  Q: Were you able to review any of the program resources ...?
  A: Yes
  ...
  Q: Please tell us what you liked most about the program ...
  A: dscvds
  ...
  Q: Thank you for answering our questions ...
  A: Next >
```

---

## 7. Optional calls

**PREVIOUS: go back one question** (the script's `previous_question`):

```bash
curl -sS "$B/Previous/$TID" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -o q.json
show q.json; remember q.json
```

Then carry on with `next`.

**INFO: help text** (only when a question has `hasInfo: true`; `32` = a
question, `64` = an answer):

```bash
curl -sS "$B/Info/$TID/32/$NODE" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  | python3 -m json.tool
```

**RESUME an old run later.** Set `TID` and `MID` to the saved values, then:

```bash
TID=cd6ed911-5ba5-40ac-a72d-ad3650516b50
MID=1492375

curl -sS -X POST "$B/Prepop/$TID/$MID" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"@UserID":"'"$MEMBER"'","callback":"raw"}' | python3 -m json.tool

curl -sS "$B/GoBack/$TID/$MID/0/-1" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -o q.json
show q.json; remember q.json
```

Then carry on with `next`.

---

## 8. Seeing more detail (debugging)

| Want to see | Add to curl |
|---|---|
| The HTTP status code | `-w '\nHTTP %{http_code}\n'` |
| Everything sent and received (headers, TLS) | `-v` |
| The raw body on screen instead of a file | drop `-o file.json` |

Example:

```bash
curl -sS -X POST "$B/Member" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"@UserID":"'"$MEMBER"'","callback":"raw"}' \
  -w '\nHTTP %{http_code}\n'
```

---

## 9. When something goes wrong

The meanings below come from the script's own error messages:

| You see | Meaning |
|---|---|
| `HTTP 401` | Expert24 wants credentials that aren't being sent. |
| `HTTP 403` | Expert24 refused this member or environment. |
| `HTTP 404` | Wrong path or base URL. Check `$B` and the spelling. |
| `HTTP 500` | Expert24 error. The traversal or prepop may be invalid. |
| `curl: (6) Could not resolve host` | This machine can't find Expert24. Use the machine where the script worked. |
| `curl: (7) Failed to connect` / timeout | Network or firewall block. Same fix as above. |
| `curl: (60) SSL certificate problem` | Corporate TLS inspection. Ask IT for the CA bundle and pass it with `--cacert file.pem`. Avoid `-k`. |
| HTML instead of JSON | The URL points at a web page, not the API. Check `$B`. |
| `json.decoder.JSONDecodeError` in `show` | The response wasn't JSON. Run `cat q.json` to see what came back. |
| `Table` empty on Start | Member unknown in UAT, or a required prepop value is missing. |
| `EXPERT24 ERROR: …` | Expert24 rejected that step. Read the message. |
| NEXT gives an odd question | `$NODE` is stale. Run `remember q.json` after every call. |
| Variables empty (`/First///10657/0`) | New terminal, so the variables are gone. Redo step 1 and the `TID`/`MID` lines. |

---

## 10. Script ↔ curl cheat sheet

| Script command | curl step |
|---|---|
| `start --member-id ABC_TMJarrett` | Step 2: `POST $B/Member` |
| `question --traversal-id T --e24-member-id M --algorithm-id 10657` | Step 4: `POST $B/First/T/M/10657/0?Language=MEMBER` |
| `question ... --node-id 908 --answer 1` | Step 5: `POST $B/Next/T/M/10657/908` with `-d '{"1":""}'` |
| `question ... --node-id 903 --answer 1=dscvds` | Step 5: `POST $B/Next/T/M/10657/903` with `-d '{"1":"dscvds"}'` |
| `qa --traversal-id T` | Step 6: `GET $B/QA/T` |
| `--raw` | `python3 -m json.tool file.json` |
| `-v` | `curl -v` |
