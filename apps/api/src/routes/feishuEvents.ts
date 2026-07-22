import { createHash, createDecipheriv } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../lib/context.js";
import { sortByUpdatedAtDesc } from "../lib/context.js";
import { saveMeetings } from "../meetingStore.js";
import {
  extractFeishuMeetingNo,
  refreshFeishuMeetingRecording
} from "../services/feishuCalendar.js";
import { tryAdvanceRunsBlockedOnRecording } from "../services/feishuRecordingAdvance.js";

type FeishuEventEnvelope = {
  challenge?: string;
  token?: string;
  type?: string;
  schema?: string;
  encrypt?: string;
  header?: {
    event_type?: string;
    token?: string;
  };
  event?: {
    type?: string;
    meeting?: {
      id?: string;
      meeting_no?: string;
      topic?: string;
    };
    url?: string;
  };
};

function getFeishuEventConfig() {
  return {
    verificationToken: process.env["FEISHU_VERIFICATION_TOKEN"] ?? "",
    encryptKey: process.env["FEISHU_ENCRYPT_KEY"] ?? ""
  };
}

function decryptFeishuEncrypt(encrypt: string, encryptKey: string) {
  const key = createHash("sha256").update(encryptKey).digest();
  const encryptBuffer = Buffer.from(encrypt, "base64");
  const iv = encryptBuffer.subarray(0, 16);
  const data = encryptBuffer.subarray(16);
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return JSON.parse(decrypted) as FeishuEventEnvelope;
}

function resolveEventBody(raw: FeishuEventEnvelope): FeishuEventEnvelope {
  if (!raw.encrypt) {
    return raw;
  }

  const encryptKey = getFeishuEventConfig().encryptKey;
  if (!encryptKey) {
    throw new Error("收到加密事件，但未配置 FEISHU_ENCRYPT_KEY；请在开放平台清空 Encrypt Key，或在 .env 填入相同密钥");
  }

  return decryptFeishuEncrypt(raw.encrypt, encryptKey);
}

function resolveEventType(body: FeishuEventEnvelope) {
  return body.header?.event_type || body.event?.type || body.type || "";
}

function assertEventToken(body: FeishuEventEnvelope) {
  const config = getFeishuEventConfig();
  if (!config.verificationToken) {
    return;
  }

  const token = body.token || body.header?.token || "";
  if (token && token !== config.verificationToken) {
    throw new Error("飞书事件 token 校验失败：请确认 .env 中 FEISHU_VERIFICATION_TOKEN 与开放平台一致");
  }
}

/**
 * Feishu event callback: URL verification + recording_ready → refresh transcript & advance runs.
 */
export async function feishuEventRoutes(app: FastifyInstance, ctx: AppContext) {
  app.post("/api/integrations/feishu/events", async (request, reply) => {
    reply.header("Content-Type", "application/json; charset=utf-8");

    let body: FeishuEventEnvelope;
    try {
      body = resolveEventBody((request.body ?? {}) as FeishuEventEnvelope);
    } catch (error) {
      // Feishu treats non-JSON / unexpected shapes as "返回数据不是合法的JSON格式"
      app.log.error(error);
      return reply.code(200).send({
        message: error instanceof Error ? error.message : "无法解析飞书事件"
      });
    }

    // URL verification must return ONLY { challenge } within 1s.
    if (body.type === "url_verification" || Boolean(body.challenge)) {
      try {
        assertEventToken(body);
      } catch (error) {
        app.log.warn(error);
      }

      if (!body.challenge) {
        return reply.code(200).send({ challenge: "" });
      }

      return reply.code(200).send({ challenge: body.challenge });
    }

    try {
      assertEventToken(body);
    } catch (error) {
      return reply.code(200).send({ message: error instanceof Error ? error.message : "token 无效" });
    }

    const eventType = resolveEventType(body);
    if (eventType !== "vc.meeting.recording_ready_v1" && eventType !== "meeting.recording_ready_v1") {
      return reply.code(200).send({ message: `ignored event: ${eventType || "unknown"}` });
    }

    const meetingId = body.event?.meeting?.id?.trim() || "";
    const meetingNo = extractFeishuMeetingNo(body.event?.meeting?.meeting_no || "");
    const recordingUrl = body.event?.url?.trim() || "";

    const matched = ctx.meetings.find((meeting) => {
      const external = meeting.externalMeeting?.provider === "feishu" ? meeting.externalMeeting : null;
      if (!external) {
        return false;
      }
      if (meetingId && external.meetingId === meetingId) {
        return true;
      }
      if (meetingNo && external.meetingNo === meetingNo) {
        return true;
      }
      return false;
    });

    if (!matched) {
      app.log.info({ meetingId, meetingNo }, "feishu recording_ready: no matched local meeting");
      return reply.code(200).send({ message: "no matched meeting" });
    }

    const ownerUserId = matched.ownerUserId || "system";

    try {
      const externalMeeting = await refreshFeishuMeetingRecording(ownerUserId, matched, {
        meetingId: meetingId || undefined,
        meetingNo: meetingNo || undefined,
        recordingUrl: recordingUrl || undefined
      });

      const updated = {
        ...matched,
        externalMeeting,
        meetingLink: externalMeeting.meetingUrl || matched.meetingLink,
        updatedAt: new Date().toISOString()
      };
      ctx.meetings = ctx.meetings.map((item) => (item.id === matched.id ? updated : item)).sort(sortByUpdatedAtDesc);
      await saveMeetings(ctx.meetings);

      const advanced = await tryAdvanceRunsBlockedOnRecording(ctx, updated, ownerUserId);
      return reply.code(200).send({
        message: "recording refreshed",
        meetingId: updated.id,
        recordingStatus: externalMeeting.recordingStatus,
        transcriptStatus: externalMeeting.transcriptStatus,
        advancedRunCount: advanced.length
      });
    } catch (error) {
      app.log.error(error);
      return reply.code(200).send({
        message: error instanceof Error ? error.message : "处理飞书录制就绪事件失败"
      });
    }
  });
}
