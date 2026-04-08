/**
 * Static preview data only — no database, env, or network.
 * Used under `/demo/*` so prospects can see the UI before go-live.
 */

export const DEMO_ORG_SLUG = "sample-dealership";

export const demoOrg = {
  name: "Sample Motors",
  slug: DEMO_ORG_SLUG,
};

export const demoStats = {
  totalCustomers: 128,
  messages24h: 342,
  /** Prior 24h window — used for trend badges in the demo dashboard. */
  prevMessages24h: 276,
  inbound24h: 198,
  outbound24h: 144,
  newCustomers7d: 14,
};

/** Static 7-day series for the demo area chart (no DB). */
export const demoVolume7d = [
  { label: "Mar 31", count: 118 },
  { label: "Apr 1", count: 142 },
  { label: "Apr 2", count: 96 },
  { label: "Apr 3", count: 201 },
  { label: "Apr 4", count: 165 },
  { label: "Apr 5", count: 188 },
  { label: "Apr 6", count: 342 },
] as const;

export const demoSentiment = [
  { label: "positive", count: 62 },
  { label: "neutral", count: 31 },
  { label: "negative", count: 7 },
] as const;

export type DemoCustomer = {
  id: string;
  displayName: string;
  phoneE164: string;
  meetingBooked?: boolean;
  meetingTime?: string | null;
  metadata?: Record<string, unknown>;
  /** ISO timestamp for CRM preview */
  lastContactedAt?: string;
};

export type DemoMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  timeLabel: string;
};

export const demoCustomers: DemoCustomer[] = [
  {
    id: "demo-c1",
    displayName: "Sara Khan",
    phoneE164: "+923001234567",
    meetingBooked: true,
    meetingTime: "Sat 3 PM · showroom",
    metadata: { lead_status: "qualified", source: "whatsapp_campaign_q2" },
    lastContactedAt: "2026-04-06T09:45:00.000Z",
  },
  {
    id: "demo-c2",
    displayName: "James Okafor",
    phoneE164: "+447700900123",
    meetingBooked: false,
    metadata: { interest: "mini_truck", stage: "pricing" },
    lastContactedAt: "2026-04-05T16:13:00.000Z",
  },
  {
    id: "demo-c3",
    displayName: "Unknown",
    phoneE164: "+15551234567",
    meetingBooked: false,
    metadata: {},
    lastContactedAt: "2026-04-01T11:02:00.000Z",
  },
];

export const demoMessagesByCustomer: Record<string, DemoMessage[]> = {
  "demo-c1": [
    {
      id: "dm1",
      direction: "inbound",
      body: "Hi — do you have the EV in silver?",
      timeLabel: "Today, 9:41 AM",
    },
    {
      id: "dm2",
      direction: "outbound",
      body:
        "Hi Sara! Yes, the HONRI VE is available in Snowy White, Warm Silver, and more. Would you like to book a showroom visit?",
      timeLabel: "Today, 9:42 AM",
    },
    {
      id: "dm3",
      direction: "inbound",
      body: "Warm Silver sounds perfect. Saturday afternoon?",
      timeLabel: "Today, 9:44 AM",
    },
    {
      id: "dm4",
      direction: "outbound",
      body:
        "Saturday works — we’re open 9–8. I can hold 3 PM for you at 202 Baker Street. Shall I confirm?",
      timeLabel: "Today, 9:45 AM",
    },
  ],
  "demo-c2": [
    {
      id: "dm5",
      direction: "inbound",
      body: "Price range for the mini truck?",
      timeLabel: "Yesterday, 4:12 PM",
    },
    {
      id: "dm6",
      direction: "outbound",
      body:
        "For the latest pricing I’ll connect you with sales — I can also book a visit so you get exact figures on the lot.",
      timeLabel: "Yesterday, 4:13 PM",
    },
  ],
  "demo-c3": [
    {
      id: "dm7",
      direction: "inbound",
      body: "Hello",
      timeLabel: "Mon, 11:02 AM",
    },
  ],
};
