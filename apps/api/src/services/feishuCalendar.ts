import type {
  MeetingExternalCalendar,
  MeetingExternalMeeting,
  MeetingRecord
} from "@meeting-flow/shared";
import {
  getIntegrationAccount,
  saveIntegrationAccount,
  type IntegrationAccount
} from "../integrationStore.js";

const FEISHU_AUTH_URL = "https://open.feishu.cn/open-apis/authen/v1/authorize";
const FEISHU_TOKEN_URL = "https://open.feishu.cn/open-apis/authen/v2/oauth/token";
const FEISHU_CALENDAR_EVENT_URL = "https://open.feishu.cn/open-apis/calendar/v4/calendars";
const FEISHU_MEETING_LIST_BY_NO_URL = "https://open.feishu.cn/open-apis/vc/v1/meetings/list_by_no";
const FEISHU_MEETING_RECORDING_URL = "https://open.feishu.cn/open-apis/vc/v1/meetings";
const FEISHU_MINUTES_TRANSCRIPT_URL = "https://open.feishu.cn/open-apis/minutes/v1/minutes";
const DEFAULT_TIMEZONE = "Asia/Shanghai";

/** 与飞书开放平台当前权限名对齐（会议信息多为 meetingevent:read） */
export const REQUIRED_FEISHU_OAUTH_SCOPES = [
  "calendar:calendar",
  "calendar:calendar.event:create",
  "vc:meeting.meetingevent:read",
  "vc:record:readonly",
  "minutes:minutes.transcript:export"
];

/** 历史/等价 scope，任一满足即可视为已具备会议只读能力 */
const FEISHU_MEETING_READONLY_SCOPE_ALIASES = [
  "vc:meeting.meetingevent:read",
  "vc:meeting:readonly",
  "vc:meeting.meetingid:read"
];

const FEISHU_TRANSCRIPT_SCOPE_ALIASES = [
  "minutes:minutes.transcript:export",
  "minutes:minute:download"
];

const DEFAULT_FEISHU_OAUTH_SCOPES = REQUIRED_FEISHU_OAUTH_SCOPES.join(" ");

type FeishuTokenPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
};

type FeishuTokenResponse = FeishuTokenPayload & {
  code?: number;
  error?: string;
  error_description?: string;
  msg?: string;
  data?: FeishuTokenPayload;
};

type FeishuVchat = {
  meeting_url?: string;
  vc_type?: string;
  meeting_settings?: {
    auto_record?: boolean;
  };
};

type FeishuCalendarEvent = {
  event_id?: string;
  app_link?: string;
  html_link?: string;
  vchat?: FeishuVchat;
};

type FeishuCalendarEventResponse = {
  code?: number;
  msg?: string;
  data?: {
    event?: FeishuCalendarEvent;
  };
};

type FeishuMeetingBrief = {
  id?: string;
  topic?: string;
  url?: string;
  meeting_no?: string;
};

type FeishuMeetingListResponse = {
  code?: number;
  msg?: string;
  data?: {
    meeting_briefs?: FeishuMeetingBrief[];
  };
};

type FeishuRecordingResponse = {
  code?: number;
  msg?: string;
  data?: {
    recording?: {
      url?: string;
      duration?: string;
    };
  };
};

export type FeishuSyncResult = {
  externalCalendar: MeetingExternalCalendar;
  externalMeeting: MeetingExternalMeeting;
};

export type FeishuRecordingRefreshInput = {
  meetingId?: string;
  meetingNo?: string;
  recordingUrl?: string;
};

export function getFeishuConfig() {
  const appId = process.env["FEISHU_APP_ID"] ?? "";
  const appSecret = process.env["FEISHU_APP_SECRET"] ?? "";
  const calendarId = process.env["FEISHU_CALENDAR_ID"] ?? "primary";
  const oauthScopes = process.env["FEISHU_OAUTH_SCOPES"] ?? DEFAULT_FEISHU_OAUTH_SCOPES;
  const redirectUri =
    process.env["FEISHU_REDIRECT_URI"] ??
    `http://${process.env["HOST"] ?? "127.0.0.1"}:${process.env["PORT"] ?? "8787"}/api/integrations/feishu/callback`;

  return {
    appId,
    appSecret,
    calendarId,
    oauthScopes,
    redirectUri,
    isConfigured: Boolean(appId && appSecret)
  };
}

export function buildFeishuAuthUrl(state: string) {
  const config = getFeishuConfig();
  const params = new URLSearchParams({
    app_id: config.appId,
    redirect_uri: config.redirectUri,
    scope: config.oauthScopes,
    state
  });

  return `${FEISHU_AUTH_URL}?${params.toString()}`;
}

function expiresAtFromNow(expiresInSeconds = 7200) {
  return new Date(Date.now() + Math.max(60, expiresInSeconds - 60) * 1000).toISOString();
}

async function requestFeishuToken(params: Record<string, string>) {
  const config = getFeishuConfig();
  const response = await fetch(FEISHU_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: config.appId,
      client_secret: config.appSecret,
      ...params
    })
  });
  const data = (await response.json()) as FeishuTokenResponse;
  const token = data.data ?? data;

  if (!response.ok || data.code !== 0 || !token.access_token) {
    const code = typeof data.code === "number" && data.code !== 0 ? `（错误码：${data.code}）` : "";
    throw new Error(`${data.msg || data.error_description || data.error || "飞书授权失败"}${code}`);
  }

  return token;
}

export async function exchangeFeishuCode(userId: string, code: string) {
  const config = getFeishuConfig();
  const token = await requestFeishuToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri
  });
  const now = new Date().toISOString();
  const account: IntegrationAccount = {
    userId,
    provider: "feishu",
    accessToken: token.access_token ?? "",
    refreshToken: token.refresh_token ?? "",
    expiresAt: expiresAtFromNow(token.expires_in),
    scope: token.scope ?? "",
    createdAt: now,
    updatedAt: now
  };

  await saveIntegrationAccount(account);
  return account;
}

async function refreshFeishuAccessToken(account: IntegrationAccount) {
  if (!account.refreshToken) {
    throw new Error("飞书授权缺少 refresh token，请重新连接飞书");
  }

  const token = await requestFeishuToken({
    grant_type: "refresh_token",
    refresh_token: account.refreshToken
  });
  const updatedAccount: IntegrationAccount = {
    ...account,
    accessToken: token.access_token ?? account.accessToken,
    refreshToken: token.refresh_token ?? account.refreshToken,
    expiresAt: expiresAtFromNow(token.expires_in),
    scope: token.scope ?? account.scope,
    updatedAt: new Date().toISOString()
  };

  await saveIntegrationAccount(updatedAccount);
  return updatedAccount;
}

function toUnixSeconds(value: string) {
  return Math.floor(new Date(value).getTime() / 1000).toString();
}

export function extractFeishuMeetingNo(meetingUrlOrNo: string) {
  const trimmed = meetingUrlOrNo.trim();
  if (/^\d{9}$/.test(trimmed)) {
    return trimmed;
  }

  const fromPath = trimmed.match(/\/j\/(\d{9})\b/);
  if (fromPath?.[1]) {
    return fromPath[1];
  }

  const anyNine = trimmed.match(/(\d{9})/);
  return anyNine?.[1] ?? "";
}

function buildFeishuEvent(meeting: MeetingRecord) {
  const agenda = meeting.agendaItems.map((item) => `- ${item.title}`).join("\n");
  const participants = meeting.participants
    .map((participant) => `${participant.name} (${participant.role} / ${participant.status})`)
    .join("\n");
  const description = [
    meeting.description,
    `会议目标：${meeting.meetingGoal}`,
    agenda ? `议程：\n${agenda}` : "",
    participants ? `参会人：\n${participants}` : "",
    meeting.notes ? `备注：${meeting.notes}` : "",
    "由 Meeting Flow Studio 同步（含飞书视频会议，默认开启自动录制）。"
  ].filter(Boolean).join("\n\n");

  return {
    summary: meeting.title,
    description,
    start_time: {
      timestamp: toUnixSeconds(meeting.startAt),
      timezone: DEFAULT_TIMEZONE
    },
    end_time: {
      timestamp: toUnixSeconds(meeting.endAt),
      timezone: DEFAULT_TIMEZONE
    },
    location: {
      name: meeting.location || meeting.meetingLink || "Meeting Flow Studio"
    },
    vchat: {
      vc_type: "vc",
      meeting_settings: {
        auto_record: true,
        allow_attendees_start: true
      }
    }
  };
}

export function getMissingFeishuCalendarScopes(account: Pick<IntegrationAccount, "scope">) {
  const scopes = new Set(account.scope.split(/\s+/).filter(Boolean));
  const hasMeetingReadonly = FEISHU_MEETING_READONLY_SCOPE_ALIASES.some((scope) => scopes.has(scope));
  const hasTranscript = FEISHU_TRANSCRIPT_SCOPE_ALIASES.some((scope) => scopes.has(scope));

  return REQUIRED_FEISHU_OAUTH_SCOPES.filter((scope) => {
    if (FEISHU_MEETING_READONLY_SCOPE_ALIASES.includes(scope)) {
      return !hasMeetingReadonly;
    }
    if (FEISHU_TRANSCRIPT_SCOPE_ALIASES.includes(scope)) {
      return !hasTranscript;
    }
    return !scopes.has(scope);
  });
}

function assertFeishuCalendarScopes(account: IntegrationAccount) {
  const missingScopes = getMissingFeishuCalendarScopes(account);
  if (missingScopes.length > 0) {
    throw new Error(`当前飞书授权缺少权限，请重新点击“连接飞书”授权：${missingScopes.join(", ")}`);
  }
}

async function getValidFeishuAccount(userId: string) {
  const config = getFeishuConfig();
  if (!config.isConfigured) {
    throw new Error("服务端未配置飞书 OAuth，无法同步会议");
  }

  const account = await getIntegrationAccount(userId, "feishu");
  if (!account) {
    throw new Error("请先连接飞书，完成用户授权后再同步会议。");
  }

  const validAccount = new Date(account.expiresAt).getTime() <= Date.now()
    ? await refreshFeishuAccessToken(account)
    : account;
  assertFeishuCalendarScopes(validAccount);
  return { account: validAccount, config };
}

function extractFeishuEventLink(event?: FeishuCalendarEvent) {
  return event?.app_link ?? event?.html_link ?? "";
}

function buildExternalMeetingFromEvent(
  meeting: MeetingRecord,
  event: FeishuCalendarEvent,
  syncedAt: string
): MeetingExternalMeeting {
  const previous = meeting.externalMeeting?.provider === "feishu" ? meeting.externalMeeting : undefined;
  const meetingUrl = event.vchat?.meeting_url || previous?.meetingUrl || "";
  const meetingNo = extractFeishuMeetingNo(meetingUrl) || previous?.meetingNo || "";

  return {
    provider: "feishu",
    calendarEventId: event.event_id || previous?.calendarEventId || "",
    meetingUrl,
    meetingNo,
    meetingId: previous?.meetingId || "",
    recordingStatus: previous?.recordingStatus || (meetingUrl ? "pending" : "none"),
    transcriptStatus: previous?.transcriptStatus || "none",
    recordingUrl: previous?.recordingUrl || "",
    transcriptText: previous?.transcriptText || "",
    lastSyncedAt: syncedAt,
    statusMessage: meetingUrl
      ? "已绑定飞书视频会议；开会并完成录制后，请刷新录制状态。"
      : "已同步飞书日历，但尚未拿到视频会议链接，请稍后刷新。"
  };
}

async function fetchFeishuCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<FeishuCalendarEvent | null> {
  const url = new URL(
    `${FEISHU_CALENDAR_EVENT_URL}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
  );
  url.searchParams.set("need_meeting_settings", "true");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const data = (await response.json()) as FeishuCalendarEventResponse;
  if (!response.ok || data.code !== 0 || !data.data?.event) {
    return null;
  }
  return data.data.event;
}

export async function syncFeishuCalendarEvent(userId: string, meeting: MeetingRecord): Promise<FeishuSyncResult> {
  const { account, config } = await getValidFeishuAccount(userId);
  const existingEventId =
    meeting.externalMeeting?.provider === "feishu" && meeting.externalMeeting.calendarEventId
      ? meeting.externalMeeting.calendarEventId
      : meeting.externalCalendar?.provider === "feishu"
        ? meeting.externalCalendar.eventId
        : "";

  const baseUrl = `${FEISHU_CALENDAR_EVENT_URL}/${encodeURIComponent(config.calendarId)}/events`;
  const url = existingEventId ? `${baseUrl}/${encodeURIComponent(existingEventId)}` : baseUrl;
  const response = await fetch(url, {
    method: existingEventId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildFeishuEvent(meeting))
  });
  const data = (await response.json()) as FeishuCalendarEventResponse;

  if (!response.ok || data.code !== 0 || !data.data?.event?.event_id) {
    const code = typeof data.code === "number" && data.code !== 0 ? `（错误码：${data.code}）` : "";
    throw new Error(`${data.msg || "飞书日历同步失败"}${code}`);
  }

  const eventId = data.data.event.event_id;
  let event = data.data.event;
  if (!event.vchat?.meeting_url) {
    const refreshed = await fetchFeishuCalendarEvent(account.accessToken, config.calendarId, eventId);
    if (refreshed) {
      event = refreshed;
    }
  }

  const syncedAt = new Date().toISOString();
  const externalCalendar: MeetingExternalCalendar = {
    provider: "feishu",
    eventId,
    htmlLink: extractFeishuEventLink(event),
    hangoutLink: event.vchat?.meeting_url || "",
    syncedAt
  };
  const externalMeeting = buildExternalMeetingFromEvent(
    meeting,
    { ...event, event_id: eventId },
    syncedAt
  );

  return { externalCalendar, externalMeeting };
}

async function resolveFeishuMeetingId(
  accessToken: string,
  calendarId: string,
  meeting: MeetingRecord,
  input: FeishuRecordingRefreshInput
): Promise<{ meetingId: string; meetingNo: string; meetingUrl: string; statusMessage: string }> {
  const previous = meeting.externalMeeting?.provider === "feishu" ? meeting.externalMeeting : undefined;
  let meetingId = input.meetingId?.trim() || previous?.meetingId || "";
  let meetingNo =
    extractFeishuMeetingNo(input.meetingNo || "") ||
    previous?.meetingNo ||
    extractFeishuMeetingNo(previous?.meetingUrl || "") ||
    extractFeishuMeetingNo(meeting.meetingLink || "");
  let meetingUrl = previous?.meetingUrl || meeting.meetingLink || "";

  if (!meetingUrl && previous?.calendarEventId) {
    const event = await fetchFeishuCalendarEvent(accessToken, calendarId, previous.calendarEventId);
    if (event?.vchat?.meeting_url) {
      meetingUrl = event.vchat.meeting_url;
      meetingNo = extractFeishuMeetingNo(meetingUrl) || meetingNo;
    }
  }

  if (!meetingId && meetingNo) {
    const startMs = new Date(meeting.startAt).getTime();
    const endMs = new Date(meeting.endAt).getTime();
    const startTime = Math.floor((Number.isFinite(startMs) ? startMs : Date.now()) / 1000) - 12 * 3600;
    const endTime = Math.floor((Number.isFinite(endMs) ? endMs : Date.now()) / 1000) + 12 * 3600;
    const url = new URL(FEISHU_MEETING_LIST_BY_NO_URL);
    url.searchParams.set("meeting_no", meetingNo);
    url.searchParams.set("start_time", String(startTime));
    url.searchParams.set("end_time", String(endTime));
    url.searchParams.set("page_size", "20");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const data = (await response.json()) as FeishuMeetingListResponse;
    if (!response.ok || data.code !== 0) {
      const code = typeof data.code === "number" && data.code !== 0 ? `（错误码：${data.code}）` : "";
      throw new Error(`${data.msg || "查询飞书会中实例失败"}${code}`);
    }

    const briefs = data.data?.meeting_briefs ?? [];
    const latest = briefs[0];
    if (latest?.id) {
      meetingId = latest.id;
      meetingUrl = latest.url || meetingUrl;
      meetingNo = latest.meeting_no || meetingNo;
    }
  }

  if (!meetingId) {
    return {
      meetingId: "",
      meetingNo,
      meetingUrl,
      statusMessage: meetingNo
        ? "已有会议号，但尚未查询到会中实例（会议开始后才会生成 meeting_id）。"
        : "尚未绑定飞书视频会议号，请先同步飞书日历并开启视频会议。"
    };
  }

  return {
    meetingId,
    meetingNo,
    meetingUrl,
    statusMessage: "已解析飞书会中实例，正在检查录制状态。"
  };
}

type FeishuMeetingDetailResponse = {
  code?: number;
  msg?: string;
  data?: {
    meeting?: {
      id?: string;
      note_id?: string;
      url?: string;
      meeting_no?: string;
      related_artifacts?: {
        note_doc_token?: string;
        verbatim_doc_token?: string;
      };
    };
  };
};

async function fetchFeishuMeetingArtifacts(accessToken: string, meetingId: string) {
  const url = new URL(`${FEISHU_MEETING_RECORDING_URL}/${encodeURIComponent(meetingId)}`);
  url.searchParams.set("query_mode", "1");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const data = (await response.json()) as FeishuMeetingDetailResponse;
  if (!response.ok || data.code !== 0) {
    return null;
  }
  return data.data?.meeting ?? null;
}

async function fetchFeishuMeetingBasic(accessToken: string, meetingId: string) {
  const response = await fetch(`${FEISHU_MEETING_RECORDING_URL}/${encodeURIComponent(meetingId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const data = (await response.json()) as FeishuMeetingDetailResponse;
  if (!response.ok || data.code !== 0) {
    return null;
  }
  return data.data?.meeting ?? null;
}

async function fetchFeishuMinuteTranscript(accessToken: string, minuteToken: string) {
  const url = new URL(`${FEISHU_MINUTES_TRANSCRIPT_URL}/${encodeURIComponent(minuteToken)}/transcript`);
  url.searchParams.set("need_speaker", "true");
  url.searchParams.set("need_timestamp", "false");
  url.searchParams.set("file_format", "txt");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = (await response.json()) as { code?: number; msg?: string };
    if (!response.ok || (typeof data.code === "number" && data.code !== 0)) {
      return {
        text: "",
        status: "pending" as const,
        message: data.msg || "妙记转写尚未就绪"
      };
    }
  }

  if (!response.ok) {
    return {
      text: "",
      status: "pending" as const,
      message: "拉取妙记转写失败，请稍后重试或检查 minutes:minutes.transcript:export 权限"
    };
  }

  const text = (await response.text()).trim();
  if (!text) {
    return {
      text: "",
      status: "pending" as const,
      message: "妙记转写内容为空，可能仍在生成中"
    };
  }

  return {
    text,
    status: "ready" as const,
    message: "已拉取飞书妙记转写"
  };
}

async function enrichWithFeishuTranscript(
  accessToken: string,
  meetingId: string,
  previous: MeetingExternalMeeting
): Promise<Pick<MeetingExternalMeeting, "transcriptStatus" | "transcriptText" | "statusMessage">> {
  if (previous.transcriptText.trim()) {
    return {
      transcriptStatus: "ready",
      transcriptText: previous.transcriptText,
      statusMessage: "飞书录音与转写已就绪，可整理纪要。"
    };
  }

  const basic = await fetchFeishuMeetingBasic(accessToken, meetingId);
  const artifacts = await fetchFeishuMeetingArtifacts(accessToken, meetingId);
  const minuteToken =
    basic?.note_id?.trim() ||
    artifacts?.note_id?.trim() ||
    artifacts?.related_artifacts?.note_doc_token?.trim() ||
    artifacts?.related_artifacts?.verbatim_doc_token?.trim() ||
    "";

  if (!minuteToken) {
    return {
      transcriptStatus: "pending",
      transcriptText: "",
      statusMessage: "飞书录音已就绪，妙记/转写尚未生成，可稍后再次刷新；纪要节点已可继续（将结合录音链接与会前材料）。"
    };
  }

  const transcript = await fetchFeishuMinuteTranscript(accessToken, minuteToken);
  if (transcript.status === "ready") {
    return {
      transcriptStatus: "ready",
      transcriptText: transcript.text,
      statusMessage: "飞书录音与转写已就绪，可整理纪要。"
    };
  }

  return {
    transcriptStatus: "pending",
    transcriptText: "",
    statusMessage: `飞书录音已就绪。${transcript.message}`
  };
}

export async function refreshFeishuMeetingRecording(
  userId: string,
  meeting: MeetingRecord,
  input: FeishuRecordingRefreshInput = {}
): Promise<MeetingExternalMeeting> {
  const { account, config } = await getValidFeishuAccount(userId);
  const previous = meeting.externalMeeting?.provider === "feishu"
    ? meeting.externalMeeting
    : {
        provider: "feishu" as const,
        calendarEventId: meeting.externalCalendar?.provider === "feishu" ? meeting.externalCalendar.eventId : "",
        meetingUrl: meeting.meetingLink || "",
        meetingNo: extractFeishuMeetingNo(meeting.meetingLink || ""),
        meetingId: "",
        recordingStatus: "none" as const,
        transcriptStatus: "none" as const,
        recordingUrl: "",
        transcriptText: "",
        lastSyncedAt: "",
        statusMessage: ""
      };

  const resolved = await resolveFeishuMeetingId(account.accessToken, config.calendarId, meeting, input);
  const now = new Date().toISOString();

  if (!resolved.meetingId) {
    return {
      ...previous,
      meetingUrl: resolved.meetingUrl || previous.meetingUrl,
      meetingNo: resolved.meetingNo || previous.meetingNo,
      meetingId: "",
      recordingStatus: "pending",
      lastSyncedAt: now,
      statusMessage: resolved.statusMessage
    };
  }

  const response = await fetch(
    `${FEISHU_MEETING_RECORDING_URL}/${encodeURIComponent(resolved.meetingId)}/recording`,
    {
      headers: {
        Authorization: `Bearer ${account.accessToken}`
      }
    }
  );
  const data = (await response.json()) as FeishuRecordingResponse;
  const recordingUrl = data.data?.recording?.url?.trim() || previous.recordingUrl || "";

  // Event payload may already provide recording URL even if GET still lags.
  const eventRecordingUrl = input.recordingUrl?.trim() || "";
  const effectiveRecordingUrl = recordingUrl || eventRecordingUrl;

  if ((!response.ok || data.code !== 0 || !effectiveRecordingUrl) && !eventRecordingUrl) {
    const processing = data.code === 124002;
    const message = data.msg || (processing ? "录制文件生成中" : "尚未拿到录制文件");
    return {
      ...previous,
      meetingUrl: resolved.meetingUrl || previous.meetingUrl,
      meetingNo: resolved.meetingNo || previous.meetingNo,
      meetingId: resolved.meetingId,
      recordingStatus: "pending",
      recordingUrl: previous.recordingUrl || "",
      lastSyncedAt: now,
      statusMessage: `${message}${typeof data.code === "number" && data.code !== 0 ? `（错误码：${data.code}）` : ""}`
    };
  }

  const base: MeetingExternalMeeting = {
    ...previous,
    meetingUrl: resolved.meetingUrl || previous.meetingUrl,
    meetingNo: resolved.meetingNo || previous.meetingNo,
    meetingId: resolved.meetingId,
    recordingStatus: "ready",
    recordingUrl: effectiveRecordingUrl,
    lastSyncedAt: now,
    statusMessage: "飞书录音已就绪，正在拉取转写…"
  };

  const transcript = await enrichWithFeishuTranscript(account.accessToken, resolved.meetingId, base);
  return {
    ...base,
    ...transcript
  };
}
