'use client';

import {
  LISTENING_KIND_COLOURS,
  LISTENING_LEAF_COUNT,
  LISTENING_STAGE_LABELS,
  listeningItemKey,
  listeningItemKind,
  type ListeningPayload,
} from '@little-ants/shared';
import { ctaClass } from '@little-ants/ui/storybook';
import { ACTIVITIES } from '../lib/player-plan';
import { PlayIcon } from './icons';

/** A session plan row: minutes from–to, what, how (Programme Guide, Part 3). */
type PlanRow = [from: number, to: number, title: string, how: string];

const PLAN_LEVEL_1: PlanRow[] = [
  [0, 1, 'Hello', 'Hello song, “sit like an ant”.'],
  [1, 3, 'Word cards · Listen & Say', '3–4 cards; animal or action sound first.'],
  [3, 6, 'Song · Sing & Move', 'Everyone stands and does the actions.'],
  [6, 8, 'Sound + rhyme', 'Gesture for the sound, then the rhyme.'],
  [8, 12, "Story · Let's Watch", 'Sit and enjoy; shout the repeated line.'],
  [12, 15, 'Move & Do', 'Listen and do – big moves.'],
  [15, 17, 'Book or Talk Scene', 'Point & Follow, or Find It!'],
  [17, 18, 'Goodbye + star', 'One word or sound each.'],
];

const PLAN_LEVEL_2_3: PlanRow[] = [
  [0, 2, 'Hello', 'Hello song, “sit like an ant”, ears listen.'],
  [2, 4, 'Look back (leaves 1–8)', 'One song from the last unit.'],
  [4, 6, 'Word cards · Listen & Say', 'Twice per card.'],
  [6, 10, 'Song · Sing & Move', 'Everyone stands and does the actions.'],
  [10, 13, 'Sound + rhyme', 'Echo the sound, then say the rhyme.'],
  [13, 19, "Story · Let's Watch", 'Join the repeated line.'],
  [19, 22, 'Book · Point & Follow', 'A finger in the air under each word.'],
  [22, 25, 'Move & Do · Stand Up & Do', 'Later a child leads.'],
  [25, 28, 'Second song or Talk Scene', 'Sing again, or find things.'],
  [28, 30, 'Goodbye + star', 'Each child says one thing they heard.'],
];

const ACTIVITY_LIST: { name: string; colour: string; how: string }[] = [
  {
    name: 'Listen & Say',
    colour: '#4F7F32',
    how: 'Word cards. The app says it – children say it – the app says it – children say it.',
  },
  {
    name: 'Sing & Move',
    colour: '#D2564B',
    how: 'Songs and chants. Everyone stands up, sings along and does the actions.',
  },
  {
    name: 'Say What You Hear',
    colour: '#9479B5',
    how: 'Echo the sound three times with its gesture; listen to the rhyme once, then say it.',
  },
  {
    name: "Let's Watch",
    colour: '#4F86B8',
    how: 'Stories. Sit like ants and enjoy; join the repeated line. Stand up again within 3–5 minutes.',
  },
  {
    name: 'Point & Follow',
    colour: '#6E9A45',
    how: 'Books. Point in the air under each word, left to right. Model it with the pointer first.',
  },
  {
    name: 'Stand Up & Do',
    colour: '#C9961E',
    how: 'Move & Do. Listen and do each command. From Lesson 21 a child gives the commands.',
  },
  {
    name: 'Find It!',
    colour: '#3E9A8F',
    how: 'Talk Scene. A different child comes to the screen and points each time.',
  },
  {
    name: 'Stop & Go',
    colour: '#B5543A',
    how: 'From Lesson 21: pause in the middle of a line; children carry on alone.',
  },
];

const DOS = [
  'Play one leaf per session, from start to end.',
  'Keep English only, with gestures and smiles.',
  'Get children standing at least twice per session.',
  'Praise listening: “Great listening!” “You said it!”',
  'Correct gently now and then, or note it for the class teacher.',
  'Keep it fun and light – enjoy and repeat.',
];

const DONTS = [
  'Jump between leaves or play a random list.',
  'Translate or explain in Vietnamese (only for safety or an upset child).',
  'Let children sit and watch for more than 3–4 min (Level 1) or 5 min (Levels 2–3).',
  'Ask many questions while a song or story is playing.',
  'Turn it into a lesson: no new words, no tests.',
  'Use Listening Time for Tiny Tracks or other paper work.',
];

/** Teacher tab (At school): today's leaf, the session plan for the level, the activities and the do's/don'ts. */
export function TeacherView({
  payload,
  lesson,
  onLesson,
  onPlay,
}: {
  payload: ListeningPayload;
  lesson: number;
  onLesson: (lesson: number) => void;
  onPlay: (leaf: number) => void;
}) {
  const leaf = payload.leaves.find((entry) => entry.number === lesson);
  const levelOne = payload.unit.level.number <= 1;
  const plan = levelOne ? PLAN_LEVEL_1 : PLAN_LEVEL_2_3;

  return (
    <div>
      <h1 className="font-display text-[34px] leading-tight font-extrabold text-ant-500">Teacher</h1>
      <p className="max-w-[70ch] text-bark-500">
        Listening Time runs <b>in class</b> after each lesson ({levelOne ? '15–20' : '25–30'} min, one leaf)
        and <b>at home</b> (at least 4 days a week). It gives every song, story and rhyme the repeats children
        need.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label htmlFor="lesson" className="font-bold">
          Today
        </label>
        <select
          id="lesson"
          value={lesson}
          onChange={(event) => onLesson(Number(event.target.value))}
          className="min-h-11 rounded-xl bg-cream-100 px-3 font-semibold"
        >
          {Array.from({ length: LISTENING_LEAF_COUNT }, (_, index) => index + 1).map((number) => (
            <option key={number} value={number}>
              Lesson {number} · Week {Math.ceil(number / 5)}
            </option>
          ))}
        </select>
        <button type="button" className={`${ctaClass} text-base!`} onClick={() => onPlay(lesson)}>
          <PlayIcon className="size-6" />
          Play leaf {lesson} on the big screen
        </button>
      </div>

      <div className="mt-4 grid gap-7 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-2xl font-extrabold">
            Leaf {lesson}
            {leaf
              ? ` · ${LISTENING_STAGE_LABELS[leaf.stage]} · about ${Math.round(leaf.minutes)} min of audio`
              : ''}
          </h2>
          <ol className="mt-2 flex flex-col">
            {leaf?.items.map((item, index) => {
              const kind = listeningItemKind(item);
              const activity = ACTIVITIES[kind];
              return (
                <li key={`${index}:${listeningItemKey(item)}`} className="border-b border-cream-200 py-2">
                  <b>{item.title}</b>
                  {activity ? (
                    <span
                      className="ml-2 inline-block rounded-full px-2 py-1 align-[2px] text-[11px] leading-none font-bold text-white"
                      style={{ background: LISTENING_KIND_COLOURS[kind] }}
                    >
                      {activity.act}
                    </span>
                  ) : null}
                  {activity ? <p className="text-sm text-bark-500">{activity.cue}</p> : null}
                </li>
              );
            })}
          </ol>

          <h2 className="mt-6 font-display text-2xl font-extrabold">
            Session plan · Level {payload.unit.level.number} · about {plan[plan.length - 1]![1]} minutes
          </h2>
          <ol className="mt-2 flex flex-col">
            {plan.map(([from, to, title, how]) => (
              <li
                key={title}
                className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2.5 border-b border-cream-200 py-2"
              >
                <span className="text-sm font-bold text-bark-500 tabular-nums">
                  {from}–{to}′
                </span>
                <div>
                  <b>{title}</b>
                  <p className="text-sm text-bark-500">{how}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="font-display text-2xl font-extrabold">The activities</h2>
          <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
            {ACTIVITY_LIST.map((activity) => (
              <div key={activity.name} className="rounded-2xl bg-cream-100 px-3 py-2.5 text-sm">
                <b
                  className="block font-display text-base leading-tight font-extrabold"
                  style={{ color: activity.colour }}
                >
                  {activity.name}
                </b>
                {activity.how}
              </div>
            ))}
          </div>
          <h2 className="mt-6 font-display text-2xl font-extrabold">Do</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {DOS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <h2 className="mt-6 font-display text-2xl font-extrabold">Don&apos;t</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {DONTS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
