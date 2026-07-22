import { useMemo } from "react";
import {
  meetingStatusLabels,
  meetingTypeLabels,
  type MeetingRecord,
  type MeetingStatus,
  type MeetingType
} from "@meeting-flow/shared";
import { formatDateRange } from "../../lib/format";
import type { MeetingSortBy } from "../../hooks/useMeetings";
import { Dropdown } from "../common/Dropdown";
import { MeetingCardSkeleton } from "../common/LoadingSkeleton";
import { SelectableCardList } from "../common/SelectableCardList";

const quickStatusFilters: Array<MeetingStatus | "all"> = ["all", "scheduled", "in_progress", "completed"];

export type MeetingBrowserProps = {
  dateFilter: string;
  isLoading: boolean;
  meetings: MeetingRecord[];
  organizerFilter: string;
  organizerOptions: string[];
  searchQuery: string;
  selectedMeetingId: string | null;
  sortBy: MeetingSortBy;
  statusFilter: MeetingStatus | "all";
  typeFilter: MeetingType | "all";
  onDateFilterChange: (value: string) => void;
  onOrganizerFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSelectMeeting: (meetingId: string) => void;
  onSortByChange: (value: MeetingSortBy) => void;
  onStatusFilterChange: (status: MeetingStatus | "all") => void;
  onTypeFilterChange: (type: MeetingType | "all") => void;
};

export function MeetingBrowser({
  dateFilter,
  isLoading,
  meetings,
  organizerFilter,
  organizerOptions,
  searchQuery,
  selectedMeetingId,
  sortBy,
  statusFilter,
  typeFilter,
  onDateFilterChange,
  onOrganizerFilterChange,
  onSearchChange,
  onSelectMeeting,
  onSortByChange,
  onStatusFilterChange,
  onTypeFilterChange
}: MeetingBrowserProps) {
  const meetingCards = useMemo(
    () =>
      meetings.map((meeting) => ({
        id: meeting.id,
        title: meeting.title,
        badge: meetingStatusLabels[meeting.status],
        badgeClassName: `status-badge status-badge--${meeting.status}`,
        description: meeting.meetingGoal || meeting.notes || "暂无会议说明",
        meta: (
          <>
            <span>{formatDateRange(meeting.startAt, meeting.endAt)}</span>
            <span>{meeting.host}</span>
            <span>{meetingTypeLabels[meeting.type]}</span>
          </>
        ),
        className: "selectable-card--badge-leading selectable-card--title-clamp"
      })),
    [meetings]
  );

  return (
    <section className="meeting-browser" aria-label="会议浏览" data-testid="meeting-browser">
      <header className="meeting-browser__toolbar">
        <label className="meeting-browser__search" htmlFor="meeting-browser-search">
          <span className="sr-only">搜索会议</span>
          <input
            autoComplete="off"
            id="meeting-browser-search"
            name="meeting-browser-filter"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="搜索会议标题、组织者…"
            type="search"
            value={searchQuery}
          />
        </label>

        <div className="meeting-browser__filters" aria-label="状态筛选">
          {quickStatusFilters.map((status) => (
            <button
              className={`filter-chip${statusFilter === status ? " is-active" : ""}`}
              key={status}
              onClick={() => onStatusFilterChange(status)}
              type="button"
            >
              {status === "all" ? "全部" : meetingStatusLabels[status]}
            </button>
          ))}
        </div>

        <div className="meeting-browser__advanced">
          <label>
            <span>日期</span>
            <input onChange={(event) => onDateFilterChange(event.target.value)} type="date" value={dateFilter} />
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
      </header>

      <div className="meeting-browser__grid" data-testid="meeting-browser-grid">
        {isLoading ? (
          <>
            <MeetingCardSkeleton />
            <MeetingCardSkeleton />
            <MeetingCardSkeleton />
          </>
        ) : (
          <SelectableCardList
            activeClassName="is-selected"
            ariaLabel="会议卡片"
            className="meeting-browser__card-list"
            empty={
              <div className="meeting-browser__empty">
                <strong>暂无会议</strong>
                <p>调整筛选条件，或通过顶栏新建会议。</p>
              </div>
            }
            items={meetingCards}
            layout="grid"
            onSelect={onSelectMeeting}
            selectedId={selectedMeetingId}
          />
        )}
      </div>
    </section>
  );
}
