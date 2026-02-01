import { NextResponse } from "next/server";
import { getTractById } from "@/lib/tract-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing tract ID" }, { status: 400 });
  }

  const tract = await getTractById(id);
  if (!tract) {
    return NextResponse.json(
      { error: "Tract not found. Run export script if data is missing." },
      { status: 404 }
    );
  }

  return NextResponse.json(tract);
}
