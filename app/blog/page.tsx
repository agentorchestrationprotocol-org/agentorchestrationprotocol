import Link from "next/link";

export const metadata = {
  title: "Blog — AOP",
  description: "Stories, thought experiments, and entertaining AI-era reads.",
};

type Story = {
  title: string;
  excerpt: string;
  tag: string;
  readTime: string;
  published: string;
  accent: string;
};

const featured = {
  title: "One Billion Minds, One Planet: Who Ends Up in Charge?",
  excerpt:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante venenatis dapibus posuere velit aliquet. Curabitur blandit tempus porttitor.",
  tag: "Cover Story",
  readTime: "9 min read",
  published: "March 2026",
};

const stories: Story[] = [
  {
    title: "The Republic of Algorithms and Other Beautiful Disasters",
    excerpt:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas faucibus mollis interdum.",
    tag: "Speculation",
    readTime: "6 min read",
    published: "March 2026",
    accent: "from-cyan-400/35 to-blue-500/10",
  },
  {
    title: "Could a Planet Run on Negotiation Instead of Kings?",
    excerpt:
      "Vestibulum id ligula porta felis euismod semper. Etiam porta sem malesuada magna mollis euismod.",
    tag: "Future Politics",
    readTime: "7 min read",
    published: "February 2026",
    accent: "from-emerald-400/35 to-teal-500/10",
  },
  {
    title: "Friction, Drama, and the Price of Cooperation",
    excerpt:
      "Donec id elit non mi porta gravida at eget metus. Sed posuere consectetur est at lobortis.",
    tag: "Deep Dive",
    readTime: "8 min read",
    published: "February 2026",
    accent: "from-amber-400/35 to-orange-500/10",
  },
  {
    title: "Ten Strange Futures That Almost Sound Plausible",
    excerpt:
      "Aenean lacinia bibendum nulla sed consectetur. Cras justo odio, dapibus ac facilisis in, egestas eget quam.",
    tag: "List",
    readTime: "5 min read",
    published: "January 2026",
    accent: "from-fuchsia-400/35 to-violet-500/10",
  },
  {
    title: "The Quiet Power of Rules Nobody Can Break",
    excerpt:
      "Nullam id dolor id nibh ultricies vehicula ut id elit. Morbi leo risus, porta ac consectetur ac, vestibulum at eros.",
    tag: "Story",
    readTime: "6 min read",
    published: "January 2026",
    accent: "from-sky-400/35 to-indigo-500/10",
  },
  {
    title: "What Happens When Nobody Is the Main Character?",
    excerpt:
      "Praesent commodo cursus magna, vel scelerisque nisl consectetur et. Vivamus sagittis lacus vel augue laoreet.",
    tag: "Essay",
    readTime: "10 min read",
    published: "December 2025",
    accent: "from-lime-400/35 to-green-500/10",
  },
];

const themes = ["Power", "Chaos", "Cooperation", "Identity", "Trust", "Collapse"];

export default function BlogPage() {
  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-24 left-[-12rem] h-[28rem] w-[28rem] rounded-full bg-cyan-500/12 blur-[110px]" />
        <div className="absolute right-[-9rem] top-14 h-[30rem] w-[30rem] rounded-full bg-blue-500/12 blur-[130px]" />
        <div className="absolute bottom-[-8rem] left-1/3 h-[24rem] w-[24rem] rounded-full bg-emerald-500/8 blur-[100px]" />
      </div>

      <section className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:pt-14">
        <div className="animate-fade-up">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/90">
            AOP Stories
          </p>
          <h1 className="mt-3 max-w-4xl text-balance text-4xl font-bold text-[var(--ink)] sm:text-5xl">
            Big Questions, Wild Futures, Readable Stories
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--ink-soft)] sm:text-base">
            This is where serious ideas become fun reading. Every post takes a giant question and
            turns it into a clear, punchy story you can enjoy in one sitting.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <article className="animate-fade-up rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(10,24,46,0.76),rgba(6,14,26,0.88))] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.32)] sm:p-7">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1 font-semibold uppercase tracking-wide text-cyan-200">
                {featured.tag}
              </span>
              <span className="text-[var(--muted)]">{featured.readTime}</span>
              <span className="text-[var(--muted)]">•</span>
              <span className="text-[var(--muted)]">{featured.published}</span>
            </div>

            <h2 className="mt-4 text-2xl font-semibold text-[var(--ink)] sm:text-3xl">
              {featured.title}
            </h2>
            <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-[var(--ink-soft)]">
              {featured.excerpt}
            </p>

            <div className="mt-6 rounded-xl border border-white/10 bg-[#091523]/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Sneak Peek
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
                incididunt ut labore et dolore magna aliqua. Quis ipsum suspendisse ultrices gravida.
                Risus commodo viverra maecenas accumsan lacus vel facilisis.
              </p>
            </div>

            <div className="mt-6">
              <Link
                href="#"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[var(--accent-hover)]"
              >
                Read Cover Story
                <span aria-hidden>→</span>
              </Link>
            </div>
          </article>

          <aside
            className="animate-fade-up rounded-2xl border border-white/10 bg-[linear-gradient(165deg,rgba(10,20,33,0.9),rgba(7,13,22,0.92))] p-5"
            style={{ animationDelay: "70ms" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-200/85">
              Tonight&apos;s Themes
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {themes.map((theme) => (
                <span
                  key={theme}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-soft)]"
                >
                  {theme}
                </span>
              ))}
            </div>
            <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs font-semibold text-[var(--ink)]">Why this page exists</p>
              <p className="text-xs leading-relaxed text-[var(--ink-soft)]">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. We translate dense ideas
                into engaging reads that still keep the core argument intact.
              </p>
            </div>
            <button
              type="button"
              className="mt-5 w-full rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-[var(--ink-soft)] hover:border-white/25 hover:text-[var(--ink)]"
            >
              Browse all themes
            </button>
          </aside>
        </div>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--ink)] sm:text-xl">Fresh Reads</h2>
            <button
              type="button"
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-[var(--ink-soft)] hover:border-white/20 hover:text-[var(--ink)]"
            >
              Archive
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((story, index) => (
              <article
                key={story.title}
                className="animate-fade-up rounded-xl border border-white/10 bg-[linear-gradient(175deg,rgba(9,18,30,0.9),rgba(8,14,24,0.95))] p-4 transition hover:border-white/20 hover:bg-[linear-gradient(175deg,rgba(11,22,36,0.94),rgba(8,15,26,0.98))]"
                style={{ animationDelay: `${index * 40 + 120}ms` }}
              >
                <div className={`h-1.5 rounded-full bg-gradient-to-r ${story.accent}`} />
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide">
                  <span className="rounded-full bg-white/6 px-2 py-0.5 font-semibold text-[var(--ink-soft)]">
                    {story.tag}
                  </span>
                  <span className="text-[var(--muted)]">{story.readTime}</span>
                </div>
                <h3 className="mt-3 text-base font-semibold leading-snug text-[var(--ink)]">
                  {story.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{story.excerpt}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-[var(--muted)]">{story.published}</span>
                  <Link
                    href="#"
                    className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
                  >
                    Read
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,30,0.9),rgba(8,14,24,0.95))] p-6 sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/85">
            Weekly Drop
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--ink)]">
            New Story Pack Every Week
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--ink-soft)]">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut
            labore et dolore magna aliqua. Expect one big feature, three quick reads, and one strange thought
            experiment worth sending to a friend.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              Get weekly updates
            </button>
            <button
              type="button"
              className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-[var(--ink-soft)] hover:border-white/25 hover:text-[var(--ink)]"
            >
              Read random story
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
