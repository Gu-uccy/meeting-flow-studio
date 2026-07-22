import type { MeetingPermissions } from "@meeting-flow/shared";

type MeetingReadOnlyBannerProps = {
  meeting?: { permissions: MeetingPermissions } | null;
};

export function MeetingReadOnlyBanner({ meeting }: MeetingReadOnlyBannerProps) {
  if (!meeting || meeting.permissions.canEdit) {
    return null;
  }

  return (
    <div className="meeting-readonly-banner" role="status">
      只读模式 · 仅可查看当前会议内容
    </div>
  );
}
