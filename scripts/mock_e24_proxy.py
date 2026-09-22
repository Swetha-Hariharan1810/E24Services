#!/usr/bin/env python3
"""A local stand-in for the deployed `api/E24Proxy` service.

WHY THIS EXISTS
---------------
`scripts/e24_proxy_client.py` does not talk to the Angular application. It talks
to the Sagility Clinical Content Service — the ASP.NET backend that exposes
`/api/E24Proxy/*` and forwards to Expert24. That service lives in a different
repository and is not part of this one.

So if you want to exercise the client without a real backend (no VPN, no
Expert24 credentials, no Clinical Content Service checkout), run this instead.
It implements the same eight routes with the same verbs and the same response
shapes, and it serves a small three-question assessment.

    python3 scripts/mock_e24_proxy.py
    ./scripts/e24_proxy_client.py smoke --base-url http://127.0.0.1:8099 \
        --e24-url https://aph-uat.expert-24.net \
        --member-id ABC_TMJarrett --algorithm-id 10657

It also sends permissive CORS headers, so the Angular tester at
http://localhost:4200 can point its "Webservice URL base" field here and drive
the same mock through the UI.

THIS IS A TEST DOUBLE. The answers are canned, nothing is persisted, and there
is no authentication. Never run it anywhere it could be mistaken for the real
service.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

API_ROOT = "/api/E24Proxy"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8099


# --------------------------------------------------------------------------
# Canned assessment content, shaped exactly like Expert24's wire format.
# --------------------------------------------------------------------------

def _answer(index, answer_id, control_type, display_text, subtype=""):
    return {
        "Index": str(index),
        "AnswerID": answer_id,
        "ControlType": control_type,
        "ControlSubType": subtype,
        "DisplayText": display_text,
        "isChecked": False,
        "ControlValue": "",
        "hasInfo": False,
    }


def _question(node_id, algo_id, text, answers, title=""):
    return {
        "AlgoID": algo_id,
        "AlgoName": "Mock Health Assessment",
        "NodeID": node_id,
        "Questions": [
            {
                "QuestionID": node_id,
                "DisplayText": text,
                "Title": title,
                "Answers": answers,
                "hasInfo": True,
                "Properties": {},
            }
        ],
        "Conclusions": [],
        "Error": "",
        "suppressBack": node_id == 1,
        "suppressNext": False,
        "Language": "MEMBER",
    }


# Note the algorithm ID changing between node 2 and node 3. Expert24 really does
# move a traversal between algorithms mid-assessment, and the client is expected
# to re-read AlgoID from every response rather than reuse the one it started
# with. Keeping that here means the mock catches a client that gets it wrong.
FLOW = {
    1: _question(1, 555, "Do you currently smoke?", [
        _answer(1, 1001, "radio", "Yes"),
        _answer(2, 1002, "radio", "No"),
    ]),
    2: _question(2, 555, "Which of these apply to <b>you</b>?", [
        _answer(1, 2001, "checkbox", "High blood pressure"),
        _answer(2, 2002, "checkbox", "Diabetes"),
        _answer(3, 2003, "checkbox", "None of the above"),
    ]),
    3: _question(3, 556, "What is your current weight?", [
        _answer(1, 3001, "text", "Pounds", subtype="number"),
    ], title="Vitals"),
}

COMPLETED = {
    "AlgoID": 556,
    "AlgoName": "",
    "NodeID": 99,
    "Questions": [],
    "Report": {"InformationConclusions": []},
    "Conclusions": [
        {"Category": "Alert", "DisplayText": "Smoking risk identified", "ConclusionID": 1},
        {"Category": "Goal", "DisplayText": "Agree a quit-smoking plan", "ConclusionID": 2},
        {"Category": "Goal", "DisplayText": "Review weight at next visit", "ConclusionID": 3},
    ],
    "Error": "",
}

START_RESPONSE = {
    "ReturnValue": "ok",
    "Table": [{"TraversalID": "T-1", "MemberID": "M-99", "FirstName": "Test", "LastName": "Member"}],
}

QA_RESPONSE = {
    "Table": [
        {"NodeID": "1", "QuestionID": "1", "Question": "Do you currently smoke?",
         "AnsID": "1001", "Answer": "Yes", "SValue": ""},
        {"NodeID": "2", "QuestionID": "2", "Question": "Which of these apply to you?",
         "AnsID": "2001", "Answer": "High blood pressure", "SValue": ""},
        {"NodeID": "3", "QuestionID": "3", "Question": "What is your current weight?",
         "AnsID": "3001", "Answer": "Pounds", "SValue": "180"},
    ]
}

INFO_RESPONSE = {
    "Table": [{"Explanation": "A <b>helpful</b> note about this question.\nIt can span lines."}]
}


# --------------------------------------------------------------------------
# HTTP plumbing
# --------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    server_version = "MockE24Proxy/1.0"
    quiet = False

    # Silence the default stderr access log; we print our own.
    def log_message(self, fmt, *args):
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization")
        self.send_header("Access-Control-Max-Age", "600")

    def _send(self, payload, status=200):
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self._cors()
        self.end_headers()
        self.wfile.write(raw)
        return status

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")

    def _dispatch(self, method):
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length).decode("utf-8") if length else ""

        status = self._route(method, parsed.path, query, body)

        if not self.quiet:
            stamp = datetime.now().strftime("%H:%M:%S")
            target = parsed.path + (f"?{parsed.query}" if parsed.query else "")
            line = f"  {stamp}  {status}  {method} {target}"
            if body:
                line += f"\n{' ' * 12}body: {body}"
            print(line, flush=True)

    def _route(self, method, path, query, body):
        # Every route on the real service requires this. Rejecting without it
        # is the whole point of the mock: it catches a client that forgets.
        if "expert24urlBase" not in query:
            return self._send(
                {"Error": "expert24urlBase query parameter is required"}, 400
            )

        if path == f"{API_ROOT}/start" and method == "POST":
            payload = _parse_json(body)
            if payload is None:
                return self._send({"Error": "request body is not valid JSON"}, 400)
            # The shipped Angular control sends PascalCase; the spec document
            # shows camelCase. ASP.NET Core binds case-insensitively, so accept
            # either and let the client choose.
            if not (payload.get("MemberId") or payload.get("memberId")):
                return self._send({"Error": "MemberId is required"}, 400)
            return self._send(START_RESPONSE)

        if re.match(rf"^{API_ROOT}/begin-continue/[^/]+/[^/]+$", path) and method == "POST":
            return self._send(START_RESPONSE)

        if re.match(rf"^{API_ROOT}/continue/[^/]+/[^/]+$", path) and method == "GET":
            return self._send(FLOW[2])

        if re.match(rf"^{API_ROOT}/first/[^/]+/[^/]+/[^/]+$", path) and method == "POST":
            return self._send(FLOW[1])

        match = re.match(rf"^{API_ROOT}/next/[^/]+/[^/]+/[^/]+/(\d+)$", path)
        if match and method == "POST":
            previous_node = int(match.group(1))
            return self._send(FLOW.get(previous_node + 1, COMPLETED))

        if re.match(rf"^{API_ROOT}/previous/[^/]+$", path) and method == "GET":
            return self._send(FLOW[1])

        if re.match(rf"^{API_ROOT}/info/[^/]+/\d+/\d+$", path) and method == "GET":
            return self._send(INFO_RESPONSE)

        if re.match(rf"^{API_ROOT}/qa/[^/]+$", path) and method == "GET":
            return self._send(QA_RESPONSE)

        return self._send({"Error": "no such route", "Path": path, "Method": method}, 404)


def _parse_json(raw):
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except ValueError:
        return None


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Run a local stand-in for the api/E24Proxy service.",
        epilog="This is a test double with canned answers. Never expose it.",
    )
    parser.add_argument("--host", default=DEFAULT_HOST,
                        help=f"interface to bind (default: {DEFAULT_HOST})")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT,
                        help=f"port to listen on (default: {DEFAULT_PORT})")
    parser.add_argument("-q", "--quiet", action="store_true",
                        help="do not print each request")
    args = parser.parse_args(argv)

    Handler.quiet = args.quiet

    try:
        server = ThreadingHTTPServer((args.host, args.port), Handler)
    except OSError as exc:
        print(f"Could not bind {args.host}:{args.port} — {exc}", file=sys.stderr)
        if getattr(exc, "errno", None) == 98:
            print("Something is already listening there. Pass --port to pick "
                  "another.", file=sys.stderr)
        return 1

    base = f"http://{args.host}:{args.port}"
    print(f"Mock E24 proxy listening on {base}")
    print(f"  routes under {base}{API_ROOT}/")
    print()
    print("  Point the Python client at it:")
    print(f"    ./scripts/e24_proxy_client.py run --base-url {base} \\")
    print("        --e24-url https://aph-uat.expert-24.net \\")
    print("        --member-id ABC_TMJarrett --algorithm-id 10657")
    print()
    print("  Or the Angular tester: set 'Webservice URL base' to")
    print(f"    {base}")
    print()
    print("Ctrl-C to stop.")
    print()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
