import { useEffect, useMemo, useState } from "react";
import { apiClient, readJson } from "../lib/apiClient";
import {
  type CreateMeetingInput,
  type ActionItemStatus,
  type MeetingAgendaItemInput,
  type MeetingDashboardSummary,
  type MeetingNotificationState,
  type MeetingParticipantInput,
  type MeetingRecordWithPermissions,
  type MeetingStatus,
  type MeetingType,
  type ParticipantRole,
  type ParticipantStatus,
  type UpdateMeetingInput
} from "@meeting-flow/shared";
import { toDateInputValue } from "../lib/format";

type MeetingsResponse = {
  items: MeetingRecordWithPermissions[];
  summary: MeetingDashboardSummary;
};

type MeetingMutationResponse = {
  meeting: MeetingRecordWithPermissions;
  summary: MeetingDashboardSummary;
  message: string;
};

type DeleteMeetingResponse = {
  deletedId: string;
  summary: MeetingDashboardSummary;
  message: string;
};

export type MeetingSortBy = "startAt" | "createdAt" | "updatedAt";

const emptySummary: MeetingDashboardSummary = {
  total: 0,
  draft: 0,
  scheduled: 0,
  inProgress: 0,
  completed: 0,
  cancelled: 0
};

function createInitialParticipant(
  role: ParticipantRole = "attendee",
  status: ParticipantStatus = "pending"
): MeetingParticipantInput {
  return {
    name: "",
    role,
    status
  };
}

function createInitialAgendaItem(): MeetingAgendaItemInput {
  return {
    title: "",
    completed: false
  };
}

const initialForm: CreateMeetingInput = {
  title: "",
  type: "project",
  tags: [],
  host: "",
  owner: "",
  description: "",
  meetingGoal: "",
  channel: "teams",
  startAt: "",
  endAt: "",
  priority: "medium",
  location: "",
  meetingLink: "",
  isRecurring: false,
  recurrence: "",
  participants: [createInitialParticipant("attendee")],
  agendaItems: [createInitialAgendaItem()],
  notes: "",
  submissionMode: "submit"
};

function parseErrorMessage(fallback: string, value: unknown) {
  return value instanceof Error ? value.message : fallback;
}

function sortMeetings(meetings: MeetingRecordWithPermissions[], sortBy: MeetingSortBy) {
  return [...meetings].sort((left, right) => {
    const sortKey = sortBy === "startAt" ? "startAt" : sortBy;
    return new Date(right[sortKey]).getTime() - new Date(left[sortKey]).getTime();
  });
}

function toEditableMeeting(meeting: MeetingRecordWithPermissions): UpdateMeetingInput {
  return {
    title: meeting.title,
    type: meeting.type,
    tags: meeting.tags,
    host: meeting.host,
    owner: meeting.owner,
    description: meeting.description,
    meetingGoal: meeting.meetingGoal,
    channel: meeting.channel,
    startAt: meeting.startAt,
    endAt: meeting.endAt,
    priority: meeting.priority,
    status: meeting.status,
    location: meeting.location,
    meetingLink: meeting.meetingLink,
    isRecurring: meeting.isRecurring,
    recurrence: meeting.recurrence,
    participants: meeting.participants.map(({ name, role, status }) => ({ name, role, status })),
    agendaItems: meeting.agendaItems.map(({ title, completed }) => ({ title, completed })),
    notes: meeting.notes,
    minutes: meeting.minutes,
    actionItems: meeting.actionItems.map(({ content, owner, dueDate, status }) => ({
      content,
      owner,
      dueDate,
      status
    })),
    notifications: meeting.notifications
  };
}

function validateMeetingWindow(startAt: string, endAt: string) {
  return new Date(startAt).getTime() < new Date(endAt).getTime();
}

export function useMeetings(isEnabled = true) {
  const [meetings, setMeetings] = useState<MeetingRecordWithPermissions[]>([]);
  const [summary, setSummary] = useState<MeetingDashboardSummary>(emptySummary);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<MeetingStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<MeetingType | "all">("all");
  const [organizerFilter, setOrganizerFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [sortBy, setSortBy] = useState<MeetingSortBy>("startAt");
  const [searchQuery, setSearchQuery] = useState("");
  const [formState, setFormState] = useState<CreateMeetingInput>(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isEnabled) {
      setMeetings([]);
      setSummary(emptySummary);
      setSelectedMeetingId(null);
      setIsLoading(false);
      setError("");
      setFeedback("");
      return;
    }

    void loadMeetings();
  }, [isEnabled]);

  async function loadMeetings() {
    setIsLoading(true);
    setError("");

    try {
      const response = await apiClient("/api/meetings");
      const data = (await readJson(response)) as MeetingsResponse;

      if (!response.ok) {
        throw new Error("会议数据加载失败，请稍后重试。");
      }

      setMeetings(data.items);
      setSummary(data.summary);
      setSelectedMeetingId((currentId) => currentId ?? data.items[0]?.id ?? null);
    } catch (requestError) {
      setError(parseErrorMessage("会议数据加载失败，请稍后重试。", requestError));
    } finally {
      setIsLoading(false);
    }
  }

  async function createMeeting(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback("");
    setError("");

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const submissionMode = submitter?.value === "save" ? "save" : "submit";

    try {
      if (!formState.startAt || !formState.endAt || !validateMeetingWindow(formState.startAt, formState.endAt)) {
        throw new Error("结束时间必须晚于开始时间。");
      }

      if (formState.isRecurring && !formState.recurrence.trim()) {
        throw new Error("重复会议需要填写重复规则。");
      }

      const response = await apiClient("/api/meetings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...formState,
          submissionMode
        })
      });
      const data = (await readJson(response)) as Partial<MeetingMutationResponse> & { message?: string };

      if (!response.ok || !data.meeting || !data.summary) {
        throw new Error(data.message ?? "会议创建失败，请检查输入内容。");
      }

      setMeetings((current) => sortMeetings([data.meeting as MeetingRecordWithPermissions, ...current], sortBy));
      setSummary(data.summary as MeetingDashboardSummary);
      setSelectedMeetingId(data.meeting.id);
      setFormState(initialForm);
      setFeedback(data.message ?? "会议创建成功");
      return true;
    } catch (requestError) {
      setError(parseErrorMessage("会议创建失败，请稍后重试。", requestError));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveMeetingEdits(meetingId: string, meetingInput: UpdateMeetingInput) {
    setIsMutating(true);
    setFeedback("");
    setError("");

    try {
      if (!validateMeetingWindow(meetingInput.startAt, meetingInput.endAt)) {
        throw new Error("结束时间必须晚于开始时间。");
      }

      if (meetingInput.isRecurring && !meetingInput.recurrence.trim()) {
        throw new Error("重复会议需要填写重复规则。");
      }

      const response = await apiClient(`/api/meetings/${meetingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(meetingInput)
      });
      const data = (await readJson(response)) as Partial<MeetingMutationResponse> & { message?: string };

      if (!response.ok || !data.meeting || !data.summary) {
        throw new Error(data.message ?? "会议信息更新失败，请稍后重试。");
      }

      setMeetings((current) =>
        sortMeetings(
          current.map((meeting) => (meeting.id === data.meeting?.id ? (data.meeting as MeetingRecordWithPermissions) : meeting)),
          sortBy
        )
      );
      setSummary(data.summary as MeetingDashboardSummary);
      setSelectedMeetingId(data.meeting.id);
      setFeedback(data.message ?? "会议信息已更新");
      return true;
    } catch (requestError) {
      setError(parseErrorMessage("会议信息更新失败，请稍后重试。", requestError));
      return false;
    } finally {
      setIsMutating(false);
    }
  }

  async function updateMeetingStatus(status: MeetingStatus) {
    if (!selectedMeetingId) {
      return false;
    }

    setIsMutating(true);
    setFeedback("");
    setError("");

    try {
      const response = await apiClient(`/api/meetings/${selectedMeetingId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
      });
      const data = (await readJson(response)) as Partial<MeetingMutationResponse> & { message?: string };

      if (!response.ok || !data.meeting || !data.summary) {
        throw new Error(data.message ?? "会议状态更新失败，请稍后重试。");
      }

      setMeetings((current) =>
        sortMeetings(
          current.map((meeting) => (meeting.id === data.meeting?.id ? (data.meeting as MeetingRecordWithPermissions) : meeting)),
          sortBy
        )
      );
      setSummary(data.summary as MeetingDashboardSummary);
      setSelectedMeetingId(data.meeting.id);
      setFeedback(data.message ?? "会议状态已更新");
      return true;
    } catch (requestError) {
      setError(parseErrorMessage("会议状态更新失败，请稍后重试。", requestError));
      return false;
    } finally {
      setIsMutating(false);
    }
  }

  async function cancelMeeting() {
    return updateMeetingStatus("cancelled");
  }

  async function deleteMeeting() {
    if (!selectedMeetingId) {
      return false;
    }

    setIsMutating(true);
    setFeedback("");
    setError("");

    try {
      const response = await apiClient(`/api/meetings/${selectedMeetingId}`, {
        method: "DELETE"
      });
      const data = (await readJson(response)) as Partial<DeleteMeetingResponse> & { message?: string };

      if (!response.ok || !data.deletedId || !data.summary) {
        throw new Error(data.message ?? "会议删除失败，请稍后重试。");
      }

      setMeetings((current) => current.filter((meeting) => meeting.id !== data.deletedId));
      setSummary(data.summary as MeetingDashboardSummary);
      setFeedback(data.message ?? "会议已删除");
      return true;
    } catch (requestError) {
      setError(parseErrorMessage("会议删除失败，请稍后重试。", requestError));
      return false;
    } finally {
      setIsMutating(false);
    }
  }

  async function updateActionItemStatus(meetingId: string, actionItemId: string, status: ActionItemStatus) {
    const meeting = meetings.find((item) => item.id === meetingId);

    if (!meeting) {
      setError("未找到对应会议，无法更新待办状态。");
      return false;
    }

    const nextInput = toEditableMeeting(meeting);
    const nextActionItems = meeting.actionItems.map((item) => ({
      content: item.content,
      owner: item.owner,
      dueDate: item.dueDate,
      status: item.id === actionItemId ? status : item.status
    }));

    return saveMeetingEdits(meetingId, {
      ...nextInput,
      actionItems: nextActionItems
    });
  }

  async function markNotificationSent(meetingId: string, kind: keyof MeetingNotificationState) {
    const meeting = meetings.find((item) => item.id === meetingId);

    if (!meeting) {
      setError("未找到对应会议，无法更新提醒状态。");
      return false;
    }

    return saveMeetingEdits(meetingId, {
      ...toEditableMeeting(meeting),
      notifications: {
        ...meeting.notifications,
        [kind]: true
      }
    });
  }

  function upsertMeeting(meeting: MeetingRecordWithPermissions, nextSummary: MeetingDashboardSummary) {
    setMeetings((current) => {
      const exists = current.some((item) => item.id === meeting.id);
      const nextItems = exists
        ? current.map((item) => (item.id === meeting.id ? meeting : item))
        : [meeting, ...current];

      return sortMeetings(nextItems, sortBy);
    });
    setSummary(nextSummary);
    setSelectedMeetingId(meeting.id);
  }

  function handleFieldChange<Key extends keyof CreateMeetingInput>(key: Key, value: CreateMeetingInput[Key]) {
    setFormState((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updateFormParticipant(
    index: number,
    key: keyof MeetingParticipantInput,
    value: MeetingParticipantInput[keyof MeetingParticipantInput]
  ) {
    setFormState((current) => ({
      ...current,
      participants: current.participants.map((participant, participantIndex) =>
        participantIndex === index ? { ...participant, [key]: value } : participant
      )
    }));
  }

  function addFormParticipant() {
    setFormState((current) => ({
      ...current,
      participants: [...current.participants, createInitialParticipant()]
    }));
  }

  function removeFormParticipant(index: number) {
    setFormState((current) => ({
      ...current,
      participants:
        current.participants.length === 1
          ? current.participants
          : current.participants.filter((_, participantIndex) => participantIndex !== index)
    }));
  }

  function updateFormAgendaItem(index: number, key: keyof MeetingAgendaItemInput, value: string | boolean) {
    setFormState((current) => ({
      ...current,
      agendaItems: current.agendaItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    }));
  }

  function addFormAgendaItem() {
    setFormState((current) => ({
      ...current,
      agendaItems: [...current.agendaItems, createInitialAgendaItem()]
    }));
  }

  function removeFormAgendaItem(index: number) {
    setFormState((current) => ({
      ...current,
      agendaItems:
        current.agendaItems.length === 1
          ? current.agendaItems
          : current.agendaItems.filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  const organizerOptions = useMemo(
    () => [...new Set(meetings.map((meeting) => meeting.host))].sort((left, right) => left.localeCompare(right)),
    [meetings]
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredMeetings = useMemo(() => {
    const items = meetings.filter((meeting) => {
      const matchesQuery = normalizedQuery ? meeting.title.toLowerCase().includes(normalizedQuery) : true;
      const matchesStatus = statusFilter === "all" ? true : meeting.status === statusFilter;
      const matchesType = typeFilter === "all" ? true : meeting.type === typeFilter;
      const matchesOrganizer = organizerFilter === "all" ? true : meeting.host === organizerFilter;
      const matchesDate = dateFilter ? toDateInputValue(meeting.startAt) === dateFilter : true;

      return matchesQuery && matchesStatus && matchesType && matchesOrganizer && matchesDate;
    });

    return sortMeetings(items, sortBy);
  }, [dateFilter, meetings, normalizedQuery, organizerFilter, sortBy, statusFilter, typeFilter]);

  const selectedMeeting =
    filteredMeetings.find((meeting) => meeting.id === selectedMeetingId) ??
    meetings.find((meeting) => meeting.id === selectedMeetingId) ??
    filteredMeetings[0] ??
    meetings[0] ??
    null;

  useEffect(() => {
    if (meetings.length === 0) {
      setSelectedMeetingId(null);
      return;
    }

    const hasSelectedMeeting = selectedMeetingId ? meetings.some((meeting) => meeting.id === selectedMeetingId) : false;
    if (!hasSelectedMeeting) {
      setSelectedMeetingId(filteredMeetings[0]?.id ?? meetings[0]?.id ?? null);
    }
  }, [filteredMeetings, meetings, selectedMeetingId]);

  return {
    allMeetings: meetings,
    createMeeting,
    deleteMeeting,
    error,
    feedback,
    filteredMeetings,
    formState,
    handleFieldChange,
    addFormAgendaItem,
    addFormParticipant,
    updateFormAgendaItem,
    updateFormParticipant,
    removeFormAgendaItem,
    removeFormParticipant,
    isLoading,
    isSubmitting,
    isMutating,
    organizerFilter,
    organizerOptions,
    dateFilter,
    searchQuery,
    selectedMeeting,
    selectedMeetingEditable: selectedMeeting ? toEditableMeeting(selectedMeeting) : null,
    selectedMeetingId,
    setDateFilter,
    setOrganizerFilter,
    setSearchQuery,
    setSelectedMeetingId,
    setStatusFilter,
    setTypeFilter,
    setSortBy,
    sortBy,
    statusFilter,
    summary,
    typeFilter,
    updateMeetingStatus,
    cancelMeeting,
    saveMeetingEdits,
    upsertMeeting,
    reloadMeetings: loadMeetings,
    updateActionItemStatus,
    markNotificationSent
  };
}
