import { NextResponse } from "next/server";

import { checkPassword, startSession } from "@/lib/auth";
import { siteUrl } from "@/lib/env";

/// Form POST común en vez de server action: entra sin depender de JavaScript.
export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");

  if (!checkPassword(password)) {
    return NextResponse.redirect(`${siteUrl}/admin/login?error=1`, { status: 303 });
  }

  await startSession();
  return NextResponse.redirect(`${siteUrl}/admin`, { status: 303 });
}
