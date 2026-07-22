import { useMemo, type ReactNode } from "react";
import { meetingStatusLabels, type MeetingRecord } from "@meeting-flow/shared";
import { Dropdown } from "../common/Dropdown";

type MeetingSelectorBarProps = {
  actions?: ReactNode;
  isLoading: boolean;
  meetings: MeetingRecord[];
  selectedMeeting: MeetingRecord | null;
  selectedMeetingId: string | null;
  searchQuery: string;
  showCreateButton?: boolean;
  onCreateMeeting: () => void;
  onSelectMeeting: (meetingId: string) => void;
  onSearchChange: (value: string) => void;
};

export function MeetingSelectorBar({
  actions,
  isLoading,
  meetings,
  selectedMeeting,
  selectedMeetingId,
  searchQuery,
  showCreateButton = true,
  onCreateMeeting,
  onSelectMeeting,
  onSearchChange
}: MeetingSelectorBarProps) {
  const meetingOptions = useMemo(() => {
    const options = meetings.map((meeting) => ({
      label: meeting.title,
      value: meeting.id
    }));

    if (
      selectedMeetingId &&
      selectedMeeting &&
      !options.some((option) => option.value === selectedMeetingId)
    ) {
      return [{ label: selectedMeeting.title, value: selectedMeeting.id }, ...options];
    }

    return options;
  }, [meetings, selectedMeeting, selectedMeetingId]);

  return (
    <div className="meeting-selector" aria-label="会议选择" data-testid="meeting-selector">
      <div className="meeting-selector__picker">
        <input
          aria-label="搜索会议"
          autoComplete="off"
          className="meeting-selector__search"
          name="meeting-title-filter"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="搜索"
          type="search"
          value={searchQuery}
        />

        {isLoading ? (
          <span className="meeting-selector__status">加载中…</span>
        ) : (
          <Dropdown
            ariaLabel="选择会议"
            disabled={meetings.length === 0}
            onChange={onSelectMeeting}
            options={meetingOptions.length > 0 ? meetingOptions : [{ label: "暂无会议", value: "", disabled: true }]}
            value={selectedMeetingId ?? meetings[0]?.id ?? ""}
          />
        )}

        {selectedMeeting ? (
          <span className="meeting-selector__badge">{meetingStatusLabels[selectedMeeting.status]}</span>
        ) : null}
      </div>

      {showCreateButton ? (
        <button
          aria-label="新建会议"
          className="meeting-selector__create"
          onClick={onCreateMeeting}
          title="新建会议"
          type="button"
        >
          +
        </button>
      ) : null}

      {actions}
    </div>
  );
}
