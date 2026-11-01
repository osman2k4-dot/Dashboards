"""Publish a text post to LinkedIn through the Posts API.

Run by .github/workflows/linkedin-post.yml, which passes everything as env vars:
  LINKEDIN_ACCESS_TOKEN  member token with the openid, profile and w_member_social scopes
  LINKEDIN_AUTHOR_URN    optional urn:li:person:<id>; looked up from the token when empty
  LINKEDIN_API_VERSION   optional YYYYMM version header; DEFAULT_VERSION when empty
  POST_TEXT              the post; words starting with # become LinkedIn hashtags
  POST_VISIBILITY        PUBLIC or CONNECTIONS
  DRY_RUN                "true" to check the token and print the request without posting
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request

API = "https://api.linkedin.com"
DEFAULT_VERSION = "202607"
MAX_LENGTH = 3000
# Characters reserved by LinkedIn's "little text" format. Left unescaped they
# are parsed as markup, and LinkedIn can silently drop the rest of the post.
RESERVED = set("\\|{}@[]()<>#*_~")


def to_little_text(text):
    escaped = "".join("\\" + c if c in RESERVED else c for c in text)
    # Turn escaped #word back into a real hashtag: {hashtag|\#|word}
    return re.sub(r"(?<!\S)\\#(\w+)", r"{hashtag|\\#|\1}", escaped)


def call(method, url, headers, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
            return resp.headers, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        hint = " (token expired or missing a scope? generate a new one)" if e.code == 401 else ""
        sys.exit(f"{method} {url} failed with HTTP {e.code}{hint}: {detail}")


def main():
    token = os.environ.get("LINKEDIN_ACCESS_TOKEN", "").strip()
    if not token:
        sys.exit("The LINKEDIN_ACCESS_TOKEN repository secret is not set")
    text = os.environ.get("POST_TEXT", "").strip()
    if not text:
        sys.exit("Post text is empty")
    if len(text) > MAX_LENGTH:
        sys.exit(f"Post is {len(text)} characters; LinkedIn allows {MAX_LENGTH}")

    version = os.environ.get("LINKEDIN_API_VERSION", "").strip() or DEFAULT_VERSION
    visibility = os.environ.get("POST_VISIBILITY", "").strip() or "PUBLIC"
    dry_run = os.environ.get("DRY_RUN") == "true"
    auth = {"Authorization": f"Bearer {token}"}

    author = os.environ.get("LINKEDIN_AUTHOR_URN", "").strip()
    if not author or dry_run:
        _, me = call("GET", f"{API}/v2/userinfo", auth)
        print(f"Token belongs to {me.get('name', 'unknown')} (urn:li:person:{me['sub']})")
        author = author or f"urn:li:person:{me['sub']}"

    post = {
        "author": author,
        "commentary": to_little_text(text),
        "visibility": visibility,
        "distribution": {
            "feedDistribution": "MAIN_FEED",
            "targetEntities": [],
            "thirdPartyDistributionChannels": [],
        },
        "lifecycleState": "PUBLISHED",
        "isReshareDisabledByAuthor": False,
    }

    if dry_run:
        print("Dry run, nothing posted. Request body:")
        print(json.dumps(post, indent=2, ensure_ascii=False))
        return

    headers = {
        **auth,
        "LinkedIn-Version": version,
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
    }
    resp_headers, _ = call("POST", f"{API}/rest/posts", headers, post)
    urn = resp_headers.get("x-restli-id")
    result = f"https://www.linkedin.com/feed/update/{urn}/" if urn else "(LinkedIn returned no post id)"
    print(f"Posted to LinkedIn: {result}")

    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as f:
            f.write(f"Posted to LinkedIn: {result}\n")


if __name__ == "__main__":
    main()
