import type { MeetingRecord } from "@meeting-flow/shared";
import {
  getIntegrationAccount,
  saveIntegrationAccount,
  type IntegrationAccount
} from "../integrationStore.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GoogleCalendarEventResponse = {
  id: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
};

export function getGoogleConfig() {
  const clientId = process.env["GOOGLE_CLIENT_ID"] ?? "";
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"] ?? "";
  const redirectUri =
    process.env["GOOGLE_REDIRECT_URI"] ??
    `http://${process.env["HOST"] ?? "127.0.0.1"}:${process.env["PORT"] ?? "8787"}/api/integrations/google/callback`;

  return {
    clientId,
    clientSecret,
    redirectUri,
    isConfigured: Boolean(clientId && clientSecret)
  };
}

export function buildGoogleAuthUrl(state: string) {
  const config = getGoogleConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function requestGoogleToken(params: Record<string, string>) {
  const config = getGoogleConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...params
    })
  });
  const data = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Google 授权失败");
  }

  return data;
}

function expiresAtFromNow(expiresInSeconds = 3600) {
  return new Date(Date.now() + Math.max(60, expiresInSeconds - 60) * 1000).toISOString();
}

export async function exchangeGoogleCode(userId: string, code: string) {
  const config = getGoogleConfig();
  const token = await requestGoogleToken({
    code,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code"
  });
  const now = new Date().toISOString();
  const account: IntegrationAccount = {
    userId,
    provider: "google",
    accessToken: token.access_token ?? "",
    refreshToken: token.refresh_token ?? "",
    expiresAt: expiresAtFromNow(token.expires_in),
    scope: token.scope ?? CALENDAR_SCOPE,
    createdAt: now,
    updatedAt: now
  };

  await saveIntegrationAccount(account);
  return account;
}

async function refreshGoogleAccessToken(account: IntegrationAccount) {
  if (!account.refreshToken) {
    throw new Error("Google 授权缺少 refresh token，请重新连接 Google Calendar");
  }

  const token = await requestGoogleToken({
    refresh_token: account.refreshToken,
    grant_type: "refresh_token"
  });
  const updatedAccount: IntegrationAccount = {
    ...account,
    accessToken: token.access_token ?? account.accessToken,
    expiresAt: expiresAtFromNow(token.expires_in),
    scope: token.scope ?? account.scope,
    updatedAt: new Date().toISOString()
  };

  await saveIntegrationAccount(updatedAccount);
  return updatedAccount;
}

function buildGoogleEvent(meeting: MeetingRecord) {
  const participants = meeting.participants
    .map((participant) => `${participant.name}（${participant.role} / ${participant.status}）`)
    .join("\n");
  const agenda = meeting.agendaItems.map((item) => `- ${item.title}`).join("\n");
  const description = [
    meeting.description,
    "",
    `会议目标：${meeting.meetingGoal}`,
    agenda ? `议程：\n${agenda}` : "",
    participants ? `参会人：\n${participants}` : "",
    meeting.notes ? `备注：${meeting.notes}` : "",
    "由 Meeting Flow Studio 同步。"
  ].filter(Boolean).join("\n\n");

  return {
    summary: meeting.title,
    description,
    location: meeting.location || undefined,
    start: {
      dateTime: meeting.startAt
    },
    end: {
      dateTime: meeting.endAt
    },
    extendedProperties: {
      private: {
        meetingFlowId: meeting.id
      }
    },
    conferenceData: meeting.externalCalendar?.eventId
      ? undefined
      : {
          createRequest: {
            requestId: `${meeting.id}-${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, "-"),
            conferenceSolutionKey: {
              type: "hangoutsMeet"
            }
          }
        }
  };
}

function extractMeetLink(event: GoogleCalendarEventResponse) {
  return (
    event.hangoutLink ||
    event.conferenceData?.entryPoints?.find((entryPoint) => entryPoint.entryPointType === "video")?.uri ||
    ""
  );
}

export async function syncGoogleCalendarEvent(userId: string, meeting: MeetingRecord) {
  const config = getGoogleConfig();

  if (!config.isConfigured) {
    throw new Error("服务端未配置 Google Calendar OAuth，无法同步日历");
  }

  const account = await getIntegrationAccount(userId, "google");

  if (!account) {
    throw new Error("请先连接 Google Calendar，完成用户授权后再同步会议。");
  }

  const validAccount = new Date(account.expiresAt).getTime() <= Date.now()
    ? await refreshGoogleAccessToken(account)
    : account;
  const eventBody = buildGoogleEvent(meeting);
  const existingEventId = meeting.externalCalendar?.provider === "google" ? meeting.externalCalendar.eventId : "";
  const url = existingEventId
    ? `${GOOGLE_CALENDAR_EVENTS_URL}/${encodeURIComponent(existingEventId)}?conferenceDataVersion=1&sendUpdates=none`
    : `${GOOGLE_CALENDAR_EVENTS_URL}?conferenceDataVersion=1&sendUpdates=none`;
  const response = await fetch(url, {
    method: existingEventId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${validAccount.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(eventBody)
  });
  const data = (await response.json()) as GoogleCalendarEventResponse & { error?: { message?: string } };

  if (!response.ok || !data.id) {
    throw new Error(data.error?.message ?? "Google Calendar 同步失败");
  }

  return {
    provider: "google" as const,
    eventId: data.id,
    htmlLink: data.htmlLink ?? "",
    hangoutLink: extractMeetLink(data),
    syncedAt: new Date().toISOString()
  };
}
