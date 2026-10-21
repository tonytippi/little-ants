---
phase: 6
title: "Teacher app"
status: done
priority: P1
effort: "3w"
dependencies: [3, 4]
---

# Phase 6: Teacher app

## Goal

A PWA that a teacher uses to prepare and run each lesson, either on a laptop connected to a TV/projector
or on a tablet, with offline support and Show & Share recording.

## Screens

1. **Today:** the teacher's classes and the next lesson for each (from class schedule and current unit).
2. **Prepare:** the lesson's prep list as a checklist, NEW items highlighted, prep time, and quick
   "practise" playback of new songs and chants.
3. **Lesson player:**
   - Step rail along the bottom (Hello Circle → … → Goodbye) with a timer per step.
   - The stage shows the step's material full screen: poster image, story or book pages with page turn
     (tap, swipe, arrow keys, clicker), word cards, Talk Scene.
   - Audio controls large and simple; lyrics/teacher text in a side panel that can be hidden for TV.
   - **Presenter mode** for laptop + TV: the projected window shows only the stage; the laptop window shows
     notes, timer and controls (two browser windows synced with `BroadcastChannel`).
   - **Tablet mode:** one screen, notes in a drawer.
4. **Observe:** class roster grid with the unit's can-do goals; tap to set Not yet / With help / On my own;
   used at checkpoints L12 and L26 and at Show & Share L39–40.
5. **After lesson:** teacher notes for the lesson (replaces the "Teacher notes" lines); program leads can
   read them in Admin.
6. **Print:** the same printable lesson plan view as Admin (phase 5, screen 10), so teachers can print a
   lesson or a week of lessons.

## Offline design

- Service worker (Serwist) precaches the app shell.
- "Download unit" stores the unit's lesson data in IndexedDB and its approved images and audio in the
  Cache Storage; it shows the download size and progress.
- Writes (observations, notes, lesson completed) go to an IndexedDB outbox and sync with retry when online.
  Each record has a client UUID, so the server ignores duplicates.
- iOS/iPadOS: ask teachers to "Add to Home Screen" so Safari does not clear stored data; request persistent
  storage with `navigator.storage.persist()`.
- Audio playback starts from a user tap to satisfy browser autoplay rules.

## Tasks and steps

1. Lesson data endpoint that returns one lesson (or a whole unit) with materials, pages and asset URLs.
2. Player components shared with the Admin preview (`packages/ui/lesson-renderer`).
3. Presenter mode and keyboard/clicker controls.
4. Offline download, outbox sync, and a visible online/offline indicator.
5. Observe and notes screens with API endpoints.
6. Playwright tests: run a lesson with the network offline; observation sync after reconnect; presenter
   window stays in sync.

## Verification

- On a laptop + TV and on an iPad, a teacher runs Unit 1 Lesson 1 from start to end.
- With Wi-Fi off after "Download unit", all 40 Unit 1 lessons open and play audio.
- Observations made offline appear in Admin after reconnecting, with no duplicates.

## Risks

- Large downloads on weak school Wi-Fi. Mitigation: compress images to WebP at display size, audio to
  AAC/MP3 ~96 kbps, and download per unit.
- Lesson time is 25–40 minutes; the UI must not slow the teacher down. Run a usability check with 2 teachers
  before the pilot.

## Screen time

- The app is a teacher tool shown to the class, not a device for each child. The player has no autoplay
  chains or videos that run on their own.
