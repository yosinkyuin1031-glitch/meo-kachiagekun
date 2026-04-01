import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clinicName, email, address } = body;

    if (!clinicName || !email || !address) {
      return NextResponse.json({ error: "院名・メールアドレス・住所は必須です" }, { status: 400 });
    }

    const supabase = await createClient();

    // 申込みデータをDBに保存
    const { error } = await supabase.from("meo_applications").insert({
      id: crypto.randomUUID(),
      clinic_name: body.clinicName,
      owner_name: body.ownerName || "",
      email: body.email,
      phone: body.phone || "",
      address: body.address,
      homepage: body.homepage || "",
      wordpress: body.wordpress || "",
      note_url: body.note || "",
      message: body.message || "",
      status: "pending",
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Application save error:", error);
      return NextResponse.json({ error: "申込みの保存に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Apply error:", e);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }
}
