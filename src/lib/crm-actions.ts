"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { customer } from "@/db/schema";
import { getOrgAccess } from "@/lib/org-access";

const e164ish = /^\+[1-9]\d{6,14}$/;

const updateSchema = z.object({
  orgSlug: z.string().min(1),
  customerId: z.string().uuid(),
  displayName: z.string().max(200).optional(),
  phoneE164: z.string().min(8).max(20),
  meetingBooked: z.boolean(),
  meetingTime: z.string().max(500).optional(),
  metadataJson: z.string().max(50_000).optional(),
});

export async function updateCustomerAction(
  raw: z.infer<typeof updateSchema>,
): Promise<{ ok: true } | { error: string }> {
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", ") };
  }

  const input = parsed.data;
  if (!e164ish.test(input.phoneE164.trim())) {
    return {
      error: "Phone must be E.164 (e.g. +15551234567).",
    };
  }

  let metadata: Record<string, unknown> = {};
  const mj = input.metadataJson?.trim();
  if (mj) {
    try {
      const parsedJson = JSON.parse(mj) as unknown;
      if (
        parsedJson !== null &&
        typeof parsedJson === "object" &&
        !Array.isArray(parsedJson)
      ) {
        metadata = parsedJson as Record<string, unknown>;
      } else {
        return { error: "Metadata must be a JSON object." };
      }
    } catch {
      return { error: "Metadata is not valid JSON." };
    }
  }

  const access = await getOrgAccess(input.orgSlug);
  if (!access) {
    return { error: "Unauthorized." };
  }

  const [row] = await db
    .select({ id: customer.id })
    .from(customer)
    .where(
      and(
        eq(customer.id, input.customerId),
        eq(customer.organizationId, access.org.id),
      ),
    )
    .limit(1);

  if (!row) {
    return { error: "Contact not found." };
  }

  const phoneE164 = input.phoneE164.trim();
  const displayName =
    input.displayName?.trim() === "" ? null : input.displayName?.trim() ?? null;
  const meetingTime =
    input.meetingTime?.trim() === "" ? null : input.meetingTime?.trim() ?? null;
  const now = new Date();

  try {
    await db
      .update(customer)
      .set({
        displayName,
        phoneE164,
        meetingBooked: input.meetingBooked,
        meetingTime,
        metadata,
        updatedAt: now,
      })
      .where(eq(customer.id, input.customerId));
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      return {
        error: "Another contact already uses this phone number in your workspace.",
      };
    }
    throw e;
  }

  revalidatePath(`/app/${input.orgSlug}/crm`);
  revalidatePath(`/app/${input.orgSlug}/crm/${input.customerId}`);
  revalidatePath(`/app/${input.orgSlug}/inbox`);
  return { ok: true };
}
