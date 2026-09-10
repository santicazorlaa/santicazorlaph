import { NextResponse } from "next/server";

import { endSession } from "@/lib/auth";
import { siteUrl } from "@/lib/env";

/// Cierra la sesión borrando la cookie sc_admin y redirige a la pantalla de login.
export async function POST() {
  await endSession();
  return NextResponse.redirect(`${siteUrl}/admin/login`, { status: 303 });
}
