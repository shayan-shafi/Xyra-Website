// The privacy policy behind xyra.dev/privacy. Every claim here was checked
// against the app's code and the live database on 2026-10-17 (the Granola
// section against granola-sync on 2026-10-22, AI apps against api/mcp and
// settings → agents on 2026-10-23, Wispr Flow against wispr-sync /
// wisprText.ts on 2026-10-23) — change the code and this
// together. Google's OAuth review reads §3 and §4 line by line.

export const PRIVACY_UPDATED = "23 October 2026";

export const PRIVACY_MD = `
## The short version

Xyra is a personal tracking app. You talk to it, and it organises your life into boards. To do that well it has to remember things about you, so this policy explains exactly what it remembers, where that lives, and who else ever sees it.

- **Your data is yours.** We do not sell it, rent it, or share it with data brokers.
- **No ads, ever.** There is no advertising business here, so there is no reason to profile you for anyone else.
- **Photos you attach to boards stay on your device.** We store the file's location on your phone, not the picture.
- **Location is only used when you ask for it:** while you are recording a run, or once when you pin where you are on a Locations board. Never passively.
- **We use no third party analytics in the app.** No Google Analytics, no Facebook SDK, no Mixpanel, no Segment. Our usage analytics are first party and cannot contain your content.

---

## 1. Who we are

Xyra is operated by **Xyra AI, Inc.** ("Xyra", "we", "us").

For any privacy question, or to exercise any right described here, email **[privacy@xyra.dev](mailto:privacy@xyra.dev)**.

---

## 2. What we collect

### Account information
When you create an account we collect your **email address**, **name**, **age**, **occupation**, and **gender** (which you can decline). We also store your **time zone**, so Xyra does not message you at 3am.

### What you tell Xyra
- **Your messages.** Every message you send Xyra, typed or spoken, is stored.
- **Voice.** When you speak, the audio is sent to a transcription provider (see §5). We do not keep the audio. We do keep the transcript.
- **Your boards and everything in them.** Titles, entries, notes, numbers, dates, and tags.
- **A rolling summary of your conversations**, so Xyra does not lose the thread.

### What Xyra learns about you
Xyra keeps short written memories about you (for example "prefers morning workouts" or "sister is named Ana"), the message each one came from, and where it is filed in your Brain. You can see, edit, move, and delete every memory in the app.

### Connected services
See §3.

### Device and notification data
If you turn on notifications we store a **push token** and your notification preferences.

### Payments
If you subscribe, payment is handled by Stripe. Your card details go to Stripe directly and never reach us. We keep your subscription status and Stripe's customer reference.

### Feedback
If you send feedback we store your message, the board you were on, your app version, and device details, plus any screenshot you attach. Screenshots are stored at a long, unguessable link, and they are not removed automatically when you delete your account. Email us and we will delete them.

### Usage analytics
We record a small, fixed set of product events (for example "a board was created"). This is restricted in our database to a list of allowed event names and simple values. **Your board titles, entries, messages, Xyra's replies, and your email address cannot enter our analytics.**

### Our website
xyra.dev uses first party analytics (pages viewed, where you came from). You can opt out at any time with "privacy settings" in the site footer.

---

## 3. Connected services

Today you can connect **Google Calendar**, **Granola**, **Wispr Flow**, and **Apple Health**. If we add others, we will update this section before they go live.

### Google Calendar

**What we ask Google for:** permission to see, create, change, and delete events on calendars you own (\`calendar.events.owned\`), plus your Google email address so you can see which account is connected (\`userinfo.email\`). Xyra only ever uses your primary calendar.

**What we read, and why:**
- **To show your Google events inside Xyra's calendar**, we fetch each event's title, start and end time, location, and description for the dates you are looking at. These are shown to you and are **not saved** on our servers.
- **To learn about your routine**, Xyra reads only **event titles and start dates**: up to a year back and three months ahead when you first connect, and about a month either side of today after that. Never descriptions, attendees, or locations. These titles are sent to OpenAI (see §5) to write up to fifteen short memories, such as "boxing most Saturdays". Those memories are saved to your Brain, where you can see, edit, or delete them. The titles themselves are not saved.

**What we write:** when you add, move, or delete an event on a Xyra Schedule board, Xyra makes the same change on your Google Calendar. When you first connect, your upcoming Xyra events are copied to Google once. Xyra only changes or deletes events that Xyra itself created. To keep the two in step, we save the Google event ID next to the Xyra item.

**What we store:** your Google access is stored encrypted (see §9), along with the event IDs and the memories described above. Nothing else from your calendar is saved.

### Granola

**How you connect:** you sign in to Granola through Granola's own connection for apps. Xyra asks for read access to your notes and for your Granola email address, so you can see which account is connected. Xyra never adds, changes, or deletes anything in Granola.

**What we read, and why:** Xyra reads the list of your meetings (title, date, and who was there), and for each new meeting, Granola's summary and the notes you took. It reads the last 30 days when you first connect, then checks for new meetings about every 30 minutes. **Xyra never reads your transcripts.** The summaries and notes are sent to OpenAI (see §5) to write:
- one short, dated line per meeting, saved to a Meetings shelf in your Brain;
- up to three memories about you from each meeting, such as who someone is or what you are working on;
- the things you said you would do, from meetings in the last three days, added to your To-Do list.

All of these can be seen, edited, or deleted in the app. The summaries and notes themselves are not saved.

**What we store:** your Granola access is stored encrypted (see §9), along with which meetings Xyra has already read (so it never reads one twice), and on each to-do it adds, the meeting it came from. Nothing else from Granola is saved.

### Wispr Flow

**How you connect:** you sign in to Wispr Flow through Wispr's own connection for apps. Xyra asks for read access to your Notetaker meetings and for your Wispr email address, so you can see which account is connected. Xyra never adds, changes, or deletes anything in Wispr Flow, and never reads your dictation history.

**What we read, and why:** Xyra reads the list of your Notetaker meetings (title and date), and for each new meeting, its summary, your notes, its action items, and who was there. It reads the last 30 days when you first connect, then checks for new meetings about every 30 minutes. Wispr may send a meeting's transcript along with its notes; **Xyra throws the transcript away as soon as it arrives. It is never saved and never sent to OpenAI.** The summaries and notes are sent to OpenAI (see §5) to write the same three things as for Granola: one dated line per meeting on your Meetings shelf, up to three memories about you from each meeting, and the things you said you would do, from meetings in the last three days, on your To-Do list. If Granola and Wispr Flow both recorded the same meeting, Xyra tries to write it up only once.

All of these can be seen, edited, or deleted in the app. The summaries and notes themselves are not saved.

**What we store:** your Wispr Flow access is stored encrypted (see §9), along with which meetings Xyra has already read, and on each to-do it adds, the meeting it came from. Nothing else from Wispr Flow is saved.

### AI apps you connect

You can let an AI app you already use, such as **Claude**, **ChatGPT**, **Gemini**, or Meta's **Muse**, or a coding agent like Claude Code, read your Brain. You start this yourself, from Settings → agents, and approve it on a Xyra sign-in page.

**What it can see:** your memories and your boards, the same things you see in the Brain. **Passwords boards are never shown.** It can add or change anything only if you allowed writing when you connected it, and every change it makes is listed in Settings → agents with an undo.

**Where your data goes:** what the app reads leaves Xyra and is handled under **that company's** terms and privacy policy, not ours. Check them before you connect. In particular, **Meta says it uses what Muse reads through a connector to improve AI at Meta.**

**What we store:** the app's name, when it was last used, and the log of changes it made. Tokens for coding agents are stored only as a one way hash. Disconnect any app in Settings → agents, and it can no longer read anything.

### Disconnecting
Disconnecting deletes your stored access, so Xyra can no longer read your calendar, your Granola notes, or your Wispr Flow meetings. Disconnecting Apple Health stops your iPhone from reading Health; to also withdraw the permission, turn Xyra off in the Health app. Memories, meeting lines, to-dos, daily health summaries, and nights Xyra already wrote stay until you delete them. To also withdraw the permission on Google's side, remove Xyra at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

### Apple Health

**How you connect:** on your iPhone, from Settings → connectors or the Health board. iOS asks which kinds of Health data Xyra may read, and you can change that at any time in the Health app. **Xyra only reads; it never writes to Apple Health.**

**What we read, and why:** steps, active energy, exercise minutes, resting heart rate, heart rate variability, sleep, weight, workouts (type, length, energy, and distance), mindful minutes, and food totals (calories, protein, carbs, and fat), including what your watch, ring, or food app saves to Health. Your iPhone reads them, the last 30 days when you first connect and new data after that, and adds them up into one summary per day.

**What we store:** those daily summaries, including a short summary of each workout, so your Health board works. If you have a Sleep board, Xyra also adds each night there, but never over a night you logged yourself. Those nights are board content like any other (see §5). The daily summaries are shown only to you: they are not sent to AI providers, not used for advertising, and never sold or shared for marketing. Xyra does not store your individual heart rate readings or other raw Health samples.

---

## 4. Google user data and Limited Use

Xyra's use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

In plain terms, data we get from Google:
- is used only to provide the features described in §3, which you can see in the app;
- is shared only with the service providers in §5 that are needed to run those features, to comply with the law, or as part of a merger or acquisition;
- is never used for advertising;
- is never sold;
- is never used to train AI or machine learning models, by us or by anyone we share it with;
- is never read by a person, unless you ask us to (for example in a support request), it is needed for security or to investigate abuse, or the law requires it.

---

## 5. Who processes your data

Xyra is an AI product, so your information is processed by service providers acting on our behalf. Each receives only what it needs to do its job.

| Provider | What it receives | Why |
|---|---|---|
| **Supabase** | Everything in §2 | Our database, sign-in, and servers |
| **OpenAI** | Your messages, board contents, your memories, calendar titles, and Granola and Wispr Flow meeting summaries and notes (§3) | Understanding what you say, and writing memories |
| **Anthropic** | Your messages and the same context | Writing Xyra's replies |
| **Groq** | Your voice audio | Speech to text |
| **Expo** | Your push token and notification text | Delivering notifications |
| **Resend** | Your email address and name | Sign-in and account emails |
| **Stripe** | Your payment details | Subscriptions |
| **Vercel** | Requests to our website and web app | Hosting |
| **Google** | Your Google access token | Reading and updating your calendar (§3) |
| **Granola** | Your Granola access token | Reading your meeting notes (§3) |
| **Wispr Flow** | Your Wispr Flow access token | Reading your Notetaker meetings (§3) |

We use OpenAI and Anthropic through their business APIs, under terms that do not allow them to train their models on our data.

We may also disclose information if the law requires it, or to protect the safety of our users.

---

## 6. Sensitive information

**Location.** Xyra uses precise location only when you ask: continuously while you are recording a run you started (including with the screen locked), or once when you tap to pin where you are on a Locations board. The route or pin is saved with that entry so your map and distance work.

**Health.** Health information in Xyra is what you typed or said, plus, if you connect it, the Apple Health summaries described in §3. What you typed or said is treated like any other board content, including being processed by the providers in §5. Apple Health summaries are not sent to AI providers, except nights Xyra adds to your Sleep board.

**Money.** Amounts you enter are stored like any other entry. Receipt photos are sent to OpenAI to read the total and are not kept.

**Face ID.** Used only to unlock the app on your phone. Apple never shares your face data with us.

**Photos.** Photos you attach to a board stay on your device. The exceptions are receipt photos (read, then discarded) and feedback screenshots (§2).

---

## 7. How long we keep things

We keep your information for as long as your account exists. Memories you correct are kept as replaced and hidden from Xyra, not deleted, unless you delete them.

**Deleting your account** from Settings in the app removes your boards, conversations, memories, connection tokens, and reminders. You do not need to email anyone. Feedback screenshots are the exception (§2): email us and we will remove them.

---

## 8. Your choices and rights

- **See and edit what Xyra knows**, in the Brain.
- **Disconnect Google Calendar, Granola, Wispr Flow, Apple Health, or any AI app** at any time.
- **Turn off notifications**, set quiet hours, or pause check-ins.
- **Delete your account** from Settings.
- **Get a copy of your data** by emailing privacy@xyra.dev.

**California residents.** You have the right to know what personal information we collect and how we use it (this policy), to get a copy of it, to correct it, and to delete it. We do not sell or share personal information as those terms are defined in California law, so there is nothing to opt out of. We will not treat you differently for using these rights. Email privacy@xyra.dev; we may need to confirm it is you before we act.

Xyra is currently offered in the United States.

---

## 9. Security

Connection tokens are encrypted (AES-GCM) before they are stored, and short-lived access tokens are never saved. Access to data is enforced per user inside the database, so one account cannot read another's. Tokens are never written to logs.

No system is perfectly secure. If something happens that affects your data, we will tell you.

---

## 10. Children

Xyra is not for anyone under 13, and you must confirm you are 13 or older to create an account. If we learn we hold data from a child under 13, we delete it.

---

## 11. Changes

If we change this policy in a way that matters to you, we will tell you in the app, not just update this page.

---

## 12. Contact

Xyra AI, Inc. · [privacy@xyra.dev](mailto:privacy@xyra.dev)
`;
