import type { MeetingExternalCalendar, MeetingRecord } from "@meeting-flow/shared";

export function buildMockCalendarEvent(meeting: MeetingRecord, source = "calendar"): MeetingExternalCalendar {
  const eventPrefix = `mock-${source}-`;

  return {
    provider: "mock",
    eventId: meeting.externalCalendar?.provider === "mock" && meeting.externalCalendar.eventId.startsWith(eventPrefix)
      ? meeting.externalCalendar.eventId
      : `${eventPrefix}${meeting.id}`,
    htmlLink: "",
    hangoutLink: "",
    syncedAt: new Date().toISOString()
  };
}
