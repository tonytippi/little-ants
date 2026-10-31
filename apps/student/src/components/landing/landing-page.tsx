'use client';

/* eslint-disable @next/next/no-img-element -- pictures are pre-sized WebP files in public/landing */
import Link from 'next/link';
import { ctaClass } from '@little-ants/ui/storybook';
import { TvIcon } from '../icons';
import { LANDING_COPY, SOCIAL_LINKS, type Lang } from './landing-copy';
import { LANG_KEY } from './landing-script';

const TONES = {
  leaf: 'bg-leaf-50 text-leaf-700',
  sun: 'bg-sun-100 text-bark-900',
  ant: 'bg-ant-50 text-ant-700',
} as const;

const LEARNING_PICTURES = ['/landing/move.webp', '/landing/story.webp', null] as const;

/** The public front page: what Little Ants is, Sign in for parents, and Watch on TV. */
export function LandingPage({ lang }: { lang: Lang }) {
  const copy = LANDING_COPY[lang];
  const socials = SOCIAL_LINKS.filter((link) => link.href);

  return (
    <div className="min-h-dvh overflow-x-hidden bg-cream-50 text-bark-900">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-5 pt-[max(14px,env(safe-area-inset-top))] pb-2">
        <img src="/logo.png" alt="Little Ants English" className="h-12 w-auto" width={70} height={48} />
        <LanguageSwitch lang={lang} />
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pt-6 text-center md:pt-10">
          <p className="text-sm font-bold tracking-wider text-leaf-700 uppercase">{copy.hero.eyebrow}</p>
          <h1 className="mt-2 font-display text-[clamp(40px,7vw,76px)] leading-[1.02] font-extrabold text-ant-500">
            {copy.hero.headline}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-bark-700">{copy.hero.sub}</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
            <Link href="/signin" className={`${ctaClass} min-h-14 min-w-44`}>
              {copy.hero.signIn}
            </Link>
            <a
              href="/tv"
              className="inline-flex min-h-14 min-w-44 items-center justify-center gap-2.5 rounded-full bg-white px-6 font-display text-xl font-bold text-bark-900 ring-2 ring-bark-900/15 hover:bg-cream-100"
            >
              <TvIcon className="size-6" />
              {copy.hero.tv}
            </a>
          </div>
          <img
            src="/landing/friends.webp"
            alt={copy.hero.picture}
            width={1600}
            height={533}
            fetchPriority="high"
            className="mx-auto mt-8 w-full max-w-5xl mix-blend-multiply [mask-image:radial-gradient(ellipse_at_center,#000_62%,transparent_92%)]"
          />
        </section>

        <section className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="text-center font-display text-4xl font-extrabold text-leaf-700">
            {copy.levels.heading}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-bark-700">{copy.levels.intro}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {copy.levels.items.map((level) => (
              <article key={level.name} className={`rounded-3xl p-6 ${TONES[level.tone]}`}>
                <h3 className="font-display text-2xl font-extrabold">{level.name}</h3>
                <p className="text-sm font-bold opacity-80">{level.age}</p>
                <p className="mt-3 text-bark-900">{level.skills}</p>
                <p className="mt-2 text-sm text-bark-700">
                  <b>{copy.levels.themesLabel}:</b> {level.themes}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-cream-100 py-14">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="text-center font-display text-4xl font-extrabold text-leaf-700">
              {copy.learning.heading}
            </h2>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {copy.learning.items.map((item, index) => {
                const picture = LEARNING_PICTURES[index];
                return (
                  <article key={item.title} className="flex flex-col items-center text-center">
                    <div className="relative grid aspect-[4/3] w-full place-items-center">
                      {picture ? (
                        <img
                          src={picture}
                          alt=""
                          loading="lazy"
                          className="fade-soft absolute inset-0 size-full object-contain"
                          width={720}
                          height={540}
                        />
                      ) : (
                        <span
                          aria-hidden
                          className="font-display text-[110px] leading-none font-extrabold text-ant-500"
                        >
                          Aa
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 font-display text-2xl font-extrabold">{item.title}</h3>
                    <p className="mt-1 max-w-xs text-bark-700">{item.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-14 md:grid-cols-[1fr_minmax(0,0.8fr)]">
          <div>
            <h2 className="font-display text-4xl font-extrabold text-leaf-700">{copy.listening.heading}</h2>
            <p className="mt-3 text-lg leading-relaxed text-bark-700">{copy.listening.text}</p>
            <ul className="mt-5 flex flex-col gap-3">
              {copy.listening.points.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span aria-hidden className="leaf-dot mt-1.5 block size-4 shrink-0 bg-leaf-500" />
                  <span className="font-semibold">{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <img
            src="/landing/listen.webp"
            alt={copy.listening.picture}
            loading="lazy"
            width={720}
            height={960}
            className="fade-soft mx-auto w-full max-w-sm"
          />
        </section>

        <section className="bg-leaf-50 py-14">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 md:grid-cols-2">
            <img
              src="/landing/garden.webp"
              alt=""
              loading="lazy"
              width={960}
              height={540}
              className="fade-soft w-full"
            />
            <div>
              <h2 className="font-display text-4xl font-extrabold text-leaf-700">{copy.start.heading}</h2>
              <ol className="mt-5 flex flex-col gap-4">
                {copy.start.steps.map((step, index) => (
                  <li key={step} className="flex items-start gap-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-leaf-600 font-display text-xl font-extrabold text-white">
                      {index + 1}
                    </span>
                    <span className="pt-1.5 text-lg">{step}</span>
                  </li>
                ))}
              </ol>
              <Link href="/signin" className={`${ctaClass} mt-7 min-h-14 min-w-44`}>
                {copy.start.signIn}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-8 pb-[max(32px,env(safe-area-inset-bottom))] text-sm text-bark-500">
        <span>© {new Date().getFullYear()} Little Ants English</span>
        {socials.length > 0 ? (
          <span className="flex items-center gap-3">
            {copy.footer.follow}:
            {socials.map((link) => (
              <a key={link.name} href={link.href} className="font-semibold text-leaf-700 underline">
                {link.name}
              </a>
            ))}
          </span>
        ) : null}
        <span className="ml-auto">
          <LanguageSwitch lang={lang} />
        </span>
      </footer>
    </div>
  );
}

function LanguageSwitch({ lang }: { lang: Lang }) {
  const option = (value: Lang, label: string, href: string) => (
    <a
      href={href}
      hrefLang={value}
      lang={value}
      aria-current={lang === value ? 'page' : undefined}
      onClick={() => {
        try {
          localStorage.setItem(LANG_KEY, value);
        } catch {
          /* private mode */
        }
      }}
      className={`grid min-h-9 min-w-11 place-items-center rounded-full px-3 text-sm font-bold ${lang === value ? 'bg-leaf-600 text-white' : 'text-bark-500 hover:bg-cream-100'}`}
    >
      {label}
    </a>
  );
  return (
    <nav aria-label="Language" className="ml-auto flex gap-1 rounded-full bg-cream-100 p-1">
      {option('vi', 'VI', '/')}
      {option('en', 'EN', '/en')}
    </nav>
  );
}
