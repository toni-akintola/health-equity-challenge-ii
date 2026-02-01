import Link from "next/link";
import { notFound } from "next/navigation";
import { getTractById, type TractRecord } from "@/lib/tract-data";

// Group CSV columns into sections for the detail page
const SECTIONS: { title: string; keys: string[] }[] = [
  {
    title: "Location",
    keys: ["ID", "STATE_NAME", "ST_ABBREV", "CNTY_NAME", "REGION"],
  },
  {
    title: "Demographics",
    keys: [
      "ACSTOTPOP",
      "ACSIPOVBAS",
      "ACSEDUCBAS",
      "ACSTOTHH",
      "ACSTOTHU",
      "ACSUNEMPBAS",
      "DEMOGIDX_2",
      "DEMOGIDX_5",
      "PEOPCOLOR",
      "PEOPCOLORPCT",
      "LOWINCOME",
      "LOWINCPCT",
      "UNEMPLOYED",
      "UNEMPPCT",
      "LINGISO",
      "LINGISOPCT",
      "LESSHS",
      "LESSHSPCT",
      "UNDER5",
      "UNDER5PCT",
      "OVER64",
      "OVER64PCT",
      "LIFEEXPPCT",
    ],
  },
  {
    title: "Environmental indicators (raw)",
    keys: ["PM25", "OZONE", "DSLPM", "CANCER", "RESP", "RSEI_AIR", "PTRAF"],
  },
  {
    title: "Environmental indicators (percentiles)",
    keys: [
      "P_PM25",
      "P_OZONE",
      "P_DSLPM",
      "P_CANCER",
      "P_RESP",
      "P_RSEI_AIR",
      "P_PTRAF",
      "P_LDPNT",
      "P_PNPL",
      "P_PRMP",
      "P_PTSDF",
      "P_UST",
      "P_PWDIS",
    ],
  },
  {
    title: "D2/D5 indices (demographic % in high exposure)",
    keys: [
      "D2_PM25",
      "D5_PM25",
      "D2_OZONE",
      "D5_OZONE",
      "D2_DSLPM",
      "D5_DSLPM",
      "D2_CANCER",
      "D5_CANCER",
      "D2_RESP",
      "D5_RESP",
      "D2_RSEI_AIR",
      "D5_RSEI_AIR",
      "D2_PTRAF",
      "D5_PTRAF",
      "D2_LDPNT",
      "D5_LDPNT",
      "D2_PNPL",
      "D5_PNPL",
      "D2_PRMP",
      "D5_PRMP",
      "D2_PTSDF",
      "D5_PTSDF",
      "D2_UST",
      "D5_UST",
      "D2_PWDIS",
      "D5_PWDIS",
    ],
  },
  {
    title: "Other",
    keys: [
      "PRE1960",
      "PRE1960PCT",
      "PNPL",
      "PRMP",
      "PTSDF",
      "UST",
      "PWDIS",
      "AREALAND",
      "AREAWATER",
      "NPL_CNT",
      "TSDF_CNT",
      "EXCEED_COUNT_80",
      "EXCEED_COUNT_80_SUP",
      "P_DEMOGIDX_2",
      "P_DEMOGIDX_5",
      "P_PEOPCOLORPCT",
      "P_LOWINCPCT",
      "P_UNEMPPCT",
      "P_LINGISOPCT",
      "P_LESSHSPCT",
      "P_UNDER5PCT",
      "P_OVER64PCT",
      "P_LIFEEXPPCT",
      "P_D2_PM25",
      "P_D5_PM25",
      "P_D2_OZONE",
      "P_D5_OZONE",
      "P_D2_DSLPM",
      "P_D5_DSLPM",
      "P_D2_CANCER",
      "P_D5_CANCER",
      "P_D2_RESP",
      "P_D5_RESP",
      "P_D2_RSEI_AIR",
      "P_D5_RSEI_AIR",
      "P_D2_PTRAF",
      "P_D5_PTRAF",
      "P_D2_LDPNT",
      "P_D5_LDPNT",
      "P_D2_PNPL",
      "P_D5_PNPL",
      "P_D2_PRMP",
      "P_D5_PRMP",
      "P_D2_PTSDF",
      "P_D5_PTSDF",
      "P_D2_UST",
      "P_D5_UST",
      "P_D2_PWDIS",
      "P_D5_PWDIS",
    ],
  },
];

function formatKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(4).replace(/\.?0+$/, "");
  }
  return String(value);
}

export default async function TractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tract = await getTractById(id);
  if (!tract) notFound();

  const location = [
    tract["STATE_NAME"],
    tract["ST_ABBREV"],
    tract["CNTY_NAME"],
    tract["ID"],
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-slate-600 hover:text-slate-900 text-sm font-medium"
          >
            ← Back to map
          </Link>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-800">
          Census tract {String(tract["ID"] ?? id)}
        </h1>
        <p className="mt-1 text-slate-600">{location}</p>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="space-y-8">
          {SECTIONS.map((section) => {
            const entries = section.keys
              .filter((key) => key in tract)
              .map((key) => ({
                key,
                value: tract[key],
              }));
            if (entries.length === 0) return null;
            return (
              <section
                key={section.title}
                className="rounded-lg border bg-white p-6 shadow-sm"
              >
                <h2 className="mb-4 text-lg font-semibold text-slate-800">
                  {section.title}
                </h2>
                <dl className="grid gap-2 sm:grid-cols-2">
                  {entries.map(({ key, value }) => (
                    <div
                      key={key}
                      className="flex flex-col border-b border-slate-100 pb-2 last:border-0"
                    >
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {formatKey(key)}
                      </dt>
                      <dd className="mt-0.5 font-mono text-sm text-slate-800">
                        {formatValue(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
