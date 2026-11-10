"""Publish a text post to LinkedIn through the Posts API.

Run by .github/workflows/linkedin-post.yml, which passes everything as env vars:
  LINKEDIN_ACCESS_TOKEN  member token with the openid, profile and w_member_social scopes
  LINKEDIN_AUTHOR_URN    optional urn:li:person:<id>; looked up from the token when empty
  LINKEDIN_API_VERSION   optional YYYYMM version header; DEFAULT_VERSION when empty
  POST_TEXT              the post; words starting with # become LinkedIn hashtags
  POST_FILE              optional path to a JSON post file, used instead of POST_TEXT:
                         {"text": "...", "images": [{"path": "repo/path.png", "alt": "..."}]}
  POST_VISIBILITY        PUBLIC or CONNECTIONS
  DRY_RUN                "true" to check the token and print the request without posting
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

API = "https://api.linkedin.com"
DEFAULT_VERSION = "202607"
MAX_LENGTH = 3000
MAX_IMAGES = 20
# Characters reserved by LinkedIn's "little text" format. Left unescaped they
# are parsed as markup, and LinkedIn can silently drop the rest of the post.
RESERVED = set("\\|{}@[]()<>#*_~")


def to_little_text(text):
    escaped = "".join("\\" + c if c in RESERVED else c for c in text)
    # Turn escaped #word back into a real hashtag: {hashtag|\#|word}
    return re.sub(r"(?<!\S)\\#(\w+)", r"{hashtag|\\#|\1}", escaped)


class ApiError(Exception):
    def __init__(self, method, url, code, detail):
        hint = " (token expired or missing a scope? generate a new one)" if code == 401 else ""
        super().__init__(f"{method} {url.split('?')[0]} failed with HTTP {code}{hint}: {detail}")
        self.code = code


def call(method, url, headers, body=None, data=None):
    """Send JSON (body) or raw bytes (data); return the response headers and parsed JSON."""
    if body is not None:
        data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        raise ApiError(method, url, e.code, e.read().decode(errors="replace")) from None
    try:
        return resp.headers, json.loads(raw) if raw else None
    except ValueError:
        return resp.headers, None


def load_post():
    """Return (text, images) from POST_FILE when set, otherwise from POST_TEXT."""
    path = os.environ.get("POST_FILE", "").strip()
    if not path:
        return os.environ.get("POST_TEXT", "").strip(), []
    with open(path, encoding="utf-8") as f:
        spec = json.load(f)
    images = spec.get("images", [])
    if len(images) > MAX_IMAGES:
        sys.exit(f"{path} lists {len(images)} images; LinkedIn allows {MAX_IMAGES}")
    for img in images:
        if not os.path.isfile(img["path"]):
            sys.exit(f"Image not found: {img['path']}")
    return spec.get("text", "").strip(), images


def upload_image(path, author, headers, auth):
    _, init = call("POST", f"{API}/rest/images?action=initializeUpload", headers,
                   {"initializeUploadRequest": {"owner": author}})
    with open(path, "rb") as f:
        data = f.read()
    call("PUT", init["value"]["uploadUrl"], {**auth, "Content-Type": "application/octet-stream"}, data=data)
    print(f"Uploaded {path} ({len(data) // 1024} KB) as {init['value']['image']}")
    return init["value"]["image"]


def image_content(media):
    """Post content for a list of {"id", "altText"}: one image or a multi-image set."""
    if len(media) == 1:
        return {"media": media[0]}
    return {"multiImage": {"images": media}}


def main():
    token = os.environ.get("LINKEDIN_ACCESS_TOKEN", "").strip()
    if not token:
        sys.exit("The LINKEDIN_ACCESS_TOKEN repository secret is not set")
    text, images = load_post()
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
        if images:
            post["content"] = image_content(
                [{"id": f"(uploaded when posting: {i['path']})", "altText": i.get("alt", "")} for i in images])
        print("Dry run, nothing uploaded or posted. Request body:")
        print(json.dumps(post, indent=2, ensure_ascii=False))
        return

    headers = {
        **auth,
        "LinkedIn-Version": version,
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
    }
    if images:
        post["content"] = image_content(
            [{"id": upload_image(i["path"], author, headers, auth), "altText": i.get("alt", "")} for i in images])
    # LinkedIn processes uploads asynchronously, so a post that references a
    # just-uploaded image can be rejected for a few seconds.
    for attempt in range(4 if images else 1):
        if images:
            time.sleep(5 + 10 * attempt)
        try:
            resp_headers, _ = call("POST", f"{API}/rest/posts", headers, post)
            break
        except ApiError as e:
            if not images or attempt == 3 or e.code in (401, 403):
                raise
            print(f"Post not accepted yet, retrying: {e}")
    urn = resp_headers.get("x-restli-id")
    result = f"https://www.linkedin.com/feed/update/{urn}/" if urn else "(LinkedIn returned no post id)"
    print(f"Posted to LinkedIn: {result}")

    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as f:
            f.write(f"Posted to LinkedIn: {result}\n")


if __name__ == "__main__":
    try:
        main()
    except ApiError as e:
        sys.exit(str(e))
