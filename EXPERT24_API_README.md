# Talking to Expert24 directly

This guide is for anyone who only wants to run assessments against
**`https://aph-uat.expert-24.net`**, without the Angular apps in this repo.

---

## 1. The short story

- **Expert24 is the real backend.** It keeps the questions, decides which
  question comes next, and stores the answers and results.
- **This repo is only a screen** that shows those questions:
  - `assessment-ctrl` is the quiz screen that member-facing apps (Portal, Axis)
    install.
  - `assessment-ctrl-tester` is a practice page for that screen.
- **You don't need either of them** to talk to Expert24. Anything that can send
  a web request can do it: curl, Postman, Python, a backend service.

```
 You (curl / Postman / Python / your service)
          │
          │  plain HTTPS, JSON in and JSON out
          ▼
 https://aph-uat.expert-24.net/webbuilder/TraversalService/...
```

### Why the repo runs `ng serve` then?

Only because the quiz screen runs **inside a web browser**, and browsers block
a page on `localhost:4200` from calling a different website such as Expert24.
That block is called **CORS**. `ng serve` has a small forwarder
(`proxy.config.json`) that passes the call on for the browser.

**CORS only exists in browsers.** curl, Python and servers are never blocked by
it, so for them `ng serve` is not needed.

### What about the "E24 Proxy" in the Word documents?

`Assessment Control Integration-v3.docx` and
`Assessment Expert24 Proxy Integration-v1.docx` describe a **helper in the
middle** (`/api/E24Proxy/...`) that passes calls to Expert24 for you. It lives
in another repo (the Clinical Content Service), **not this one**.

- It adds **no password or login**. Its main jobs are getting websites past CORS
  and giving one central place to log calls and choose the Expert24 environment.
- If you call Expert24 directly, you don't need it.
- ⚠️ **For production, check with the team first.** This is member health
  data. UAT being open doesn't mean production is, and there may be a rule that
  all traffic must go through the helper. That's a policy question, not a
  technical one.
- ⚠️ The **request bodies shown in those documents are wrong** for Expert24
  itself (they show `{"memberId": ..., "prepop": [...]}`). Use the bodies in
  this guide. They come from the working code and were tested end to end
  against UAT.

---

## 2. The whole trip in one picture

```
 1. START   POST /Member                 → you get traversalId + e24MemberId
 2. FIRST   POST /First/...              → question 1 (and its NodeID)
 3. NEXT    POST /Next/.../{NodeID}      → send the answer, get the next question
            ...repeat NEXT until there are no more questions...
 4. QA      GET  /QA/{traversalId}       → every question + answer, as a list
```

Optional extras:

- **PREVIOUS** goes back one question.
- **INFO** fetches the help text behind a little "i" icon.
- **PREPOP + GOBACK** resume an unfinished assessment later.

**The two IDs to keep:** Start gives you a `traversalId` (this one run of the
quiz) and an `e24MemberId` (Expert24's own number for the person). Almost every
later call needs them. **Save them** if you ever want to resume.

---

## 3. Common details

| Thing | Value |
|---|---|
| Base URL (UAT) | `https://aph-uat.expert-24.net` |
| Path prefix | `/webbuilder/TraversalService` |
| Header | `Content-Type: application/json` |
| Login / token | None. The working code sends no credentials. |
| Every response | JSON |

Other Expert24 environments (authoring, QA, production) each have **their own
base URL**. Only the base URL changes; the paths stay the same.

In the examples below:

```bash
B=https://aph-uat.expert-24.net/webbuilder/TraversalService
```

---

## 4. Each call

### 4.1 START: begin a new assessment

Creates a new run of an assessment for one member.

```
POST {B}/Member
```

**Request body**

```json
{
  "@UserID": "ABC_TMJarrett",
  "callback": "raw",
  "Prepop": {
    "DOB": "2010-01-06",
    "Gender": "Male",
    "FirstName": "Jarrett",
    "FallPrevRiskLevel": "No",
    "source_application": "AgentPortal"
  }
}
```

| Field | Meaning |
|---|---|
| `@UserID` | Your member ID. The `@` really is part of the name. |
| `callback` | Always `"raw"`. |
| `Prepop` | Optional. Facts you already know about the member. Expert24 uses them to skip or steer questions. Each assessment expects different keys; ask the clinical content team. |

**curl**

```bash
curl -X POST "$B/Member" -H 'Content-Type: application/json' \
  -d '{"@UserID":"ABC_TMJarrett","callback":"raw","Prepop":{}}'
```

**Response (the parts that matter)**

```json
{
  "ReturnValue": "...",
  "Table": [
    {
      "TraversalID": "cd6ed911-5ba5-40ac-a72d-ad3650516b50",
      "MemberID": "1492375",
      "MMSIID": "...",
      "FirstName": "...",
      "Surname": "...",
      "DOB": "...",
      "Gender": "...",
      "Language": "...",
      "UserType": "...",
      "DaysAlive": "..."
    }
  ],
  "DOB": "...", "Gender": "...", "Self": "...",
  "XmlTime": "...", "NLTime": "...", "TotalTime": "...", "JsonTime": 0
}
```

👉 Keep `Table[0].TraversalID` (**traversalId**) and `Table[0].MemberID`
(**e24MemberId**).

If `Table` comes back empty, Expert24 usually doesn't know that member in this
environment, or a required prepop value is missing.

---

### 4.2 FIRST: get question 1

```
POST {B}/First/{traversalId}/{e24MemberId}/{algorithmId}/0?Language={MEMBER|SPANISH}
```

| Part | Meaning |
|---|---|
| `algorithmId` | Which assessment to run, e.g. `10657` = Healthy Aging Member Satisfaction Survey, `9045` = Care Manager Initial Assessment. |
| `0` | Always `0` for the first question. |
| `Language` | `MEMBER` = English, `SPANISH` = Spanish. |

**Request body:** `{}`

**curl**

```bash
curl -X POST "$B/First/cd6ed911-5ba5-40ac-a72d-ad3650516b50/1492375/10657/0?Language=MEMBER" \
  -H 'Content-Type: application/json' -d '{}'
```

**Response: a "question" response.** FIRST, NEXT, PREVIOUS and GOBACK all
return this same shape:

```json
{
  "AlgoID": 10657,
  "AlgoName": "Healthy Aging Member Satisfaction Survey",
  "NodeID": 908,
  "Questions": [
    {
      "QuestionID": 908,
      "Title": "",
      "DisplayText": "Were you able to review any of the program resources ...?",
      "hasInfo": false,
      "Properties": { "...": "..." },
      "Answers": [
        {
          "Index": "1",
          "AnswerID": 12345,
          "ControlType": "radio",
          "ControlSubType": "",
          "DisplayText": "Yes",
          "ControlValue": "",
          "isChecked": false,
          "hasInfo": false
        },
        {
          "Index": "2",
          "AnswerID": 12346,
          "ControlType": "radio",
          "ControlSubType": "",
          "DisplayText": "No",
          "ControlValue": "",
          "isChecked": false,
          "hasInfo": false
        }
      ]
    }
  ],
  "Conclusions": [],
  "Report": null,
  "Error": "",
  "Language": "MEMBER",
  "suppressBack": false,
  "suppressNext": false,
  "Age": 0, "Gender": "", "DaysAlive": 0, "Counter": 0,
  "Assessment": 0, "HRAReport": false, "Self": false, "UserType": 0
}
```

(The IDs above are examples. Your values will differ.)

What to read from it:

| Field | Why you care |
|---|---|
| `NodeID` | **Send it back** in the next NEXT call. It means "I'm answering this question". |
| `AlgoID` | **Also send it back.** Expert24 can switch to a different assessment partway through, so always use the latest one, not the one you started with. |
| `AlgoName` | Name of the assessment. **If it's empty, the assessment is finished.** |
| `Questions[0].DisplayText` | The question text. It may contain HTML such as `<b>`. |
| `Questions[0].Answers[]` | The choices. |
| `Answers[].Index` | **The key you use when answering.** |
| `Answers[].ControlType` | `radio` = pick one, `checkbox` = pick many, `text` = type something. |
| `Answers[].ControlSubType` | For `text`: `number`, or a unit such as `Feet`, `Inches`, `Pounds`. |
| `Error` | If it's not empty, something went wrong. |

Some "questions" have **no answers** at all, such as an intro or thank-you
screen. Just send `{}` to move on.

---

### 4.3 NEXT: send an answer, get the next question

```
POST {B}/Next/{traversalId}/{e24MemberId}/{AlgoID}/{NodeID}
```

`AlgoID` and `NodeID` come from **the response you're answering**.

**Request body:** a map of **answer `Index` → value**

| Question kind | Body |
|---|---|
| Pick one (radio): chose "Yes" (Index 1) | `{"1": ""}` |
| Pick many (checkbox): chose 1 and 3 | `{"1": "", "3": ""}` |
| Type text: Index 1 | `{"1": "my typed answer"}` |
| Number, e.g. weight: Index 1 | `{"1": "180"}` |
| Height: feet (Index 1) + inches (Index 2) | `{"1": "5", "2": "7"}` |
| No answers on the screen | `{}` |

In other words, a chosen option gets an empty string (`""`), and a typed value
goes in as text.

**curl**

```bash
curl -X POST "$B/Next/cd6ed911-5ba5-40ac-a72d-ad3650516b50/1492375/10657/908" \
  -H 'Content-Type: application/json' -d '{"1":""}'
```

**Response:** the same question shape as FIRST, holding the next question.

**How do I know it's finished?** The last NEXT returns:

- `AlgoName` empty (and usually `Questions` empty), and/or
- a `Report` object present,
- plus the results in `Conclusions`.

```json
{
  "AlgoID": 10657,
  "AlgoName": "",
  "NodeID": 876,
  "Questions": [],
  "Report": { "InformationConclusions": [ ... ] },
  "Conclusions": [
    {
      "ConclusionID": 1,
      "Category": "Default",
      "DisplayText": "2026.03.13.1",
      "Title": "",
      "Explanation": "",
      "ExpertText": "",
      "More_Detail": "",
      "Truncated": "",
      "isReason": false,
      "Bullets": [],
      "Properties": {
        "CategoryProperties": [ { "Name": "Version", "Categories": [] } ]
      }
    }
  ],
  "Error": ""
}
```

**Reading `Conclusions`**, which is how the quiz screen sorts them:

| `Category` | Meaning |
|---|---|
| `Alert` | Something to flag, e.g. a risk. |
| `Goal` | A care-plan item. |
| `Default` | Everything else. Some carry special info, identified by `Properties.CategoryProperties[0].Name`: |
| ↳ `Name = "Version"` | `DisplayText` = content version (e.g. `2026.03.13.1`) |
| ↳ `Name = "HRA Status"` | `DisplayText` = HRA status |
| ↳ `Name = "Track posting Care Plan"` | `DisplayText` = care-plan group name; `Categories[0].Name` = group ID |

`Report.InformationConclusions` holds extra report text in the same
conclusion shape.

---

### 4.4 QA: get every question and answer

Call this after the assessment finishes.

```
GET {B}/QA/{traversalId}
```

**curl**

```bash
curl "$B/QA/cd6ed911-5ba5-40ac-a72d-ad3650516b50"
```

**Response:** one row per answered question

```json
{
  "Table": [
    {
      "NodeID": "908",
      "QuestionID": "908",
      "Question": "Were you able to review any of the program resources ...?",
      "AnsID": "12345",
      "Answer": "Yes",
      "SValue": ""
    },
    {
      "NodeID": "903",
      "QuestionID": "903",
      "Question": "Please tell us what you liked most about the program ...",
      "AnsID": "12400",
      "Answer": "",
      "SValue": "dscvds"
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `Question` | The question text. |
| `Answer` | The chosen option's text. For intro screens this is `Next >`. |
| `SValue` | What the person **typed** (free text or numbers). Empty for pick-one or pick-many answers. |
| `AnsID` / `QuestionID` / `NodeID` | Expert24's IDs, useful for storing or matching. |

---

### 4.5 PREVIOUS: go back one question (optional)

```
GET {B}/Previous/{traversalId}
```

No body. The response is the **question shape** (see 4.2), holding the earlier
question. Keep using the `NodeID` and `AlgoID` from this new response.

```bash
curl "$B/Previous/cd6ed911-5ba5-40ac-a72d-ad3650516b50"
```

---

### 4.6 INFO: help text behind an "i" icon (optional)

Only useful when a question or answer has `hasInfo: true`.

```
GET {B}/Info/{traversalId}/{noteType}/{itemId}
```

| Part | For a question | For an answer |
|---|---|---|
| `noteType` | `32` | `64` |
| `itemId` | `Questions[0].QuestionID` | `Answers[].AnswerID` |

```bash
curl "$B/Info/cd6ed911-5ba5-40ac-a72d-ad3650516b50/32/908"
```

**Response**

```json
{
  "Table": [ { "Explanation": "A <b>helpful</b> note about this question." } ],
  "ReturnValue": "...", "DOB": "...", "Gender": "...", "Self": "...",
  "UserType": "...", "XmlTime": "...", "NLTime": "...", "TotalTime": "...", "JsonTime": 0
}
```

👉 The help text is `Table[0].Explanation` (it may contain HTML).

---

### 4.7 Resume an unfinished assessment (optional, two calls)

You need the **traversalId** and **e24MemberId** you saved from START.

**Step A. PREPOP: re-send the facts**

```
POST {B}/Prepop/{traversalId}/{e24MemberId}
```

Body: the same shape as START.

```json
{ "@UserID": "ABC_TMJarrett", "callback": "raw", "Prepop": { "...": "..." } }
```

**Step B. GOBACK: get the question they stopped on**

```
GET {B}/GoBack/{traversalId}/{e24MemberId}/0/-1
```

`0/-1` is fixed; always send exactly that.

The response is the **question shape** (4.2). From here, carry on with NEXT as
normal.

```bash
curl -X POST "$B/Prepop/cd6ed911-5ba5-40ac-a72d-ad3650516b50/1492375" \
  -H 'Content-Type: application/json' \
  -d '{"@UserID":"ABC_TMJarrett","callback":"raw","Prepop":{}}'

curl "$B/GoBack/cd6ed911-5ba5-40ac-a72d-ad3650516b50/1492375/0/-1"
```

---

## 5. All calls at a glance

| # | Call | Method + path (after `/webbuilder/TraversalService`) | Body | Returns |
|---|---|---|---|---|
| 1 | Start | `POST /Member` | `{"@UserID", "callback":"raw", "Prepop"}` | `Table[0].TraversalID`, `Table[0].MemberID` |
| 2 | First | `POST /First/{tid}/{mid}/{algo}/0?Language=MEMBER` | `{}` | question shape |
| 3 | Next | `POST /Next/{tid}/{mid}/{AlgoID}/{NodeID}` | `{"<Index>": "<value or empty>"}` | question shape, or the finished shape with `Conclusions` |
| 4 | QA | `GET /QA/{tid}` | none | `Table[]` of question/answer rows |
| 5 | Previous | `GET /Previous/{tid}` | none | question shape |
| 6 | Info | `GET /Info/{tid}/{32 or 64}/{itemId}` | none | `Table[0].Explanation` |
| 7 | Prepop | `POST /Prepop/{tid}/{mid}` | same as Start | start-like response |
| 8 | GoBack | `GET /GoBack/{tid}/{mid}/0/-1` | none | question shape |

`tid` = traversalId, `mid` = e24MemberId, `algo` = algorithmId.

---

## 6. The easy way: the Python script

(Prefer clicking to typing? See [`POSTMAN_README.md`](POSTMAN_README.md) for the
same calls step by step in Postman.)

`scripts/e24_direct_client.py` does all of the above for you. It uses only
standard Python (3.8+), so there's **nothing to install** and no virtual
environment is needed.

```bash
# the whole thing, interactively: start → questions → QA
python3 scripts/e24_direct_client.py run \
  --base-url https://aph-uat.expert-24.net \
  --member-id ABC_TMJarrett --algorithm-id 10657

# same, but auto-pick the first option each time, and save everything to a file
python3 scripts/e24_direct_client.py run \
  --base-url https://aph-uat.expert-24.net \
  --member-id ABC_TMJarrett --algorithm-id 10657 --auto --save result.json

# one step at a time
python3 scripts/e24_direct_client.py start    --base-url https://aph-uat.expert-24.net --member-id ABC_TMJarrett
python3 scripts/e24_direct_client.py question --base-url https://aph-uat.expert-24.net \
  --traversal-id <tid> --e24-member-id <mid> --algorithm-id 10657             # first question
python3 scripts/e24_direct_client.py question --base-url https://aph-uat.expert-24.net \
  --traversal-id <tid> --e24-member-id <mid> --algorithm-id 10657 \
  --node-id 908 --answer 1                                                     # next question
python3 scripts/e24_direct_client.py qa       --base-url https://aph-uat.expert-24.net --traversal-id <tid>
```

Add `--raw` to any command to print the full JSON Expert24 sent back.

---

## 7. Common problems

| You see | It usually means |
|---|---|
| `Table` empty on START | Member unknown in this environment, or a required prepop value is missing. |
| `AlgoName` empty on FIRST | Wrong `algorithmId` for this environment, or this member can't take it. |
| `Error` has text | Expert24 rejected the call. Read the message. |
| HTTP 404 | Wrong path or wrong base URL. |
| HTTP 500 | Expert24 failed, often a bad traversalId or bad prepop. |
| "blocked by CORS policy" | You're calling from a **browser page**. Call from curl, Python or a server instead. |

---

## 8. What was actually tested

On UAT, **Start → First → Next (×10) → QA** ran end to end with
`e24_direct_client.py` for member `ABC_TMJarrett`, assessment `10657`, with no
login and no `ng serve`.

**Previous, Info, Prepop and GoBack** are documented from the code
(`projects/assessment-ctrl/src/lib/e24-http.service.ts`), which is what the
shipped quiz screen uses. They weren't part of that test run.

The full response field lists come from
`projects/assessment-ctrl/src/lib/e24.dtos.ts`. Expert24 may send extra fields;
you can safely ignore any you don't need.
