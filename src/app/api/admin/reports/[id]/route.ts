import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

const bodySchema = z.object({ status: z.enum(["RESOLVED", "DISMISSED", "OPEN"]) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const report = await prisma.report.update({
    where: { id },
    data: {
      status: parsed.data.status,
      resolvedAt: parsed.data.status === "OPEN" ? null : new Date(),
    },
  });

  return NextResponse.json({ report });
}
