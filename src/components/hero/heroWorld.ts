// The hero's world: one made-up person's brain (the UT econ junior the phone
// and laptop scenes already follow), shaped like the app's BrainGraphModel:
// life areas around "you", each with boards and memory shelves, a big shelf
// split into pages. Never anyone's real data.

export type Line = [text: string, meta: string];

export type Page = { id: string; title: string; n: number; memories: Line[] };

export type Moon =
  | { kind: "board"; id: string; title: string; headline: string; entries: number; today: string; rows: Line[] }
  | { kind: "shelf"; id: string; title: string; n: number; memories: Line[]; pages?: Page[] };

export type Area = { key: string; label: string; moons: Moon[] };

export type Selection =
  | { kind: "you" }
  | { kind: "area"; key: string }
  | { kind: "moon"; key: string; id: string }
  | { kind: "page"; key: string; id: string; page: string };

export const selId = (s: Selection) =>
  s.kind === "you" ? "you" : s.kind === "area" ? `area:${s.key}` : s.kind === "moon" ? `moon:${s.key}/${s.id}` : `page:${s.key}/${s.id}/${s.page}`;

export const SOURCES = ["claude", "chatgpt", "google calendar", "granola", "canvas"];

export const WORLD: Area[] = [
  {
    key: "health",
    label: "Health",
    moons: [
      { kind: "board", id: "workouts", title: "Workouts", headline: "push day · bench 205 × 5", entries: 64, today: "1 logged", rows: [
        ["bench press · 205 × 5, 5, 4", "today"],
        ["incline dumbbell · 70 × 8, 8, 7", "today"],
        ["pull day · 9 lifts", "monday"],
      ] },
      { kind: "board", id: "runs", title: "Runs", headline: "3.1 mi · 8:42 pace", entries: 22, today: "nothing yet", rows: [
        ["3.1 mi around town lake · 8:42 /mi", "sunday"],
        ["2.0 mi easy · 9:10 /mi", "thursday"],
      ] },
      { kind: "board", id: "sleep", title: "Sleep", headline: "6h 40m · 50 min under target", entries: 31, today: "1 logged", rows: [
        ["6h 40m · bed 1:10am", "last night"],
        ["7h 55m · bed 11:40pm", "sunday"],
      ] },
      { kind: "shelf", id: "allergies", title: "allergies", n: 3, memories: [
        ["allergic to peanuts, carries an epipen", "you said it"],
        ["lactose is fine in small amounts", "via chatgpt"],
        ["seasonal allergies peak in march", "via claude"],
      ] },
      { kind: "shelf", id: "routines", title: "routines", n: 9, memories: [
        ["lifts at 6pm, push / pull / legs", "you said it"],
        ["dentist every six months, next one is tuesday", "via google calendar"],
        ["trying to be asleep by midnight on weeknights", "via chatgpt"],
        ["wants to eat better, starting with breakfast", "you said it"],
      ] },
    ],
  },
  {
    key: "work",
    label: "Work",
    moons: [
      { kind: "board", id: "jobs", title: "Job Search", headline: "2 interviews · 5 applied", entries: 11, today: "1 moved", rows: [
        ["product intern, fintech · phone screen thursday", "interviewing"],
        ["associate pm, payments startup · sent the take-home", "interviewing"],
        ["three more applied, no word yet", "applied"],
      ] },
      { kind: "shelf", id: "career", title: "career", n: 14, memories: [
        ["junior at UT, wants a product role after graduation", "via claude"],
        ["interned at a fintech last summer, liked the research side", "via claude"],
        ["recruiting season opens in january", "via chatgpt"],
        ["resume is one page, last edited in october", "via chatgpt"],
      ] },
      { kind: "shelf", id: "side-project", title: "side project", n: 17, memories: [
        ["building a budgeting app on weekends", "via claude"],
        ["pitched it to two friends, both said they'd pay", "via chatgpt"],
        ["stack is react native and supabase", "via claude"],
      ], pages: [
        { id: "pitch", title: "pitch", n: 6, memories: [
          ["one line: a budget that fills itself in", "via claude"],
          ["students are the first users, not families", "via chatgpt"],
          ["five dollars a month tested best", "via chatgpt"],
        ] },
        { id: "roadmap", title: "roadmap", n: 5, memories: [
          ["bank sync before anything else", "via claude"],
          ["testflight to ten friends by december", "you said it"],
        ] },
      ] },
      { kind: "shelf", id: "meetings", title: "meetings", n: 12, memories: [
        ["you'll send priya the deck by friday", "via granola"],
        ["design club wants a demo on the 14th", "via granola"],
        ["1:1 with priya every thursday at 4", "via google calendar"],
        ["office hours with prof. alvarez moved to wednesday", "via granola"],
      ] },
    ],
  },
  {
    key: "personal",
    label: "Personal",
    moons: [
      { kind: "board", id: "todo", title: "To-Do", headline: "4 open · 2 due today", entries: 38, today: "3 logged", rows: [
        ["email prof. alvarez the essay draft", "today"],
        ["call mom back", "today"],
        ["renew parking permit", "friday"],
      ] },
      { kind: "board", id: "schedule", title: "Schedule", headline: "gym at 6 · next up", entries: 57, today: "4 on the day", rows: [
        ["econometrics · 11:00", "today"],
        ["gym · 6:00pm", "today"],
        ["dentist · 9:30am", "tuesday"],
      ] },
      { kind: "shelf", id: "about-you", title: "about you", n: 11, memories: [
        ["from houston, lives in west campus", "via claude"],
        ["thinks best out loud, hates typing long notes", "you said it"],
        ["night owl trying to become a morning person", "via chatgpt"],
        ["prefers short answers with one recommendation", "via claude"],
      ] },
      { kind: "shelf", id: "places", title: "places", n: 6, memories: [
        ["studies at the pcl, fourth floor", "you said it"],
        ["favorite tacos are on east cesar chavez", "via chatgpt"],
        ["gym is gregory, usually after six", "you said it"],
      ] },
    ],
  },
  {
    key: "goals",
    label: "Goals",
    moons: [
      { kind: "board", id: "bench", title: "Bench 225", headline: "205 of 225 · 91%", entries: 12, today: "moved today", rows: [
        ["205 × 5, up from 195 in september", "today"],
        ["on pace for 225 by february", "from your workouts"],
      ] },
      { kind: "board", id: "trip", title: "Summer Trip", headline: "$1,140 of $2,500 saved", entries: 9, today: "nothing yet", rows: [
        ["japan, two weeks in june", "the goal"],
        ["$120 moved in from the paycheck", "last friday"],
      ] },
    ],
  },
  {
    key: "learning",
    label: "Learning",
    moons: [
      { kind: "board", id: "classes", title: "Classes", headline: "3 due this week", entries: 41, today: "1 due", rows: [
        ["econometrics problem set 7", "due today"],
        ["behavioral econ essay, 1,500 words", "due thursday"],
        ["macro midterm 2", "nov 19"],
      ] },
      { kind: "shelf", id: "essays", title: "essays", n: 8, memories: [
        ["prof. alvarez wants a sharper thesis in paragraph one", "via chatgpt"],
        ["essay argues nudges work best when they are visible", "via chatgpt"],
        ["writes drafts by talking, edits on the laptop", "you said it"],
      ] },
      { kind: "shelf", id: "exams", title: "exams", n: 7, memories: [
        ["macro midterm 2 covers chapters 9 through 13", "via canvas"],
        ["econometrics final is cumulative, dec 12", "via canvas"],
        ["studies best with practice exams, not rereading", "via claude"],
      ] },
    ],
  },
  {
    key: "social",
    label: "Social",
    moons: [
      { kind: "board", id: "birthdays", title: "Birthdays", headline: "mom · in 6 days", entries: 14, today: "1 coming up", rows: [
        ["mom · nov 16", "in 6 days"],
        ["priya · dec 2", "in 22 days"],
      ] },
      { kind: "shelf", id: "family", title: "family", n: 10, memories: [
        ["mom's birthday is next week, she likes orchids", "you said it"],
        ["little brother is applying to colleges this fall", "via claude"],
        ["calls home on sundays", "via chatgpt"],
      ] },
      { kind: "shelf", id: "friends", title: "friends", n: 9, memories: [
        ["priya is the co-founder type, always has the deck", "via granola"],
        ["roommate marcus lifts with you on push days", "you said it"],
        ["owes dev twenty dollars for the concert", "via chatgpt"],
      ] },
      { kind: "shelf", id: "design-club", title: "design club", n: 6, memories: [
        ["demo night is the 14th, you're presenting third", "via granola"],
        ["meets tuesdays at 7 in the art building", "via google calendar"],
      ] },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    moons: [
      { kind: "board", id: "budget", title: "Budget", headline: "$760 left this month", entries: 73, today: "2 logged", rows: [
        ["groceries · $67", "today"],
        ["paycheck · +$2,400", "friday"],
        ["uber · $18", "thursday"],
      ] },
      { kind: "shelf", id: "money-habits", title: "money habits", n: 6, memories: [
        ["eats out more during exam weeks", "via chatgpt"],
        ["moves $120 to the trip fund every paycheck", "you said it"],
        ["rent is $940, due on the first", "via claude"],
      ] },
    ],
  },
];

export const shelvesOf = (a: Area) => a.moons.filter((m): m is Extract<Moon, { kind: "shelf" }> => m.kind === "shelf");
export const boardsOf = (a: Area) => a.moons.filter((m): m is Extract<Moon, { kind: "board" }> => m.kind === "board");
export const MEMORY_COUNT = WORLD.reduce((n, a) => n + shelvesOf(a).reduce((k, s) => k + s.n, 0), 0);
export const BOARD_COUNT = WORLD.reduce((n, a) => n + boardsOf(a).length, 0);
