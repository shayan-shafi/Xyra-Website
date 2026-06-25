# Instagram Comment → DM Automation — App Review Checklist

Meta requires **App Review** before your app can act on comments from the
**public** (anyone who isn't a Tester/Admin on your app). Until then the
automation works only for accounts with a role on your app — which is fine for
building and testing, but **public commenters will not get DMs** until this is
approved and the app is in **Live mode**.

This doc is the checklist + the materials you'll submit.

---

## Do you actually need App Review?

| Situation | Need review? |
|---|---|
| Testing with your own / Tester accounts | **No** — works in Development mode. |
| Real followers commenting ALPHA get a DM | **Yes** — needs approved permissions + Live mode. |

So: build and test now without review; submit for review before/at public
launch.

---

## Permissions to request

Request these under **App Review → Permissions and Features**:

- [ ] `instagram_basic`
- [ ] `instagram_manage_comments`
- [ ] `instagram_manage_messages`
- [ ] `pages_show_list` (and/or `pages_read_engagement`, depending on token type)

For each, Meta asks **how** and **why** you use it, plus a screencast showing it
in action.

---

## What Meta wants to see (and how we satisfy it)

1. **A clear use case.** Provide the description below.
2. **A screencast** demonstrating the full flow from a real Instagram account.
3. **Compliance**: official APIs only, a privacy policy, and a way for users to
   understand what's happening.

### Use-case description (copy/paste, edit names as needed)

> Xyra runs an opt-in waitlist for an early-access ("alpha") product. On our
> Instagram posts and Reels we invite people to comment the keyword "ALPHA" to
> receive our waitlist link. When a user comments that keyword, our app uses the
> Instagram webhook (`comments` field) to detect it and sends that user a single
> private reply (DM) containing the waitlist link and instructions for our
> referral program. We use `instagram_manage_comments` to read the triggering
> comment, `instagram_manage_messages` to send the one-time private reply, and
> `instagram_basic` / `pages_show_list` to identify the connected Instagram
> professional account. We do not message users who have not commented, we send
> at most one reply per comment, and we honor Instagram's messaging policies.

### Screencast checklist (record this)

- [ ] Show your Instagram post with the "Comment ALPHA" call-to-action.
- [ ] From a second account, comment **ALPHA**.
- [ ] Show the private reply (DM) arriving with the waitlist link.
- [ ] (Optional) Show the admin/Supabase log recording the event once.
- [ ] Narrate which permission does what, matching the description above.

---

## Pre-submission checklist

- [ ] App **Privacy Policy URL** set in App settings → Basic (a public page
      describing what data you collect — IG username/comment — and why).
- [ ] App **Category** and contact email set.
- [ ] Business verification completed if Meta requests it.
- [ ] Webhook configured and verified (setup guide §8) and tested in dry-run
      (testing guide Test 3).
- [ ] Screencast recorded and uploaded.
- [ ] Use-case text filled in for each permission.
- [ ] Tester accounts removed from screencast narration claims (reviewers test
      as the public).

---

## After approval

1. Switch the app to **Live mode** (toggle at the top of the Meta dashboard).
2. Only then set `INSTAGRAM_DRY_RUN=false` in Vercel + redeploy (testing guide
   Test 5).
3. Monitor `instagram_comment_events` for `reply_status = 'failed'` rows the
   first day and check `reply_error` if any appear.

---

## Policy guardrails (keep us compliant)

- **Official APIs only.** No scraping, no browser automation, no unofficial
  endpoints, no passwords. (The implementation already enforces this.)
- **One reply per comment.** Dedupe guarantees we never message the same comment
  twice.
- **Keyword-triggered, opt-in.** We only DM people who chose to comment the
  keyword.
- **Easy off switch.** `INSTAGRAM_DRY_RUN=true` pauses all sending instantly.
- **No spam.** Don't reuse this to mass-message people who didn't comment.
