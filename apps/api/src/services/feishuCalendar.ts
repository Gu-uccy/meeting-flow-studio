import type { MeetingExternalCalendar, MeetingRecord } from "@meeting-flow/shared";
import {
  getIntegrationAccount,
  saveIntegrationAccount,
  type IntegrationAccount
} from "../integrationStore.js";
import { buildMockCalendarEvent } from "./mockCalendar.js";

const FEISHU_AUTH_URL = "https://open.feishu.cn/open-apis/authen/v1/authorize";
const FEISHU_TOKEN_URL = "https://open.feishu.cn/open-apis/authen/v2/oauth/token";
const FEISHU_CALENDAR_EVENT_URL = "https://open.feishu.cn/open-apis/calendar/v4/calendars";
const DEFAULT_TIMEZONE = "Asia/Shanghai";
export const REQUIRED_FEISHU_OAUTH_SCOPES = ["calendar:calendar", "calendar:calendar.event:create"];
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

type FeishuCalendarEventResponse = {
  code?: number;
  msg?: string;
  data?: {
    event?: {
      event_id?: string;
      app_link?: string;
      html_link?: string;
    };
  };
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
    "由 Meeting Flow Studio 同步。"
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
    }
  };
}

export function getMissingFeishuCalendarScopes(account: Pick<IntegrationAccount, "scope">) {
  const scopes = new Set(account.scope.split(/\s+/).filter(Boolean));
  return REQUIRED_FEISHU_OAUTH_SCOPES.filter((scope) => !scopes.has(scope));
}

function assertFeishuCalendarScopes(account: IntegrationAccount) {
  const missingScopes = getMissingFeishuCalendarScopes(account);

  if (missingScopes.length > 0) {
    throw new Error(`当前飞书授权缺少日历权限，请重新点击“连接飞书”授权：${missingScopes.join(", ")}`);
  }
}

function extractFeishuEventLink(data: FeishuCalendarEventResponse) {
  return data.data?.event?.app_link ?? data.data?.event?.html_link ?? "";
}

export async function syncFeishuCalendarEvent(userId: string, meeting: MeetingRecord): Promise<MeetingExternalCalendar> {
  const config = getFeishuConfig();

  if (!config.isConfigured) {
    return buildMockCalendarEvent(meeting, "feishu");
  }

  const account = await getIntegrationAccount(userId, "feishu");

  if (!account) {
    throw new Error("请先连接飞书，完成用户授权后再同步会议。");
  }

  const validAccount = new Date(account.expiresAt).getTime() <= Date.now()
    ? await refreshFeishuAccessToken(account)
    : account;
  assertFeishuCalendarScopes(validAccount);

  const existingEventId = meeting.externalCalendar?.provider === "feishu" ? meeting.externalCalendar.eventId : "";
  const baseUrl = `${FEISHU_CALENDAR_EVENT_URL}/${encodeURIComponent(config.calendarId)}/events`;
  const url = existingEventId ? `${baseUrl}/${encodeURIComponent(existingEventId)}` : baseUrl;
  const response = await fetch(url, {
    method: existingEventId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${validAccount.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildFeishuEvent(meeting))
  });
  const data = (await response.json()) as FeishuCalendarEventResponse;

  if (!response.ok || data.code !== 0 || !data.data?.event?.event_id) {
    const code = typeof data.code === "number" && data.code !== 0 ? `（错误码：${data.code}）` : "";
    throw new Error(`${data.msg || "飞书日历同步失败"}${code}`);
  }

  return {
    provider: "feishu",
    eventId: data.data.event.event_id,
    htmlLink: extractFeishuEventLink(data),
    hangoutLink: "",
    syncedAt: new Date().toISOString()
  };
}
