import {
  meetingPriorityLabels,
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
    <aside className="meeting-queue panel-card" aria-label="会议队列">
      <div className="section-title section-title--compact">
        <div>
          <h2>会议队列</h2>
          <p>{isLoading ? "加载中..." : `${meetings.length} 场会议`}</p>
        </div>
      </div>

      <label className="command-search" htmlFor="panel-search">
        <span className="sr-only">搜索会议</span>
        <input
          id="panel-search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="搜索会议、负责人或标签"
          type="search"
        />
      </label>

      <div className="filter-strip" aria-label="状态筛选">
        <button
          className={`filter-chip${statusFilter === "all" ? " is-active" : ""}`}
          onClick={() => onStatusFilterChange("all")}
          type="button"
        >
          全部
        </button>
        {meetingStatusValues.map((status) => (
          <button
            key={status}
            className={`filter-chip${statusFilter === status ? " is-active" : ""}`}
            onClick={() => onStatusFilterChange(status)}
            type="button"
          >
            {meetingStatusLabels[status]}
          </button>
        ))}
      </div>

      <details className="queue-controls queue-controls--advanced">
        <summary>更多筛选</summary>
        <div className="queue-controls__fields">
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
            <p>调整筛选条件，或新建一场会议开始编排流程。</p>
          </div>
        )}
        {!isLoading &&
          meetings.map((meeting) => (
            <button
              key={meeting.id}
              className={`meeting-card${selectedMeetingId === meeting.id ? " is-selected" : ""}`}
              onClick={() => onSelectMeeting(meeting.id)}
              type="button"
            >
              <div className="meeting-card__topline">
                <span className={`status-badge status-badge--${meeting.status}`}>
                  {meetingStatusLabels[meeting.status]}
                </span>
                <span className="meeting-card__type">{meetingTypeLabels[meeting.type]}</span>
                <span className={`priority-badge priority-badge--${meeting.priority}`}>
                  {meetingPriorityLabels[meeting.priority]}
                </span>
              </div>
              <strong className="meeting-card__title">{meeting.title}</strong>
              <p className="meeting-card__summary">{meeting.description}</p>
              <div className="meeting-card__meta">
                <span>{formatDateRange(meeting.startAt, meeting.endAt)}</span>
                <span>
                  {meeting.host} / {meeting.attendeeCount} 人
                </span>
              </div>
              <div className="tag-row">
                {meeting.tags.slice(0, 3).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
                {meeting.tags.length === 0 && <span>暂无标签</span>}
              </div>
            </button>
          ))}
      </div>
    </aside>
  );
}
