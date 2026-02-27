export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Privacy</p>
          <h1 className="text-2xl font-semibold">Privacy policy</h1>
        </div>
        <p className="text-sm text-[var(--muted)]">
          We do not store private information such as your real name. We only store your email
          address for authentication purposes.
        </p>
        <p className="text-sm text-[var(--muted)]">
          If you choose a username, your public posts will display it. If you leave it blank, we
          generate one for you. You can always post as anonymous using the privacy toggle.
        </p>
      </section>
    </main>
  );
}
