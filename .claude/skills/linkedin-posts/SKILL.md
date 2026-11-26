---
name: linkedin-posts
description: Runs Muhammad Usman's LinkedIn presence from this repository - planning, researching, writing, illustrating, scheduling and publishing posts through the GitHub Actions workflow. Use this skill whenever the user mentions LinkedIn, a post, next week's or next month's posts, a content plan, a card or video for a post, posting times, views or reach, or says things like "approved", "schedule it", "show the posts", "why no post today" - even if they do not say "LinkedIn". Also use it when a scheduled-post notification fires in the session.
---

# LinkedIn posts

The user is a Project Controls Manager in Abu Dhabi who wants recruiters and industry peers to notice their work, for job offers and freelance work. They write short messages in plain English, often with typos, and read replies on a phone. Everything here exists so that a new session can carry on the LinkedIn work without asking them to explain it again.

**Start every session by reading `linkedin/PLAN.md`.** It holds the state this skill cannot: what has been posted, what is scheduled, what is drafted and waiting for the user's approval, and the plan for the coming weeks. Update it whenever any of those change, and commit it with the change.

## The loop

1. **Plan** - propose the week or month as a table: date, post, type, status.
2. **Research** - find figures from reliable sources when a post needs them (rules below).
3. **Write** - one post file per post, in the user's voice.
4. **Illustrate** - a light-theme card, or a video when the subject is the 4D model.
5. **Show** - put the full text in the chat and send the card image. The user approves by reading, so never ask them to open a file to see the words.
6. **Schedule** - only after the user says "approved" (or names the posts they approve).
7. **Publish and report** - when the scheduled time fires, trigger the workflow once and send the user the link.

Publishing is public and cannot be undone, and an image cannot be replaced once a post is live. That is why nothing is scheduled without the user's approval, and why a draft that speaks about their own practice is flagged for them to check first.

## The user's voice

- Plain English, short sentences, short lines. The user asked for "simple" more than once. A post they liked was 1,100 characters.
- Open with one strong claim a planner or project manager will want to argue with. Argue it in short points. End with one question a reader can answer in a line. The question earns the comments, and comments decide reach.
- Write as a practitioner with **18 years in construction** (never "18 years in EPC"; the user corrected this).
- First-person claims must be true. Lines like "what I changed in the meetings I run" put words in the user's mouth, so list them when you show the draft and ask the user to change any that do not match what they do.
- Show technical depth and the value the user adds, not only that they use AI. Early drafts were rejected as "very generic" and "only focusing on AI skills".
- Five hashtags at the end. Up to 3,000 characters; most posts sit between 800 and 2,300.
- Bullets use `•`. Quotes of a phrase use curly quotes. No project, client or employer names.

## What must never appear in a post

The user's real project is confidential. Posts, cards, alt text and file names never name the employer, the client, the project, the contractors, or contract and unit numbers. Demos use the fictional "Orion Project" and say "demo on fictional data". Work done in the company's Claude account stays there: do not ask the user to bring company files into this repository; ask for a screenshot or a description instead.

Never ask the user to paste the LinkedIn token into the chat; it lives in the repository secret `LINKEDIN_ACCESS_TOKEN`.

## Research rules

The user asks for "reliable sources", "recent numbers" and "search deep", and reads the figures closely.

- **Construction only.** When the user asks about stress, delay or cost, use construction studies. If nothing exists for the UAE, use construction data from elsewhere and say plainly that no UAE figure was found. Figures for "all employees" were rejected.
- **Recent first.** Prefer the last two years; give the year next to every figure so readers can judge an older one.
- **Say what the number measures.** "66 %" meant nothing to the user until it became "a 24-month project asked for about 16 months more". Give one plain example for any ratio.
- **Name who was counted.** "Project organisations" was not understood; "project professionals PwC surveyed" did not.
- **Be honest about the evidence.** Say when a figure covers only disputed projects, when a survey is small or from another country, and when you worked from search summaries because the original page would not open. Put the sources as links at the end of your reply.
- **Do not invent a statistic to fill a gap.** When no study exists, say so in the post; it can become the question, or a poll that creates the data.

## Post files

Each post is `linkedin/post-NN-short-name.json`, numbered in order:

```json
{ "text": "…", "images": [{ "path": "linkedin/assets/week-YYYY-MM-DD/01-name.png", "alt": "what the card says, in full" }] }
```

A video post uses `"video": { "path": "linkedin/assets/video/name.mp4", "title": "…" }` instead of `images`. A post takes images or a video, not both. Text-only posts have just `text`. Drafts that cannot be published by the workflow yet (a poll) or cannot be written yet are `.txt` notes with the same number.

Check a file before showing it:

```bash
cd <repo> && POST_FILE=linkedin/post-NN-name.json python3 -c "import sys;sys.path.insert(0,'.github/scripts');import linkedin_post as lp;t,i,v=lp.load_post();print(len(t),'chars',len(i),'images',bool(v))"
```

## Cards

Cards are 1080 × 1350, light theme (a standing preference of the user), one idea each: a kicker line, a title with the key words highlighted in yellow, the evidence, one dark box with the point, and the author footer. Statuses and categories are always written in words as well as coloured.

Use the bundled kit so every card matches. Write a small cards module and render it:

```bash
node .claude/skills/linkedin-posts/scripts/render_cards.js linkedin/cards/week-YYYY-MM-DD.js linkedin/assets/week-YYYY-MM-DD
```

The renderer prints how far the content ends above the footer and fails on an overflow, so read its output, then look at the image once before sending it. `scripts/example_cards.js` shows the two layouts used most; `references/cards.md` lists every building block and the lessons from cards the user sent back.

The user prefers video to cards for the 4D model ("video is more interesting than only card"). `scripts/make_4d_video.js` is the script that made the posted walkthrough; its header explains how to run and encode it.

## Scheduling and publishing

Agreed times, UAE: **Monday to Thursday 12:30, Friday 11:00.** Three posts a week is the working rhythm; skip UAE public holidays and the days around them.

Scheduling uses one-off scheduled tasks that fire into the session, and publishing is the workflow `.github/workflows/linkedin-post.yml` run on the working branch. The exact steps, the task prompt to store, how to read the result, what to do when something fails and how the token is renewed are in `references/posting-and-scheduling.md`. Read it before scheduling or publishing anything.

Two rules matter enough to repeat here: trigger the workflow **once** per post and check first that no run for that post already happened that day, and after each post send the user the link with a reminder to reply to comments in the first hour.

## Things that cannot be done from a session

- **Reading the LinkedIn analytics.** There is no access to the account's numbers. Ask for screenshots of a post's analytics, the follower count and the 28-day content analytics.
- **Editing a published post's image**, or deleting a post. The user does that in LinkedIn.
- **Commenting or reacting** on the user's behalf.

Say so plainly when asked, and give the manual step.
