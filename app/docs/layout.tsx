import DocsSidebar from "@/components/DocsSidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-start gap-10">
        <DocsSidebar />
        <main className="min-w-0 flex-1 ml-56">
          {children}
        </main>
      </div>
    </div>
  );
}
