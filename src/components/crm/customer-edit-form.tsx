"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Calendar,
  ChevronDown,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Save,
  Tag,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  setCustomerFlagsAction,
  setCustomerStatusAction,
  updateCustomerAction,
} from "@/lib/crm-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type CustomerEditInitial = {
  id: string;
  displayName: string;
  phoneE164: string;
  email: string;
  status: string;
  tags: string[];
  meetingBooked: boolean;
  meetingTime: string;
  metadataJson: string;
  profileJson: string;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUSES = [
  { id: "new", label: "New", color: "bg-sky-500", badge: "secondary" as const },
  { id: "active", label: "Active", color: "bg-emerald-500", badge: "success" as const },
  { id: "follow_up", label: "Follow-up", color: "bg-amber-500", badge: "warning" as const },
  { id: "converted", label: "Converted", color: "bg-violet-500", badge: "gradient" as const },
  { id: "dnd", label: "Do not disturb", color: "bg-rose-500", badge: "danger" as const },
] as const;

type HistoryItem = {
  id: string;
  direction: string;
  body: string;
  channel: string | null;
  createdAt: string;
  sentByBot?: boolean | null;
  status?: string | null;
};

export function CustomerEditForm({
  orgSlug,
  initial,
  history,
}: {
  orgSlug: string;
  initial: CustomerEditInitial;
  history: HistoryItem[];
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [phoneE164, setPhoneE164] = useState(initial.phoneE164);
  const [meetingBooked, setMeetingBooked] = useState(initial.meetingBooked);
  const [meetingTime, setMeetingTime] = useState(initial.meetingTime);
  const [metadataJson, setMetadataJson] = useState(initial.metadataJson);
  const [tags, setTags] = useState<string[]>(initial.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [status, setStatus] = useState(initial.status);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await updateCustomerAction({
        orgSlug,
        customerId: initial.id,
        displayName,
        phoneE164,
        meetingBooked,
        meetingTime,
        metadataJson,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      // Also sync tags in a separate call (updateCustomerAction doesn't accept tags)
      const tagRes = await setCustomerFlagsAction({
        orgSlug,
        customerId: initial.id,
        tags,
      });
      if (tagRes && "error" in tagRes && tagRes.error) {
        toast.error(tagRes.error);
        return;
      }
      toast.success("Saved.");
      router.refresh();
    });
  }

  const addTag = () => {
    const v = tagDraft.trim();
    if (!v) return;
    if (tags.includes(v)) {
      setTagDraft("");
      return;
    }
    setTags([...tags, v]);
    setTagDraft("");
  };

  const changeStatus = (next: typeof STATUSES[number]["id"]) => {
    setStatus(next);
    start(async () => {
      const res = await setCustomerStatusAction({
        orgSlug,
        customerId: initial.id,
        status: next,
      });
      if (res && "error" in res && res.error) toast.error(res.error);
      else toast.success(`Moved to ${STATUSES.find((s) => s.id === next)?.label}`);
    });
  };

  const currentStatus =
    STATUSES.find((s) => s.id === status) ?? STATUSES[0];

  // Group history by day for timeline view
  const byDay = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    for (const m of history) {
      const d = new Date(m.createdAt);
      const key = d.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [history]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
      {/* LEFT — profile + actions */}
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full gradient-brand text-2xl font-semibold text-white shadow-lg">
              {(displayName || phoneE164 || "?").slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="text-lg font-semibold">{displayName || "Unnamed"}</p>
              <p className="font-mono text-[11px] text-[rgb(var(--fg-subtle))]">
                {phoneE164}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="secondary" className="gap-2">
                  <span className={cn("h-2 w-2 rounded-full", currentStatus.color)} />
                  {currentStatus.label}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuLabel>Move to…</DropdownMenuLabel>
                {STATUSES.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onSelect={() => changeStatus(s.id)}
                    disabled={pending || s.id === status}
                  >
                    <span className={cn("h-2 w-2 rounded-full", s.color)} />
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex w-full flex-wrap justify-center gap-1 pt-2">
              {meetingBooked ? (
                <Badge variant="gradient" className="gap-1">
                  <Calendar className="h-3 w-3" /> {meetingTime || "Booked"}
                </Badge>
              ) : null}
              {tags.map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>

            <div className="mt-2 flex w-full gap-2">
              <Button asChild size="sm" variant="secondary" className="flex-1">
                <Link href={`/app/${orgSlug}/inbox?c=${initial.id}`}>
                  <MessageCircle className="h-3.5 w-3.5" /> Inbox
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost" className="flex-1">
                <a href={`tel:${phoneE164}`}>
                  <Phone className="h-3.5 w-3.5" /> Call
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>Edit and click Save.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Display name</Label>
              <Input
                className="mt-1"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div>
              <Label>Phone (E.164)</Label>
              <Input
                className="mt-1 font-mono"
                value={phoneE164}
                onChange={(e) => setPhoneE164(e.target.value)}
              />
            </div>
            <div>
              <Label>
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Email
                </span>
              </Label>
              <Input
                className="mt-1"
                defaultValue={initial.email}
                placeholder="not set"
                disabled
              />
              <p className="mt-1 text-[10px] text-[rgb(var(--fg-subtle))]">
                Email is captured from the channel profile automatically.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Meeting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Switch
              checked={meetingBooked}
              onCheckedChange={setMeetingBooked}
              label="Meeting booked"
              description="Surfaces this contact in the Appointments view."
            />
            <div>
              <Label>When / where</Label>
              <Input
                className="mt-1"
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
                disabled={!meetingBooked}
                placeholder="Sat 3 PM · showroom"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              <span className="inline-flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" /> Tags
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {tags.length === 0 ? (
                <span className="text-xs text-[rgb(var(--fg-subtle))]">
                  No tags yet.
                </span>
              ) : (
                tags.map((t, i) => (
                  <span
                    key={`${t}-${i}`}
                    className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2.5 py-1 text-xs"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((_, idx) => idx !== i))}
                      className="rounded-full hover:bg-[rgb(var(--border))]"
                      aria-label="Remove tag"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add a tag and press Enter"
              />
              <Button type="button" size="sm" variant="secondary" onClick={addTag}>
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <Button variant="gradient" onClick={save} disabled={pending} className="w-full">
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Save changes
            </>
          )}
        </Button>
      </div>

      {/* RIGHT — tabs (activity / metadata / audit) */}
      <div>
        <Tabs defaultValue="activity">
          <TabsList>
            <TabsTrigger value="activity">
              <MessageCircle className="h-3.5 w-3.5" /> Activity
            </TabsTrigger>
            <TabsTrigger value="metadata">
              <User className="h-3.5 w-3.5" /> Metadata
            </TabsTrigger>
          </TabsList>

          {/* Activity timeline */}
          <TabsContent value="activity">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Recent messages ({history.length})
                </CardTitle>
                <CardDescription>
                  Inbound from the customer, outbound from AI / agents. Click{" "}
                  <Link
                    href={`/app/${orgSlug}/inbox?c=${initial.id}`}
                    className="text-[rgb(var(--accent))] hover:underline"
                  >
                    Open in Inbox <ExternalLink className="inline h-3 w-3" />
                  </Link>{" "}
                  to reply.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-6 text-center text-sm text-[rgb(var(--fg-subtle))]">
                    No messages yet — the timeline will populate as the customer replies.
                  </p>
                ) : (
                  <div className="space-y-5">
                    {byDay.map(([day, items]) => (
                      <div key={day}>
                        <div className="mb-2 flex items-center gap-3">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                            {day}
                          </span>
                          <span className="h-px flex-1 bg-[rgb(var(--border))]" />
                        </div>
                        <ol className="relative ml-3 space-y-2 border-l border-[rgb(var(--border))] pl-4">
                          {items.map((m) => {
                            const outbound = m.direction === "outbound";
                            return (
                              <motion.li
                                key={m.id}
                                initial={{ opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="relative"
                              >
                                <span
                                  className={cn(
                                    "absolute -left-[21px] top-2 h-2.5 w-2.5 rounded-full ring-4 ring-[rgb(var(--surface))]",
                                    outbound
                                      ? m.sentByBot
                                        ? "bg-[rgb(var(--accent))]"
                                        : "bg-blue-500"
                                      : "bg-[rgb(var(--fg-subtle))]",
                                  )}
                                />
                                <div
                                  className={cn(
                                    "rounded-xl border px-3 py-2 text-sm",
                                    outbound
                                      ? "border-[rgb(var(--accent)/0.3)] bg-[rgb(var(--accent)/0.06)]"
                                      : "border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]",
                                  )}
                                >
                                  <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-[rgb(var(--fg-subtle))]">
                                    <span>
                                      {outbound
                                        ? m.sentByBot
                                          ? "AI → customer"
                                          : "Agent → customer"
                                        : "Customer"}{" "}
                                      · {m.channel}
                                    </span>
                                    <span>
                                      {new Date(m.createdAt).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </div>
                                  <p className="whitespace-pre-wrap break-words">
                                    {m.body || (
                                      <span className="text-[rgb(var(--fg-subtle))]">
                                        (no text)
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </motion.li>
                            );
                          })}
                        </ol>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metadata */}
          <TabsContent value="metadata">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Metadata (JSON)</CardTitle>
                <CardDescription>
                  Free-form object you can use for anything — preferred language, lead source,
                  external IDs, product interest, etc. Saved when you hit <strong>Save
                  changes</strong> on the left.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={metadataJson}
                  onChange={(e) => setMetadataJson(e.target.value)}
                  rows={12}
                  spellCheck={false}
                  className="font-mono text-xs"
                />
                {initial.profileJson && initial.profileJson !== "{}" ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                      Channel profile (read-only)
                    </p>
                    <pre className="mt-1 overflow-x-auto rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-3 text-[11px]">
                      {initial.profileJson}
                    </pre>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="mt-4">
          <CardContent className="grid gap-2 p-4 text-xs text-[rgb(var(--fg-muted))] sm:grid-cols-3">
            <span>
              Last contact:{" "}
              <span className="text-[rgb(var(--fg))]">
                {initial.lastContactedAt
                  ? new Date(initial.lastContactedAt).toLocaleString()
                  : "—"}
              </span>
            </span>
            <span>
              Created:{" "}
              <span className="text-[rgb(var(--fg))]">
                {new Date(initial.createdAt).toLocaleString()}
              </span>
            </span>
            <span>
              Updated:{" "}
              <span className="text-[rgb(var(--fg))]">
                {new Date(initial.updatedAt).toLocaleString()}
              </span>
            </span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
