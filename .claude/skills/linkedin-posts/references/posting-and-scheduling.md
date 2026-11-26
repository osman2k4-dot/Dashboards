# Posting and scheduling

## The pieces

- **Workflow:** `.github/workflows/linkedin-post.yml`, started by hand (`workflow_dispatch`). Inputs: `text`, `post_file`, `visibility` (`PUBLIC` or `CONNECTIONS`), `dry_run`, `upload_only`.
- **Script:** `.github/scripts/linkedin_post.py`. It escapes the text for LinkedIn, turns `#word` into hashtags, uploads images or a video, waits for a video to finish processing, then publishes.
- **Secret:** `LINKEDIN_ACCESS_TOKEN` in the repository's Actions secrets. The author is read from the token.
- **Branch:** post files and the workflow live on the session's working branch; run the workflow on that branch (`ref`). Check `git branch --show-current` and `linkedin/PLAN.md` for the branch in use.

The session has no `gh` CLI. Use the GitHub MCP tools (`mcp__github__actions_run_trigger`, `mcp__github__actions_list`, `mcp__github__get_job_logs`); load them with ToolSearch if they are deferred.

## Before a post can be published

The post file and its images must be committed and pushed to the branch the workflow runs on. A run uses what is on GitHub, not what is in the working tree.

Two safe ways to test:

- `dry_run: true` checks the token and prints the request. Nothing is uploaded or posted.
- `upload_only: true` uploads the images or video and stops. Use it the first time a new kind of media is posted, so a failure shows up days before the scheduled time and not at it.

## Scheduling a post

Only after the user has approved that post.

Create a one-off scheduled task that fires into this session (`mcp__claude-code-remote__create_trigger` with `run_once_at`, `initiation: "human_request"`). Write the time as local UAE time with the zone in brackets so nobody has to convert it:

```
run_once_at: 2026-12-07T12:30:00[Asia/Dubai]
name: LinkedIn post Mon 7 Dec 12:30 UAE: <short name>
```

Store this prompt, filling in the file and the branch:

```
Scheduled LinkedIn post (the user approved it on <date>). Do exactly this and nothing more:
1. List recent runs of `linkedin-post.yml` on repo `osman2k4-dot/Dashboards`; if a run for this post file already happened today, do not trigger again, just report it.
2. Otherwise trigger the workflow ONCE on ref `<branch>` with inputs: post_file = `linkedin/post-NN-name.json`, visibility = `PUBLIC`, dry_run = `false`, upload_only = `false`.
3. Wait for the run to finish, read the job log, and report to the user in two or three lines: the LinkedIn post link from the log (or the error if it failed), and a reminder to reply to comments in the first hour.
Do not publish any other post. If the run fails, do not retry more than once, and say what failed.
```

For a video post add: "This post uploads a video, so the run can take a few minutes while LinkedIn processes it."

To move a post, update the task (`update_trigger` with a new `run_once_at` and name); do not delete and recreate it. After scheduling, record the task and time in `linkedin/PLAN.md` and confirm the list of dates to the user.

## When a scheduled task fires

1. Read the notification (`ReadNotifications`).
2. List the latest runs of `linkedin-post.yml`. If today already has a run for this post file, report that run and stop. A worker restart once delivered a task late; this check is what prevents a double post.
3. Trigger the workflow once with the inputs in the task.
4. Wait about 40 seconds (75 for a video) with a background `sleep`, then list the run, list its jobs, and read the job log with `get_job_logs` (`job_id`, `return_content: true`, `tail_lines: 20`).
5. The log line `Posted to LinkedIn: https://www.linkedin.com/feed/update/…` is the link. Send it to the user with the time it went live, the reminder about the first hour, and what is next.
6. Add the link to the posted list in `linkedin/PLAN.md`.

If the run failed, read the log and say what failed in plain words. Retry once at most. A `401` means the token has expired.

## The access token

LinkedIn member tokens last 60 days. The current one expires around **9 January 2027**. Remind the user a week before. Renewal is the user's to do:

1. Open the LinkedIn developer portal, the app, then the token generator under the OAuth tools.
2. Tick `openid`, `profile` and `w_member_social`, and request a token.
3. In the GitHub repository: Settings, Secrets and variables, Actions, `LINKEDIN_ACCESS_TOKEN`, Update, paste, save.
4. Run the workflow with `dry_run: true` to confirm it works.

The token must never be pasted into the chat.

## What the workflow cannot do yet

- **Polls.** The script has no poll content type. Either add it (LinkedIn's Posts API accepts a `poll` content block) and test it with a connections-only post, or ask the user to post the poll by hand.
- **First comment, edits, deletes.** Not built.
- **Documents (PDF carousels).** Not built.

## Timing and reach, as researched in November 2026

- 8:30 was too early; most studies find engagement highest from late morning into the afternoon. The agreed 12:30 slot is lunch in the UAE, late morning in Saudi Arabia and the start of the day in the UK. Friday is a half day in the UAE, hence 11:00.
- Weekends and public holidays are weak. UAE National Day falls around 2 to 3 December.
- LinkedIn shows a video uploaded to the post far more widely than a link to one, which is why the workflow uploads the MP4 itself.
- The early posts reached few people, mostly outside the user's network. Replying to comments in the first hour, commenting on others' posts and growing the network matter more than the hour of posting.
