import { eq } from "drizzle-orm";
import { db } from "@/db";
import { channelConnection } from "@/db/schema";
import { decryptJSON } from "@/lib/encryption";
import { resolveInstagramPageAccessToken } from "./meta-resolve";
import {
  createInstagramSender,
  createMessengerSender,
  type MetaFbConfig,
  type MetaIgConfig,
  type MetaSecrets,
} from "./meta";
import {
  createManyChatSender,
  type ManyChatConfig,
  type ManyChatSecrets,
} from "./manychat";
import type { ChannelSender } from "./types";
import {
  createSyrowSender,
  type SyrowConfig,
  type SyrowSecrets,
} from "./syrow";
import {
  createYCloudSender,
  type YCloudConfig,
  type YCloudSecrets,
} from "./ycloud";

export type LoadedConnection = {
  id: string;
  organizationId: string;
  channel: string;
  provider: string;
  externalId: string | null;
  config: Record<string, unknown>;
  sender: ChannelSender;
};

export async function loadChannelConnection(
  channelConnectionId: string,
): Promise<LoadedConnection> {
  const [row] = await db
    .select()
    .from(channelConnection)
    .where(eq(channelConnection.id, channelConnectionId))
    .limit(1);
  if (!row) throw new Error("channel connection not found");
  if (!row.secretsCiphertext) {
    throw new Error("channel connection missing secrets");
  }
  const secretsRaw = decryptJSON<Record<string, string>>(row.secretsCiphertext);
  const secrets: Record<string, string> = {};
  for (const [k, v] of Object.entries(secretsRaw)) {
    secrets[k] = typeof v === "string" ? v.trim() : String(v ?? "");
  }
  const config = (row.config ?? {}) as Record<string, unknown>;

  let sender: ChannelSender;
  switch (row.provider) {
    case "ycloud":
      sender = createYCloudSender(secrets as YCloudSecrets, config as unknown as YCloudConfig);
      break;
    case "syrow":
      sender = createSyrowSender(
        secrets as SyrowSecrets,
        config as unknown as SyrowConfig,
      );
      break;
    case "meta":
      if (row.channel === "instagram") {
        const igCfg = config as unknown as MetaIgConfig;
        const igId = String(igCfg.igUserId ?? "").trim();
        let accessToken = String((secrets as MetaSecrets).accessToken ?? "").trim();
        if (igId && accessToken) {
          const pageTok = await resolveInstagramPageAccessToken(accessToken, igId);
          if (pageTok) accessToken = pageTok;
        }
        sender = createInstagramSender(
          { ...(secrets as MetaSecrets), accessToken },
          igCfg,
        );
      } else {
        sender = createMessengerSender(
          secrets as MetaSecrets,
          config as unknown as MetaFbConfig,
        );
      }
      break;
    case "manychat":
      sender = createManyChatSender(
        secrets as ManyChatSecrets,
        config as unknown as ManyChatConfig,
      );
      break;
    default:
      throw new Error(`Unsupported provider: ${row.provider}`);
  }

  return {
    id: row.id,
    organizationId: row.organizationId,
    channel: row.channel,
    provider: row.provider,
    externalId: row.externalId,
    config,
    sender,
  };
}
