"""PayNavigate admin: create merchants and invite codes on the live server.

Run from the repository root (e.g. in a Codespace terminal). Needs only Python - no packages to install.

  export PAYNAVIGATE_API=https://ai-payments-consultant-agent-production.up.railway.app
  export ADMIN_KEY=...the ADMIN_KEY you set in Railway...

  python api/admin.py merchants                          list merchants and how many logins each has
  python api/admin.py new-merchant "Corner Bakery"       create a merchant (prints its id)
  python api/admin.py invite 3 owner@cornerbakery.com.au invite code for merchant 3 (email optional)
  python api/admin.py remove-user owner@cornerbakery.com.au   remove a login (forgotten password), then invite again
"""
import json
import os
import sys
import urllib.error
import urllib.request


def call(method: str, path: str, body: dict | None = None):
    base = os.environ.get("PAYNAVIGATE_API", "").rstrip("/")
    key = os.environ.get("ADMIN_KEY", "")
    if not base or not key:
        sys.exit("Set PAYNAVIGATE_API (the server address) and ADMIN_KEY first - see the top of this file.")
    req = urllib.request.Request(base + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"X-Admin-Key": key, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        detail = json.loads(e.read() or b"{}").get("detail", e.reason)
        sys.exit(f"Server said ({e.code}): {detail}")
    except urllib.error.URLError as e:
        sys.exit(f"Couldn't reach {base}: {e.reason}")


def main(args: list[str]):
    cmd = args[0] if args else ""
    if cmd == "merchants":
        rows = call("GET", "/v1/admin/merchants")
        if not rows:
            print("No merchants yet. Create one with: python api/admin.py new-merchant \"Business name\"")
        for m in rows:
            print(f"{m['id']:>4}  {m['name']}  ({m['users']} login{'s' if m['users'] != 1 else ''})")
    elif cmd == "new-merchant" and len(args) >= 2:
        m = call("POST", "/v1/admin/merchants", {"name": " ".join(args[1:])})
        print(f"Created merchant {m['id']}: {m['name']}\nNext: python api/admin.py invite {m['id']} their@email.com")
    elif cmd == "invite" and len(args) >= 2:
        inv = call("POST", "/v1/admin/invites", {"merchant_id": int(args[1]), "email": args[2] if len(args) > 2 else None})
        print(f"Invite code: {inv['code']}")
        print(f"For: {inv['email'] or 'any email'} · expires {inv['expires_at'][:10]}")
        print("Send them the code. In the app they tap 'Have an invite code? Create your account'.")
    elif cmd == "remove-user" and len(args) == 2:
        call("POST", "/v1/admin/remove-user", {"email": args[1]})
        print(f"Removed {args[1]}. Send them a new invite to set a new password.")
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
