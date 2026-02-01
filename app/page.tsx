import { EJScreenMap } from "@/components/EJScreenMap";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b bg-white px-6 py-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-800">
          EJSCREEN Explorer
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Environmental justice indicators by census tract
        </p>
      </header>
      <div className="flex-1 min-h-0">
        <EJScreenMap />
      </div>
    </main>
  );
}
