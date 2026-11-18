import { NextResponse } from "next/server";
import { dataUrlToBytes, storeImage } from "@/lib/server/db";

export async function POST(req: Request) {
  try {
    const { dataUrl } = await req.json();
    const { bytes, type } = dataUrlToBytes(String(dataUrl ?? ""));
    return NextResponse.json({ url: await storeImage(bytes, type) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
