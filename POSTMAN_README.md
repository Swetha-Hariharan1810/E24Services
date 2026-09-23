# Testing Expert24 with Postman

A step-by-step guide to running an Expert24 assessment by hand in Postman.

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

- Use the **Postman desktop app**. It isn't a web page, so browser **CORS**
  rules don't apply and it can call Expert24 directly.
  - If you use Postman in a web browser instead, install **Postman Agent** and
    select it (bottom-right corner) or the calls can fail.
- There's no login or token. The script sends none.
- You **don't** need `ng serve`, Node, Angular or Python for this.

---

## 1. Create the collection and variables

1. **New → Collection** and name it `Expert24 UAT`.
2. Click the collection, open the **Variables** tab, and add:

   | Variable | Initial value | Notes |
   |---|---|---|
   | `base` | `https://aph-uat.expert-24.net/webbuilder/TraversalService` | Expert24 UAT, the same URL the script builds |
   | `memberId` | `ABC_TMJarrett` | the script's `--member-id` |
   | `algoId` | `10657` | the script's `--algorithm-id` |
   | `language` | `MEMBER` | `MEMBER` = English, `SPANISH` = Spanish |
   | `tid` | *(empty)* | filled by Start |
   | `mid` | *(empty)* | filled by Start |
   | `nodeId` | *(empty)* | filled by First / Next |

3. **Save** (Ctrl+S).

### Headers: the same two on every request

The script adds these two headers to **every** call, GET and POST alike:

| Key | Value |
|---|---|
| `Content-Type` | `application/json` |
| `Accept` | `application/json` |

Add them on each request's **Headers** tab. You can also set them once on the
collection: **Collection → Scripts → Pre-request**, and paste:

```js
pm.request.headers.upsert({ key: "Content-Type", value: "application/json" });
pm.request.headers.upsert({ key: "Accept",       value: "application/json" });
```

For every POST below, set **Body → raw → JSON**.

---

## 2. Request "1 Start": open a new assessment run

| Setting | Value |
|---|---|
| Method | `POST` |
| URL | `{{base}}/Member` |
| Full URL | `https://aph-uat.expert-24.net/webbuilder/TraversalService/Member` |

**Body** (raw → JSON). This is exactly what the script sent, since the run had
no prepop:

```json
{
  "@UserID": "{{memberId}}",
  "callback": "raw"
}
```

With prepop facts (the script's `--prepop`), add a `Prepop` object:

```json
{
  "@UserID": "{{memberId}}",
  "callback": "raw",
  "Prepop": {
    "DOB": "2010-01-06",
    "FallPrevRiskLevel": "No",
    "Gender": "Male",
    "FirstName": "Jarrett",
    "source_application": "AgentPortal"
  }
}
```

**Scripts → Post-response** (called the **Tests** tab in older Postman). This
copies the two IDs into the variables:

```js
const r = pm.response.json();
pm.test("Start returned a traversal", () => pm.expect(r.Table).to.be.an("array").that.is.not.empty);
pm.collectionVariables.set("tid", r.Table[0].TraversalID);
pm.collectionVariables.set("mid", r.Table[0].MemberID);
console.log("traversal id", r.Table[0].TraversalID, "e24 member id", r.Table[0].MemberID);
```

Click **Send**. The response contains:

```json
{
  "Table": [
    {
      "TraversalID": "cd6ed911-5ba5-40ac-a72d-ad3650516b50",
      "MemberID": "1492375",
      "...": "..."
    }
  ],
  "...": "..."
}
```

✅ `tid` = `cd6ed911-5ba5-40ac-a72d-ad3650516b50`, `mid` = `1492375` (yours
will differ).

❌ If `Table` is empty, the member is unknown in UAT or a required prepop value
is missing.

---

## 3. Request "2 First": get question 1

| Setting | Value |
|---|---|
| Method | `POST` |
| URL | `{{base}}/First/{{tid}}/{{mid}}/{{algoId}}/0?Language={{language}}` |
| Real run | `https://aph-uat.expert-24.net/webbuilder/TraversalService/First/cd6ed911-5ba5-40ac-a72d-ad3650516b50/1492375/10657/0?Language=MEMBER` |

**Body:** the script sends an empty object:

```json
{}
```

**Post-response script.** This saves the node and algorithm for the next step:

```js
const r = pm.response.json();
pm.test("No Expert24 error", () => pm.expect(r.Error || "").to.eql(""));
pm.test("Assessment found", () => pm.expect(r.AlgoName).to.be.ok);
pm.collectionVariables.set("nodeId", r.NodeID);
pm.collectionVariables.set("algoId", r.AlgoID);
const q = (r.Questions || [])[0] || {};
console.log("NODE", r.NodeID, "ALGO", r.AlgoID, "-", q.DisplayText);
(q.Answers || []).forEach(a => console.log("  [" + a.Index + "]", a.DisplayText, a.ControlType, a.ControlSubType || ""));
```

Click **Send**. You'll get:

- `AlgoName`: `"Healthy Aging Member Satisfaction Survey"`
- `NodeID`: `487`
- `Questions[0].DisplayText`: *"Please tell us about your experiences with the
  Smart Step Aging in Place service…"*
- `Questions[0].Answers`: **empty**. This is an intro screen.

❌ If `AlgoName` is empty here, the algorithm ID is wrong for UAT or this
member can't take it.

> Tip: open **View → Show Postman Console** (Ctrl+Alt+C). The script above
> prints each question and its answer `Index` values there, so you can see
> what to send next.

---

## 4. Request "3 Next": answer and get the next question (repeat)

| Setting | Value |
|---|---|
| Method | `POST` |
| URL | `{{base}}/Next/{{tid}}/{{mid}}/{{algoId}}/{{nodeId}}` |

**Post-response script:** the same as First, plus a "finished" check:

```js
const r = pm.response.json();
pm.test("No Expert24 error", () => pm.expect(r.Error || "").to.eql(""));
pm.collectionVariables.set("nodeId", r.NodeID);
pm.collectionVariables.set("algoId", r.AlgoID);
if (r.Report || !r.AlgoName) {
  console.log("=== FINISHED - now send '4 QA' ===");
  (r.Conclusions || []).forEach(c => console.log("  [" + c.Category + "]", c.DisplayText));
} else {
  const q = (r.Questions || [])[0] || {};
  console.log("NODE", r.NodeID, "ALGO", r.AlgoID, "-", q.DisplayText);
  (q.Answers || []).forEach(a => console.log("  [" + a.Index + "]", a.DisplayText, a.ControlType, a.ControlSubType || ""));
}
```

### How to write the body

This is the script's `build_answer_body`: keys are answer **`Index`** values,
and a chosen option gets `""`.

| Question type (the script's `type=`) | Body |
|---|---|
| `none`: no answers (intro or thank-you) | `{}` |
| `single`: radio, picked option 1 | `{"1": ""}` |
| `multi`: checkboxes, picked 1 and 3 | `{"1": "", "3": ""}` |
| `value`: typed text or number | `{"1": "what you typed"}` |

### The real run, one Send at a time

Change **only the Body** before each Send. The URL updates itself through
`{{nodeId}}`.

| # | URL ends with `/10657/…` | Question on screen | You chose | Body to send |
|---|---|---|---|---|
| 1 | `487` | Please tell us about your experiences… *(intro, no answers)* | — | `{}` |
| 2 | `908` | Were you able to review any of the program resources…? `[1] Yes [2] No` | Yes | `{"1": ""}` |
| 3 | `863` | How helpful were the resources…? `[1] Extremely Helpful …` | Extremely Helpful | `{"1": ""}` |
| 4 | `903` | Please tell us what you liked most… `[1] (text)` | typed | `{"1": "dscvds"}` |
| 5 | `955` | What changes or additions would you like…? `[1] (text)` | typed | `{"1": "gfgd"}` |
| 6 | `966` | Would you recommend our program…? `[1] Yes [2] No` | Yes | `{"1": ""}` |
| 7 | `889` | Action is looking for collection of Risk Level of 3… `[1] Yes [2] No` | Yes | `{"1": ""}` |
| 8 | `894` | Were program staff helpful and knowledgeable…? `[1] Yes [2] No` | Yes | `{"1": ""}` |
| 9 | `881` | How would you rate your experience overall? `[1] Extremely Helpful …` | Extremely Helpful | `{"1": ""}` |
| 10 | `876` | Thank you for answering our questions… *(no answers)* | — | `{}` |

The full URL for Send #2, for example, is:

```
https://aph-uat.expert-24.net/webbuilder/TraversalService/Next/cd6ed911-5ba5-40ac-a72d-ad3650516b50/1492375/10657/908
```

Each Send answers the question at the node **in the URL**, and the response is
the **next** question. That's why #1 goes to node `487` (the intro screen from
First).

### How you know it's finished

After Send #10 the response has:

- `AlgoName` **empty** (and/or a `Report` object present)
- `Conclusions`, which in this run was one entry:

```json
"Conclusions": [
  {
    "Category": "Default",
    "DisplayText": "2026.03.13.1",
    "Properties": { "CategoryProperties": [ { "Name": "Version" } ] }
  }
]
```

`2026.03.13.1` is the **content version** of the assessment.

> Always keep using `{{algoId}}` from the latest response, as the script does
> (`algo_id = response.get("AlgoID", ...)`). Expert24 can move to a different
> algorithm partway through.

---

## 5. Request "4 QA": read back every answer

| Setting | Value |
|---|---|
| Method | `GET` |
| URL | `{{base}}/QA/{{tid}}` |
| Real run | `https://aph-uat.expert-24.net/webbuilder/TraversalService/QA/cd6ed911-5ba5-40ac-a72d-ad3650516b50` |
| Body | none |

**Post-response script** (optional, prints a readable list):

```js
const rows = pm.response.json().Table || [];
console.log(rows.length + " recorded answer(s)");
rows.forEach(r => console.log("Q:", r.Question, "\nA:", (r.SValue ? r.SValue + " " : "") + (r.Answer || "")));
```

The real run returned **10 rows**, shaped like this:

```json
{
  "Table": [
    { "Question": "Please tell us about your experiences with the Smart Step Aging in Place service ...", "Answer": "Next >", "SValue": "" },
    { "Question": "Were you able to review any of the program resources ...?", "Answer": "Yes", "SValue": "" },
    { "Question": "How helpful were the resources, articles, or websites ...?", "Answer": "Extremely Helpful", "SValue": "" },
    { "Question": "Please tell us what you liked most about the program ...", "Answer": "", "SValue": "dscvds" },
    { "Question": "We value your feedback! What changes or additions ...?", "Answer": "", "SValue": "gfgd" },
    { "Question": "... would you recommend our program to people you know?", "Answer": "Yes", "SValue": "" },
    { "Question": "Action is looking for collection of Risk Level of 3 ...", "Answer": "Yes", "SValue": "" },
    { "Question": "Were program staff helpful and knowledgeable ...?", "Answer": "Yes", "SValue": "" },
    { "Question": "How would you rate your experience with the program overall?", "Answer": "Extremely Helpful", "SValue": "" },
    { "Question": "Thank you for answering our questions ...", "Answer": "Next >", "SValue": "" }
  ]
}
```

Each row also carries `NodeID`, `QuestionID` and `AnsID`. The `Answer` and
`SValue` split shown above is how the script's QA summary displays them. Check
your own response, because which field holds typed text can vary.

- `Answer` is the chosen option's text. It's `Next >` for intro and thank-you
  screens.
- `SValue` is what was **typed**.

---

## 6. Optional request "5 Previous": go back one question

The script has this call too (`previous_question`).

| Setting | Value |
|---|---|
| Method | `GET` |
| URL | `{{base}}/Previous/{{tid}}` |
| Body | none |

Use the **same post-response script as Next**, so `nodeId` moves back too.
Then carry on with **3 Next**.

---

## 7. Your Postman collection when done

```
Expert24 UAT
├── 1 Start      POST {{base}}/Member
├── 2 First      POST {{base}}/First/{{tid}}/{{mid}}/{{algoId}}/0?Language={{language}}
├── 3 Next       POST {{base}}/Next/{{tid}}/{{mid}}/{{algoId}}/{{nodeId}}   ← send many times
├── 4 QA         GET  {{base}}/QA/{{tid}}
└── 5 Previous   GET  {{base}}/Previous/{{tid}}                              (optional)
```

To **start over**, send **1 Start** again (new `tid` and `mid`), then **2
First**.

Before starting over with a **different assessment**, set `algoId` back to the
new ID (e.g. `9045`), because Next may have changed it.

---

## 8. Script ↔ Postman cheat sheet

| Script command | Postman request |
|---|---|
| `start --member-id ABC_TMJarrett` | **1 Start** |
| `question --traversal-id T --e24-member-id M --algorithm-id 10657` | **2 First** |
| `question ... --node-id 908 --answer 1` | **3 Next** with body `{"1": ""}` |
| `question ... --node-id 903 --answer 1=dscvds` | **3 Next** with body `{"1": "dscvds"}` |
| `qa --traversal-id T` | **4 QA** |
| `--raw` | Postman always shows the raw JSON |
| `-v` (verbose) | **Postman Console** (Ctrl+Alt+C) |

---

## 9. When something goes wrong

These are the script's own error explanations:

| You see | Meaning |
|---|---|
| HTTP **401** | Expert24 wants credentials that aren't being sent. |
| HTTP **403** | Expert24 refused this member or environment. |
| HTTP **404** | Wrong path or base URL. Check `{{base}}` and the spelling. |
| HTTP **500** | Expert24 error. The traversal or prepop may be invalid. |
| Response is HTML, not JSON | The URL points at a web page, not the API. Check `{{base}}`. |
| `Table` empty on Start | Member unknown in UAT, or a required prepop value is missing. |
| `AlgoName` empty on First | Wrong algorithm ID for UAT, or the member can't take it. |
| `Error` has text | Expert24 rejected that step. Read the message. |
| Next returns something odd | `{{nodeId}}` wasn't updated. Check the post-response script ran. |
