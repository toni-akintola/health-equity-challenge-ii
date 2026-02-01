import { EJScreenMap } from "@/src/components/EJScreenMap";

export default function Home() {
  return (
    <main className="h-screen flex flex-col overflow-hidden">
      <header className="border-b bg-white px-6 py-4 shadow-sm shrink-0">
        <h1 className="text-2xl font-semibold text-slate-800">
          EJSCREEN Explorer
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Environmental justice indicators by census tract
        </p>
      </header>
      <div className="flex-1 min-h-0 overflow-visible">
        <EJScreenMap />
      </div>
    </main>
  );
}
