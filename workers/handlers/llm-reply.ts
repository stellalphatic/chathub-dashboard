import type { Job } from "bullmq";
import type { LlmReplyJob } from "../../src/lib/queue";
import { replyToConversation } from "../../src/lib/services/llm-reply";

export async function handleLlmReply(job: Job<LlmReplyJob>) {
  const p = job.data;
  return replyToConversation({
    organizationId: p.organizationId,
    conversationId: p.conversationId,
    triggeringMessageId: p.triggeringMessageId,
  });
}
