import {
  meetingStatusLabels,
  meetingStatusValues,
  meetingTypeLabels,
  type MeetingRecord,
  type MeetingStatus,
  type MeetingType
} from "@meeting-flow/shared";
import { formatDateRange } from "../../lib/format";
import type { MeetingSortBy } from "../../hooks/useMeetings";
import { Dropdown } from "../common/Dropdown";
import { MeetingCardSkeleton } from "../common/LoadingSkeleton";

const quickStatusFilters: Array<MeetingStatus | "all"> = ["all", "scheduled", "in_progress", "completed"];

type MeetingListPanelProps = {
  isLoading: boolean;
  meetings: MeetingRecord[];
  selectedMeetingId: string | null;
  statusFilter: MeetingStatus | "all";
  typeFilter: MeetingType | "all";
  organizerFilter: string;
  organizerOptions: string[];
  dateFilter: string;
  sortBy: MeetingSortBy;
  searchQuery: string;
  onSelectMeeting: (meetingId: string) => void;
  onStatusFilterChange: (status: MeetingStatus | "all") => void;
  onTypeFilterChange: (type: MeetingType | "all") => void;
  onOrganizerFilterChange: (value: string) => void;
  onDateFilterChange: (value: string) => void;
  onSortByChange: (value: MeetingSortBy) => void;
  onSearchChange: (value: string) => void;
};

export function MeetingListPanel({
  isLoading,
  meetings,
  selectedMeetingId,
  statusFilter,
  typeFilter,
  organizerFilter,
  organizerOptions,
  dateFilter,
  sortBy,
  searchQuery,
  onSelectMeeting,
  onStatusFilterChange,
  onTypeFilterChange,
  onOrganizerFilterChange,
  onDateFilterChange,
  onSortByChange,
  onSearchChange
}: MeetingListPanelProps) {
  return (
    <aside className="meeting-queue panel-card meeting-queue--compact" aria-label="会议列表">
      <label className="command-search" htmlFor="panel-search">
        <span className="sr-only">搜索会议</span>
        <input
          id="panel-search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="搜索会议"
          type="search"
        />
      </label>

      <div className="filter-strip filter-strip--compact" aria-label="状态筛选">
        {quickStatusFilters.map((status) => (
          <button
            key={status}
            className={`filter-chip${statusFilter === status ? " is-active" : ""}`}
            onClick={() => onStatusFilterChange(status)}
            type="button"
          >
            {status === "all" ? "全部" : meetingStatusLabels[status]}
          </button>
        ))}
      </div>

      <details className="queue-controls queue-controls--advanced">
        <summary>筛选</summary>
        <div className="queue-controls__fields">
          <label>
            <span>状态</span>
            <Dropdown
              onChange={(value) => onStatusFilterChange(value as MeetingStatus | "all")}
              options={[
                { label: "全部状态", value: "all" },
                ...meetingStatusValues.map((status) => ({
                  label: meetingStatusLabels[status],
                  value: status
                }))
              ]}
              value={statusFilter}
            />
          </label>
          <label>
            <span>日期</span>
            <input type="date" value={dateFilter} onChange={(event) => onDateFilterChange(event.target.value)} />
          </label>
          <label>
            <span>类型</span>
            <Dropdown
              onChange={(value) => onTypeFilterChange(value as MeetingType | "all")}
              options={[
                { label: "全部类型", value: "all" },
                ...Object.entries(meetingTypeLabels).map(([value, label]) => ({
                  label,
                  value: value as MeetingType
                }))
              ]}
              value={typeFilter}
            />
          </label>
          <label>
            <span>组织者</span>
            <Dropdown
              onChange={onOrganizerFilterChange}
              options={[
                { label: "全部组织者", value: "all" },
                ...organizerOptions.map((organizer) => ({
                  label: organizer,
                  value: organizer
                }))
              ]}
              value={organizerFilter}
            />
          </label>
          <label>
            <span>排序</span>
            <Dropdown
              onChange={(value) => onSortByChange(value as MeetingSortBy)}
              options={[
                { label: "开始时间", value: "startAt" },
                { label: "创建时间", value: "createdAt" },
                { label: "更新时间", value: "updatedAt" }
              ]}
              value={sortBy}
            />
          </label>
        </div>
      </details>

      <div className="meeting-list scroll-area">
        {isLoading && (
          <>
            <MeetingCardSkeleton />
            <MeetingCardSkeleton />
            <MeetingCardSkeleton />
          </>
        )}
        {!isLoading && meetings.length === 0 && (
          <div className="empty-state empty-state--panel">
            <strong>暂无会议</strong>
            <p>调整筛选或新建会议。</p>
          </div>
        )}
        {!isLoading &&
          meetings.map((meeting) => (
            <button
              key={meeting.id}
              className={`meeting-card meeting-card--compact${selectedMeetingId === meeting.id ? " is-selected" : ""}`}
              onClick={() => onSelectMeeting(meeting.id)}
              type="button"
            >
              <div className="meeting-card__topline">
                <span className={`status-badge status-badge--${meeting.status}`}>
                  {meetingStatusLabels[meeting.status]}
                </span>
                <span className="meeting-card__type">{meetingTypeLabels[meeting.type]}</span>
              </div>
              <strong className="meeting-card__title">{meeting.title}</strong>
              <div className="meeting-card__meta">
                <span>{formatDateRange(meeting.startAt, meeting.endAt)}</span>
                <span>{meeting.host}</span>
              </div>
            </button>
          ))}
      </div>
    </aside>
  );
}
