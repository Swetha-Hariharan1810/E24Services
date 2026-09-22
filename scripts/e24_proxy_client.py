#!/usr/bin/env python3
"""
Standalone client for the deployed Assessment E24 Proxy API.

Implements every endpoint described in "Assessment Expert24 Proxy Integration-v1"
(base route: api/E24Proxy) so an assessment can be started and driven from a
terminal, without the Angular Assessment Control.

Uses only the Python standard library - no pip install required. Python 3.8+.

QUICK START
-----------
Check that a deployment is reachable:

    ./e24_proxy_client.py smoke \\
        --base-url https://content-svc.example.com \\
        --e24-url  https://aph-uat.expert-24.net \\
        --member-id ABC_TMJarrett \\
        --algorithm-id 10657

Walk through a whole assessment interactively:

    ./e24_proxy_client.py run \\
        --base-url https://content-svc.example.com \\
        --e24-url  https://aph-uat.expert-24.net \\
        --member-id ABC_TMJarrett \\
        --algorithm-id 10657 \\
        --prepop-file prepop.json

Call a single endpoint (all eight are exposed as subcommands):

    ./e24_proxy_client.py qa --traversal-id 12345 --base-url ... --e24-url ...

Run `./e24_proxy_client.py --help` or `<subcommand> --help` for every option.
Settings can also come from the environment: E24_BASE_URL, E24_URL_BASE,
E24_MEMBER_ID, E24_ALGORITHM_ID, E24_LANGUAGE.

TWO URLS, DON'T MIX THEM UP
---------------------------
  --base-url   The deployed Clinical Content Service (it hosts /api/E24Proxy).
               This is what you call.
  --e24-url    The Expert24 environment the service should forward to. It is
               sent as the required ?expert24urlBase= query parameter on every
               request. Authoring, QA, UAT and production each have their own.
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Sequence

__version__ = "1.0.0"

DEFAULT_TIMEOUT = 60
API_ROOT = "/api/E24Proxy"

# Expert24 signals a missing prepop value by returning this as the question text.
PREPOP_ERROR_PREFIX = "We have encountered a problem"


# --------------------------------------------------------------------------- #
#  Errors
# --------------------------------------------------------------------------- #

class E24Error(Exception):
    """Base class for every failure this client raises."""


class E24HttpError(E24Error):
    """The server answered, but with an error status."""

    def __init__(self, status: int, url: str, body: str):
        self.status = status
        self.url = url
        self.body = body
        super().__init__(f"HTTP {status} from {url}\n{body.strip()[:2000]}")


class E24ConnectionError(E24Error):
    """The server could not be reached at all."""


class E24ResponseError(E24Error):
    """The server answered, but not with the JSON we expected."""


# --------------------------------------------------------------------------- #
#  Client
# --------------------------------------------------------------------------- #

class E24ProxyClient:
    """Thin wrapper over the eight api/E24Proxy endpoints.

    Every method returns the parsed JSON body exactly as the proxy returned it.
    The proxy preserves Expert24's upstream status code, body and content type,
    so what you get back is Expert24's own payload shape.
    """

    def __init__(
        self,
        base_url: str,
        e24_url_base: str,
        timeout: int = DEFAULT_TIMEOUT,
        verify_tls: bool = True,
        verbose: bool = False,
    ):
        if not base_url:
            raise ValueError("base_url is required (the Clinical Content Service URL)")
        if not e24_url_base:
            raise ValueError("e24_url_base is required (the Expert24 environment URL)")

        self.base_url = base_url.rstrip("/")
        self.e24_url_base = e24_url_base.strip()
        self.timeout = timeout
        self.verbose = verbose

        self._ssl_context: Optional[ssl.SSLContext] = None
        if not verify_tls:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            self._ssl_context = ctx

    # -- the eight endpoints ------------------------------------------------ #

    def start_assessment(self, member_id: str, prepop: Optional[dict] = None) -> dict:
        """POST /start - begin a brand new assessment.

        Upstream: POST {e24}/webbuilder/TraversalService/Member
        The response carries Table[0].TraversalID and Table[0].MemberID; keep
        both, they identify this run for everything that follows.
        """
        return self._request("POST", "/start", body=self._start_body(member_id, prepop))

    def begin_continue(
        self,
        traversal_id: str,
        e24_member_id: str,
        member_id: str,
        prepop: Optional[dict] = None,
    ) -> dict:
        """POST /begin-continue/{traversalId}/{e24MemberId} - re-apply prepop to
        an existing unfinished run, so it can be resumed.

        Upstream: POST {e24}/webbuilder/TraversalService/Prepop/{t}/{m}
        """
        path = f"/begin-continue/{_seg(traversal_id)}/{_seg(e24_member_id)}"
        return self._request("POST", path, body=self._start_body(member_id, prepop))

    def continue_assessment(self, traversal_id: str, e24_member_id: str) -> dict:
        """GET /continue/{traversalId}/{e24MemberId} - fetch the question the
        member left off on.

        Upstream: GET {e24}/webbuilder/TraversalService/GoBack/{t}/{m}/0/-1
        Call begin_continue() first.
        """
        path = f"/continue/{_seg(traversal_id)}/{_seg(e24_member_id)}"
        return self._request("GET", path)

    def first_question(
        self,
        traversal_id: str,
        e24_member_id: str,
        algorithm_id: str,
        language: Optional[str] = None,
    ) -> dict:
        """POST /first/{traversalId}/{e24MemberId}/{algorithmId} - the opening
        question of a new assessment.

        Upstream: POST {e24}/webbuilder/TraversalService/First/{t}/{m}/{a}/0?Language=...
        The service normalises language: spa/spanish -> SPANISH, otherwise MEMBER.
        """
        path = (
            f"/first/{_seg(traversal_id)}/{_seg(e24_member_id)}/{_seg(algorithm_id)}"
        )
        query = {"language": language} if language else None
        return self._request("POST", path, body={}, query=query)

    def next_question(
        self,
        traversal_id: str,
        e24_member_id: str,
        algorithm_id: str,
        previous_node_id: int,
        answers: Optional[Dict[str, str]] = None,
    ) -> dict:
        """POST /next/{traversalId}/{e24MemberId}/{algorithmId}/{previousNodeId}

        `answers` maps an answer's Expert24 *Index* to its value - an empty
        string for a selected radio/checkbox, or the typed text for free-text
        and numeric entries. See build_answer_body().

        Upstream: POST {e24}/webbuilder/TraversalService/Next/{t}/{m}/{a}/{node}

        Note: pass the algorithm ID from the *most recent* response, not the one
        you started with. Expert24 can move a traversal between algorithms
        part-way through an assessment.
        """
        path = (
            f"/next/{_seg(traversal_id)}/{_seg(e24_member_id)}"
            f"/{_seg(algorithm_id)}/{int(previous_node_id)}"
        )
        return self._request("POST", path, body=answers or {})

    def previous_question(self, traversal_id: str) -> dict:
        """GET /previous/{traversalId} - step back one question.

        Upstream: GET {e24}/webbuilder/TraversalService/Previous/{t}
        Expert24 remembers the position, so no node ID is needed.
        """
        return self._request("GET", f"/previous/{_seg(traversal_id)}")

    def item_info(self, traversal_id: str, note_type: int, item_id: int) -> dict:
        """GET /info/{traversalId}/{noteType}/{itemId} - the help/tooltip text.

        noteType 32 = question-level note, 64 = answer-level note.
        Upstream: GET {e24}/webbuilder/TraversalService/Info/{t}/{noteType}/{itemId}
        """
        path = f"/info/{_seg(traversal_id)}/{int(note_type)}/{int(item_id)}"
        return self._request("GET", path)

    def qa(self, traversal_id: str) -> dict:
        """GET /qa/{traversalId} - the final data for a completed assessment:
        every question and answer, plus outcomes and care-plan items.

        Upstream: GET {e24}/webbuilder/TraversalService/QA/{t}
        """
        return self._request("GET", f"/qa/{_seg(traversal_id)}")

    # -- plumbing ----------------------------------------------------------- #

    @staticmethod
    def _start_body(member_id: str, prepop: Optional[dict]) -> dict:
        """Body shape for /start and /begin-continue.

        PascalCase matches what the shipped Angular control sends, which is the
        shape the deployed service is known to accept. (The written spec shows
        camelCase; ASP.NET Core binds JSON case-insensitively by default, so
        either normally works - if your build is strict, flip these two keys.)
        """
        body: Dict[str, Any] = {"MemberId": member_id}
        if prepop:
            body["Prepop"] = prepop
        return body

    def _build_url(self, path: str, query: Optional[dict] = None) -> str:
        params = {"expert24urlBase": self.e24_url_base}
        for key, value in (query or {}).items():
            if value is not None and str(value) != "":
                params[key] = str(value)
        return f"{self.base_url}{API_ROOT}{path}?{urllib.parse.urlencode(params)}"

    def _request(
        self,
        method: str,
        path: str,
        body: Optional[dict] = None,
        query: Optional[dict] = None,
    ) -> dict:
        url = self._build_url(path, query)
        payload = json.dumps(body).encode("utf-8") if body is not None else None

        request = urllib.request.Request(url=url, data=payload, method=method)
        request.add_header("Content-Type", "application/json")
        request.add_header("Accept", "application/json")

        if self.verbose:
            print(f"--> {method} {url}", file=sys.stderr)
            if payload:
                print(f"    body: {payload.decode('utf-8')}", file=sys.stderr)

        try:
            kwargs: Dict[str, Any] = {"timeout": self.timeout}
            if self._ssl_context is not None:
                kwargs["context"] = self._ssl_context
            with urllib.request.urlopen(request, **kwargs) as response:
                raw = response.read().decode("utf-8", errors="replace")
                status = response.status
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise E24HttpError(exc.code, url, detail) from exc
        except urllib.error.URLError as exc:
            raise E24ConnectionError(
                f"Could not reach {url}\n"
                f"  reason: {exc.reason}\n"
                f"  Check that --base-url points at a running Clinical Content "
                f"Service and is reachable from this machine."
            ) from exc
        except TimeoutError as exc:
            raise E24ConnectionError(f"Timed out after {self.timeout}s calling {url}") from exc

        if self.verbose:
            print(f"<-- {status} ({len(raw)} bytes)", file=sys.stderr)

        if not raw.strip():
            return {}

        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise E24ResponseError(
                f"Expected JSON from {url} but got {len(raw)} bytes of something "
                f"else.\n  First 500 characters:\n{raw[:500]}\n"
                f"  A login page or HTML error page here usually means --base-url "
                f"is pointing at the wrong host or a path that is not the service."
            ) from exc


def _seg(value: Any) -> str:
    """URL-encode one path segment."""
    return urllib.parse.quote(str(value), safe="")


# --------------------------------------------------------------------------- #
#  Reading Expert24 responses
# --------------------------------------------------------------------------- #

def extract_ids(start_response: dict) -> Dict[str, str]:
    """Pull traversal ID and Expert24 member ID out of a /start response."""
    table = start_response.get("Table") or []
    if not table:
        raise E24ResponseError(
            "The start response had no Table entries, so no traversal was "
            "created. Usual causes: the member id does not exist in this "
            "Expert24 environment, or --e24-url points at the wrong one.\n"
            f"Response: {json.dumps(start_response)[:800]}"
        )
    row = table[0]
    return {"traversal_id": str(row.get("TraversalID", "")),
            "e24_member_id": str(row.get("MemberID", ""))}


def is_complete(response: dict) -> bool:
    """True when the assessment has finished.

    Mirrors the Angular control: a payload carrying a Report, or with no
    AlgoName, is the end-of-assessment model rather than another question.
    """
    if response.get("Report"):
        return True
    return not response.get("AlgoName")


def first_question_of(response: dict) -> dict:
    questions = response.get("Questions") or []
    return questions[0] if questions else {}


def prepop_problem(response: dict) -> Optional[str]:
    """Expert24 reports missing prepop values as a question, not an error."""
    text = str(first_question_of(response).get("DisplayText", ""))
    return text if text.startswith(PREPOP_ERROR_PREFIX) else None


def classify_question(question: dict) -> str:
    """Work out what kind of input a question needs.

    Returns 'single', 'multi', 'value' or 'text'. Follows the same reasoning as
    E24MapperService in the Angular control.
    """
    answers = question.get("Answers") or []
    types = [str(a.get("ControlType", "")).lower() for a in answers]
    subtypes = [str(a.get("ControlSubType", "")).lower() for a in answers]

    if any(t == "text" and s == "number" for t, s in zip(types, subtypes)):
        return "value"
    if "checkbox" in types:
        return "multi"
    if "radio" in types:
        return "single"
    return "text"


def build_answer_body(selections: Sequence[dict]) -> Dict[str, str]:
    """Build the body for /next.

    Each selection is an Expert24 answer dict plus an optional 'value'. The key
    is the answer's Index, the value is the typed text - or an empty string for
    a plain radio/checkbox choice. This is the exact shape the Angular control
    posts.
    """
    body: Dict[str, str] = {}
    for item in selections:
        index = str(item.get("Index", ""))
        if index:
            body[index] = str(item.get("value", "") or "")
    return body


def describe_question(response: dict) -> str:
    """One-screen rendering of a question, for terminal use."""
    question = first_question_of(response)
    lines: List[str] = []

    title = str(question.get("Title") or "").strip()
    if title:
        lines.append(title)

    text = _strip_tags(str(question.get("DisplayText") or "").strip())
    lines.append(text or "(no question text)")

    kind = classify_question(question)
    for position, answer in enumerate(question.get("Answers") or [], start=1):
        label = _strip_tags(str(answer.get("DisplayText") or "").strip())
        marker = " *" if answer.get("isChecked") else ""
        if kind == "value":
            lines.append(f"  [{position}] {label} (number){marker}")
        else:
            lines.append(f"  [{position}] {label}{marker}")

    lines.append("")
    lines.append(
        f"  node={response.get('NodeID')}  algo={response.get('AlgoID')}  type={kind}"
    )
    return "\n".join(lines)


def _strip_tags(text: str) -> str:
    out, depth = [], 0
    for char in text:
        if char == "<":
            depth += 1
        elif char == ">":
            depth = max(0, depth - 1)
        elif depth == 0:
            out.append(char)
    return " ".join("".join(out).split())


def summarise_qa(qa_response: dict) -> str:
    rows = qa_response.get("Table") or []
    if not rows:
        return "No question/answer rows were returned."

    lines = [f"{len(rows)} answered question(s):", ""]
    for row in rows:
        question = _strip_tags(str(row.get("Question") or ""))
        answer = str(row.get("Answer") or "")
        svalue = str(row.get("SValue") or "")
        if svalue:
            answer = f"{svalue} {answer}".strip()
        lines.append(f"  Q: {question}")
        lines.append(f"  A: {answer or '(no answer)'}")
        lines.append("")
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
#  Interactive runner
# --------------------------------------------------------------------------- #

def run_interactive(client: E24ProxyClient, args: argparse.Namespace) -> int:
    prepop = _load_prepop(args)

    print("Starting assessment...")
    ids = extract_ids(client.start_assessment(args.member_id, prepop))
    traversal_id, e24_member_id = ids["traversal_id"], ids["e24_member_id"]

    print(f"  traversal id   : {traversal_id}")
    print(f"  e24 member id  : {e24_member_id}")
    print("  (keep both - they are what you need to resume this run later)\n")

    response = client.first_question(
        traversal_id, e24_member_id, args.algorithm_id, args.language
    )

    problem = prepop_problem(response)
    if problem:
        print("Expert24 rejected the prepop data:\n", file=sys.stderr)
        print(f"  {_strip_tags(problem)}\n", file=sys.stderr)
        return 1

    algorithm_id = str(response.get("AlgoID") or args.algorithm_id)
    answered = 0

    while not is_complete(response):
        print("-" * 70)
        print(describe_question(response))
        print("-" * 70)

        question = first_question_of(response)
        try:
            selections = _prompt_for_answer(question)
        except (EOFError, KeyboardInterrupt):
            print("\n\nStopped. Resume later with:", file=sys.stderr)
            print(
                f"  {sys.argv[0]} continue --traversal-id {traversal_id} "
                f"--e24-member-id {e24_member_id} ...",
                file=sys.stderr,
            )
            return 130

        node_id = int(response.get("NodeID") or 0)
        response = client.next_question(
            traversal_id, e24_member_id, algorithm_id, node_id,
            build_answer_body(selections),
        )

        error = response.get("Error")
        if error:
            print(f"\nExpert24 returned an error: {error}", file=sys.stderr)
            return 1

        algorithm_id = str(response.get("AlgoID") or algorithm_id)
        answered += 1

    print("=" * 70)
    print(f"Assessment complete - {answered} question(s) answered.")
    print("=" * 70)
    print()
    qa_results = client.qa(traversal_id)
    print(summarise_qa(qa_results))

    conclusions = response.get("Conclusions") or []
    if conclusions:
        alerts = [c for c in conclusions if c.get("Category") == "Alert"]
        goals = [c for c in conclusions if c.get("Category") == "Goal"]
        print(f"Conclusions: {len(conclusions)} total "
              f"({len(alerts)} alert, {len(goals)} care-plan goal)")
        for item in alerts + goals:
            print(f"  [{item.get('Category')}] "
                  f"{_strip_tags(str(item.get('DisplayText') or ''))}")

    if args.save:
        payload = {
            "traversalId": traversal_id,
            "e24MemberId": e24_member_id,
            "algorithmId": algorithm_id,
            "final": response,
            "qa": qa_results,
        }
        with open(args.save, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
        print(f"\nFull results written to {args.save}")

    return 0


def _prompt_for_answer(question: dict) -> List[dict]:
    answers = question.get("Answers") or []
    kind = classify_question(question)

    if kind == "text":
        target = answers[0] if answers else {"Index": ""}
        return [dict(target, value=input("Your answer > ").strip())]

    if kind == "value":
        selections = []
        for answer in answers:
            label = _strip_tags(str(answer.get("DisplayText") or "value"))
            if str(answer.get("ControlType", "")).lower() == "radio":
                continue  # "Don't know" / "Declined" - skip unless chosen below
            selections.append(dict(answer, value=input(f"{label} > ").strip()))
        return selections

    if kind == "multi":
        raw = input("Choose number(s), comma separated > ").strip()
        chosen = _parse_choices(raw, len(answers))
        return [dict(answers[i - 1], value="") for i in chosen]

    raw = input("Choose a number > ").strip()
    chosen = _parse_choices(raw, len(answers))
    return [dict(answers[chosen[0] - 1], value="")] if chosen else []


def _parse_choices(raw: str, count: int) -> List[int]:
    picked = []
    for part in raw.replace(" ", "").split(","):
        if part.isdigit() and 1 <= int(part) <= count:
            picked.append(int(part))
    return picked


def _load_prepop(args: argparse.Namespace) -> Optional[dict]:
    if getattr(args, "prepop_file", None):
        with open(args.prepop_file, "r", encoding="utf-8") as handle:
            return json.load(handle)
    if getattr(args, "prepop", None):
        return json.loads(args.prepop)
    return None


# --------------------------------------------------------------------------- #
#  Command line
# --------------------------------------------------------------------------- #

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="e24_proxy_client.py",
        description="Talk to a deployed Assessment E24 Proxy (api/E24Proxy).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Run a subcommand with --help for its own options.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--base-url", default=os.environ.get("E24_BASE_URL"),
                        help="Clinical Content Service base URL, e.g. "
                             "https://content-svc.example.com [env E24_BASE_URL]")
    common.add_argument("--e24-url", default=os.environ.get("E24_URL_BASE"),
                        help="Expert24 environment URL, sent as expert24urlBase "
                             "[env E24_URL_BASE]")
    common.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT,
                        help=f"Seconds per request (default {DEFAULT_TIMEOUT})")
    common.add_argument("--insecure", action="store_true",
                        help="Skip TLS certificate verification. Only for "
                             "internal hosts with a self-signed certificate.")
    common.add_argument("-v", "--verbose", action="store_true",
                        help="Print each request and response status to stderr")
    common.add_argument("--raw", action="store_true",
                        help="Print the raw JSON response instead of a summary")

    member = argparse.ArgumentParser(add_help=False)
    member.add_argument("--member-id", default=os.environ.get("E24_MEMBER_ID"),
                        help="Your application's member id [env E24_MEMBER_ID]")
    member.add_argument("--prepop", help="Prepop data as an inline JSON string")
    member.add_argument("--prepop-file", help="Path to a JSON file of prepop data")

    algo = argparse.ArgumentParser(add_help=False)
    algo.add_argument("--algorithm-id", default=os.environ.get("E24_ALGORITHM_ID"),
                      help="Expert24 assessment (algo) id [env E24_ALGORITHM_ID]")
    algo.add_argument("--language", default=os.environ.get("E24_LANGUAGE", "eng"),
                      help="eng or spa (default eng) [env E24_LANGUAGE]")

    run_ids = argparse.ArgumentParser(add_help=False)
    run_ids.add_argument("--traversal-id", required=True, help="Expert24 traversal id")

    sub = parser.add_subparsers(dest="command", required=True)

    s = sub.add_parser("smoke", parents=[common, member, algo],
                       help="Check a deployment: start an assessment and fetch "
                            "the first question, then stop")
    s.set_defaults(func=cmd_smoke)

    s = sub.add_parser("run", parents=[common, member, algo],
                       help="Walk through a whole assessment interactively")
    s.add_argument("--save", help="Write the full results to this JSON file")
    s.set_defaults(func=cmd_run)

    s = sub.add_parser("start", parents=[common, member],
                       help="POST /start - create a new traversal")
    s.set_defaults(func=cmd_start)

    s = sub.add_parser("begin-continue", parents=[common, member, run_ids],
                       help="POST /begin-continue - prepare a run to be resumed")
    s.add_argument("--e24-member-id", required=True)
    s.set_defaults(func=cmd_begin_continue)

    s = sub.add_parser("continue", parents=[common, run_ids],
                       help="GET /continue - fetch the question left off on")
    s.add_argument("--e24-member-id", required=True)
    s.set_defaults(func=cmd_continue)

    s = sub.add_parser("first", parents=[common, algo, run_ids],
                       help="POST /first - the opening question")
    s.add_argument("--e24-member-id", required=True)
    s.set_defaults(func=cmd_first)

    s = sub.add_parser("next", parents=[common, algo, run_ids],
                       help="POST /next - submit answers, get the next question")
    s.add_argument("--e24-member-id", required=True)
    s.add_argument("--node-id", type=int, required=True,
                   help="NodeID from the previous response")
    s.add_argument("--answers", default="{}",
                   help='Answer body as JSON, e.g. \'{"1":""}\' - keys are '
                        'answer Index values')
    s.set_defaults(func=cmd_next)

    s = sub.add_parser("previous", parents=[common, run_ids],
                       help="GET /previous - step back one question")
    s.set_defaults(func=cmd_previous)

    s = sub.add_parser("info", parents=[common, run_ids],
                       help="GET /info - help text for a question or answer")
    s.add_argument("--note-type", type=int, default=32,
                   help="32 = question note, 64 = answer note (default 32)")
    s.add_argument("--item-id", type=int, required=True)
    s.set_defaults(func=cmd_info)

    s = sub.add_parser("qa", parents=[common, run_ids],
                       help="GET /qa - final data for a completed assessment")
    s.set_defaults(func=cmd_qa)

    return parser


def _client(args: argparse.Namespace) -> E24ProxyClient:
    missing = [name for name, value in
               (("--base-url", args.base_url), ("--e24-url", args.e24_url))
               if not value]
    if missing:
        raise SystemExit(
            f"error: {' and '.join(missing)} required "
            f"(or set E24_BASE_URL / E24_URL_BASE)"
        )
    if args.insecure:
        print("warning: TLS certificate verification is OFF", file=sys.stderr)
    return E24ProxyClient(
        base_url=args.base_url,
        e24_url_base=args.e24_url,
        timeout=args.timeout,
        verify_tls=not args.insecure,
        verbose=args.verbose,
    )


def _emit(args: argparse.Namespace, response: dict, summary: str) -> int:
    print(json.dumps(response, indent=2) if args.raw else summary)
    return 0


def _require(args: argparse.Namespace, *names: str) -> None:
    missing = [f"--{n.replace('_', '-')}" for n in names if not getattr(args, n, None)]
    if missing:
        raise SystemExit(f"error: {', '.join(missing)} required")


def cmd_start(args):
    _require(args, "member_id")
    response = _client(args).start_assessment(args.member_id, _load_prepop(args))
    ids = extract_ids(response)
    return _emit(args, response,
                 f"traversal id  : {ids['traversal_id']}\n"
                 f"e24 member id : {ids['e24_member_id']}")


def cmd_begin_continue(args):
    _require(args, "member_id")
    response = _client(args).begin_continue(
        args.traversal_id, args.e24_member_id, args.member_id, _load_prepop(args))
    return _emit(args, response, "begin-continue accepted")


def cmd_continue(args):
    response = _client(args).continue_assessment(args.traversal_id, args.e24_member_id)
    return _emit(args, response, describe_question(response))


def cmd_first(args):
    _require(args, "algorithm_id")
    response = _client(args).first_question(
        args.traversal_id, args.e24_member_id, args.algorithm_id, args.language)
    return _emit(args, response, describe_question(response))


def cmd_next(args):
    _require(args, "algorithm_id")
    response = _client(args).next_question(
        args.traversal_id, args.e24_member_id, args.algorithm_id,
        args.node_id, json.loads(args.answers))
    if is_complete(response):
        return _emit(args, response, "Assessment complete. Fetch results with: qa")
    return _emit(args, response, describe_question(response))


def cmd_previous(args):
    response = _client(args).previous_question(args.traversal_id)
    return _emit(args, response, describe_question(response))


def cmd_info(args):
    response = _client(args).item_info(args.traversal_id, args.note_type, args.item_id)
    table = response.get("Table") or []
    text = _strip_tags(str(table[0].get("Explanation", ""))) if table else "(no text)"
    return _emit(args, response, text)


def cmd_qa(args):
    response = _client(args).qa(args.traversal_id)
    return _emit(args, response, summarise_qa(response))


def cmd_smoke(args):
    _require(args, "member_id", "algorithm_id")
    client = _client(args)

    print(f"Clinical Content Service : {client.base_url}")
    print(f"Expert24 environment     : {client.e24_url_base}")
    print()

    print("[1/2] POST /start ...")
    ids = extract_ids(client.start_assessment(args.member_id, _load_prepop(args)))
    print(f"      ok - traversal {ids['traversal_id']}, "
          f"member {ids['e24_member_id']}")

    print("[2/2] POST /first ...")
    response = client.first_question(
        ids["traversal_id"], ids["e24_member_id"], args.algorithm_id, args.language)

    problem = prepop_problem(response)
    if problem:
        print(f"      Expert24 rejected the prepop data:\n      "
              f"{_strip_tags(problem)}", file=sys.stderr)
        return 1

    if response.get("Error"):
        print(f"      Expert24 error: {response['Error']}", file=sys.stderr)
        return 1

    print(f"      ok - assessment '{response.get('AlgoName')}'")
    print()
    print("The deployment is reachable and working.")
    print()
    print(describe_question(response))
    return 0


def cmd_run(args):
    _require(args, "member_id", "algorithm_id")
    return run_interactive(_client(args), args)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except E24HttpError as exc:
        print(f"\nerror: {exc}", file=sys.stderr)
        if exc.status == 404:
            print("hint: a 404 usually means --base-url is missing the host's "
                  "application path, or the service is not deployed there.",
                  file=sys.stderr)
        if exc.status in (401, 403):
            print("hint: the service rejected the request - it may sit behind "
                  "authentication this script does not send.", file=sys.stderr)
        return 1
    except E24Error as exc:
        print(f"\nerror: {exc}", file=sys.stderr)
        return 1
    except json.JSONDecodeError as exc:
        print(f"\nerror: could not parse the JSON you supplied: {exc}", file=sys.stderr)
        return 2
    except FileNotFoundError as exc:
        print(f"\nerror: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("\ninterrupted", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
