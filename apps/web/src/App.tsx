import { useMemo, useState, type FormEvent } from "react";
import {
  meetingFlowProduct,
  userRoleLabels,
  type MeetingRecordWithPermissions,
  type ProductWorkflowRun
} from "@meeting-flow/shared";
import { useAuth } from "./contexts/AuthContext";
import { LandingPage } from "./components/auth/LandingPage";
import { LoginPage } from "./components/auth/LoginPage";
import { RegisterPage } from "./components/auth/RegisterPage";
import { BrandMark } from "./components/common/BrandMark";
import { Modal } from "./components/common/Modal";
import { StatusBanner } from "./components/common/StatusBanner";
import { MeetingCreateForm } from "./components/meetings/MeetingCreateForm";
import { MeetingDetailPanel } from "./components/meetings/MeetingDetailPanel";
import { MeetingListPanel } from "./components/meetings/MeetingListPanel";
import { WorkflowTemplatePanel } from "./components/workflow/WorkflowTemplatePanel";
import { useMeetings } from "./hooks/useMeetings";
import { useGoogleCalendarIntegration } from "./hooks/useGoogleCalendarIntegration";
import { useFeishuCalendarIntegration } from "./hooks/useFeishuCalendarIntegration";
import { useWorkflowLibrary } from "./hooks/useWorkflowLibrary";
import { formatDateTime } from "./lib/format";

function isToday(value: string) {
  const date = new Date(value);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function getBlockedRuns(runs: ProductWorkflowRun[], meetings: MeetingRecordWithPermissions[]) {
  return runs
    .filter((run) => run.status === "blocked" || run.nodeRuns.some((nodeRun) => nodeRun.status === "blocked"))
    .map((run) => {
      const meeting = meetings.find((item) => item.id === run.meetingId);
      const blockedNode = run.nodeRuns.find((nodeRun) => nodeRun.status === "blocked");

      return {
        id: run.id,
        meetingId: run.meetingId,
        meetingTitle: meeting?.title ?? run.name,
        message: blockedNode?.errorMessage ?? "流程等待人工处理",
        name: run.name
      };
    });
}

export default function App() {
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const [authView, setAuthView] = useState<"landing" | "login" | "register">("landing");
  const [workbenchView, setWorkbenchView] = useState<"workspace" | "account">("workspace");

  const {
    addFormAgendaItem,
    addFormParticipant,
    cancelMeeting,
    createMeeting,
    dateFilter,
    deleteMeeting,
    error,
    feedback,
    filteredMeetings,
    formState,
    handleFieldChange,
    isLoading,
    isMutating,
    isSubmitting,
    organizerFilter,
    organizerOptions,
    removeFormAgendaItem,
    removeFormParticipant,
    saveMeetingEdits,
    searchQuery,
    selectedMeeting,
    selectedMeetingEditable,
    selectedMeetingId,
    setDateFilter,
    setOrganizerFilter,
    setSearchQuery,
    setSelectedMeetingId,
    setSortBy,
    setStatusFilter,
    setTypeFilter,
    sortBy,
    statusFilter,
    typeFilter,
    updateFormAgendaItem,
    updateFormParticipant,
    updateMeetingStatus,
    upsertMeeting
  } = useMeetings(Boolean(user));
  const {
    connectGoogleCalendar,
    error: calendarError,
    feedback: calendarFeedback,
    isConnected: isGoogleCalendarConnected,
    isConfigured: isGoogleCalendarConfigured,
    isLoading: isCalendarLoading,
    isMutating: isCalendarMutating,
    redirectUri: googleRedirectUri,
    statusMessage: calendarStatusMessage,
    syncMeeting: syncMeetingToGoogleCalendar
  } = useGoogleCalendarIntegration(Boolean(user), upsertMeeting);
  const {
    connectFeishuCalendar,
    error: feishuCalendarError,
    feedback: feishuCalendarFeedback,
    isConnected: isFeishuCalendarConnected,
    isConfigured: isFeishuCalendarConfigured,
    isLoading: isFeishuCalendarLoading,
    isMutating: isFeishuCalendarMutating,
    redirectUri: feishuRedirectUri,
    statusMessage: feishuCalendarStatusMessage,
    syncMeeting: syncMeetingToFeishuCalendar
  } = useFeishuCalendarIntegration(Boolean(user), upsertMeeting);
  const {
    advanceWorkflowRun,
    cancelWorkflowRun,
    error: workflowError,
    feedback: workflowFeedback,
    isLoading: isWorkflowLoading,
    isMutating: isWorkflowMutating,
    retryWorkflowRun,
    runs: workflowRuns,
    saveTemplateCanvas,
    startWorkflowRun,
    templates: workflowTemplates
  } = useWorkflowLibrary(Boolean(user));
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDetailEditing, setIsDetailEditing] = useState(false);

  const blockedRuns = useMemo(
    () => getBlockedRuns(workflowRuns, filteredMeetings),
    [filteredMeetings, workflowRuns]
  );
  const todayMeetings = filteredMeetings.filter((meeting) => isToday(meeting.startAt));

  async function handleCreateMeeting(event: FormEvent<HTMLFormElement>) {
    const success = await createMeeting(event);

    if (success) {
      setIsCreateModalOpen(false);
    }
  }

  async function handleDeleteMeeting() {
    const success = await deleteMeeting();

    if (success) {
      setIsDetailModalOpen(false);
      setIsDetailEditing(false);
    }

    return success;
  }

  function openMeetingDetail(meetingId: string) {
    setSelectedMeetingId(meetingId);
    setIsDetailEditing(false);
    setIsDetailModalOpen(true);
  }

  function editMeetingDetail(meetingId: string) {
    setSelectedMeetingId(meetingId);
    setIsDetailEditing(true);
    setIsDetailModalOpen(true);
  }

  function closeMeetingDetail() {
    setIsDetailModalOpen(false);
    setIsDetailEditing(false);
  }

  function handleLogout() {
    setAuthView("landing");
    setWorkbenchView("workspace");
    logout();
  }

  if (isAuthLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card__header">
            <h1>Meeting Flow Studio</h1>
            <p>正在加载...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    if (authView === "login" || authView === "register") {
      const isLoginView = authView === "login";

      return (
        <div className={`auth-switch-stage auth-switch-stage--${authView}`}>
          <div className="auth-background" aria-hidden="true">
            <svg className="auth-background__curve" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
              <defs>
                <linearGradient id="auth-flow-line" x1="0" x2="1" y1="1" y2="0">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                  <stop offset="34%" stopColor="#dbeafe" stopOpacity="0.22" />
                  <stop offset="76%" stopColor="#7eb0b8" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
                <radialGradient id="auth-portal-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.88" />
                  <stop offset="42%" stopColor="#7eb0b8" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#8fc0c5" stopOpacity="0" />
                </radialGradient>
              </defs>
              <path
                className="auth-background__plane"
                d="M0 92 C14 82 22 66 40 58 C60 49 77 28 100 5 V100 H0 Z"
              >
                <animate
                  attributeName="d"
                  calcMode="spline"
                  dur="18s"
                  keySplines="0.45 0 0.25 1; 0.45 0 0.25 1; 0.45 0 0.25 1; 0.45 0 0.25 1"
                  keyTimes="0; 0.28; 0.52; 0.78; 1"
                  repeatCount="indefinite"
                  values="
                    M0 92 C14 82 22 66 40 58 C60 49 77 28 100 5 V100 H0 Z;
                    M0 92 C22 78 25 54 45 56 C67 58 76 19 100 5 V100 H0 Z;
                    M0 92 C9 86 26 78 38 66 C55 49 77 38 100 5 V100 H0 Z;
                    M0 92 C19 72 31 67 47 51 C63 35 81 31 100 5 V100 H0 Z;
                    M0 92 C14 82 22 66 40 58 C60 49 77 28 100 5 V100 H0 Z
                  "
                />
              </path>
              <path
                className="auth-background__boundary"
                d="M0 92 C14 82 22 66 40 58 C60 49 77 28 100 5"
                pathLength="1"
              >
                <animate
                  attributeName="d"
                  calcMode="spline"
                  dur="18s"
                  keySplines="0.45 0 0.25 1; 0.45 0 0.25 1; 0.45 0 0.25 1; 0.45 0 0.25 1"
                  keyTimes="0; 0.28; 0.52; 0.78; 1"
                  repeatCount="indefinite"
                  values="
                    M0 92 C14 82 22 66 40 58 C60 49 77 28 100 5;
                    M0 92 C22 78 25 54 45 56 C67 58 76 19 100 5;
                    M0 92 C9 86 26 78 38 66 C55 49 77 38 100 5;
                    M0 92 C19 72 31 67 47 51 C63 35 81 31 100 5;
                    M0 92 C14 82 22 66 40 58 C60 49 77 28 100 5
                  "
                />
              </path>
              <g className="auth-background__portal" transform="translate(96 9)">
                <circle className="auth-background__portal-glow" r="7" />
                <circle className="auth-background__portal-ring auth-background__portal-ring--outer" r="3.2" />
                <circle className="auth-background__portal-ring auth-background__portal-ring--inner" r="1.7" />
              </g>
            </svg>
          </div>
          <LoginPage
            isActive={isLoginView}
            onBackToLanding={() => setAuthView("landing")}
            onSwitchToRegister={() => setAuthView("register")}
          />
          <RegisterPage
            isActive={!isLoginView}
            onBackToLanding={() => setAuthView("landing")}
            onSwitchToLogin={() => setAuthView("login")}
          />
        </div>
      );
    }

    return (
      <LandingPage
        onLoginClick={() => setAuthView("login")}
        onRegisterClick={() => setAuthView("register")}
      />
    );
  }

  return (
    <div className="retool-shell workbench-shell">
      <header className="workbench-nav">
        <div className="workbench-nav__brand" aria-label={meetingFlowProduct.name}>
          <BrandMark />
          <span>
            <strong>{meetingFlowProduct.name}</strong>
            <small>会议流程工作台</small>
          </span>
        </div>
        <div className="nav-actions">
          <button
            className={`nav-account ${workbenchView === "account" ? "is-active" : ""}`}
            onClick={() => setWorkbenchView("account")}
            type="button"
          >
            {user.name}
          </button>
          <span className="nav-divider" aria-hidden="true">
            |
          </span>
          <button className="nav-logout" onClick={handleLogout} type="button">
            退出
          </button>
        </div>
      </header>

      <main className={`workbench-main ${workbenchView === "account" ? "workbench-main--account" : ""}`} id="workbench">
        {workbenchView === "account" && (
          <section className="account-page" aria-labelledby="account-title">
            <div className="account-page__header">
              <div>
                <span className="section-kicker">Account</span>
                <h1 id="account-title">账号管理</h1>
                <p>查看当前登录账号、权限和基础安全信息。</p>
              </div>
              <button className="ghost-button" onClick={() => setWorkbenchView("workspace")} type="button">
                返回工作台
              </button>
            </div>

            <div className="account-page__grid">
              <article className="account-profile">
                <div className="account-profile__avatar" aria-hidden="true">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <span>当前账号</span>
                  <h2>{user.name}</h2>
                  <p>{user.email}</p>
                </div>
              </article>

              <article className="account-panel">
                <h2>账号信息</h2>
                <dl className="account-detail-list">
                  <div>
                    <dt>姓名</dt>
                    <dd>{user.name}</dd>
                  </div>
                  <div>
                    <dt>邮箱</dt>
                    <dd>{user.email}</dd>
                  </div>
                  <div>
                    <dt>角色</dt>
                    <dd>{userRoleLabels[user.role]}</dd>
                  </div>
                  <div>
                    <dt>账号 ID</dt>
                    <dd>{user.id}</dd>
                  </div>
                </dl>
              </article>

              <article className="account-panel">
                <h2>安全状态</h2>
                <dl className="account-detail-list">
                  <div>
                    <dt>登录状态</dt>
                    <dd>已登录</dd>
                  </div>
                  <div>
                    <dt>创建时间</dt>
                    <dd>{formatDateTime(user.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>更新时间</dt>
                    <dd>{formatDateTime(user.updatedAt)}</dd>
                  </div>
                </dl>
              </article>
            </div>
          </section>
        )}

        <section className="workbench-commandbar" aria-label="工作台操作">
          <div>
            <span className="section-kicker">Workspace</span>
            <h1>会议流程工作台</h1>
            <p>从会议队列选择一场会议，配置模板节点，运行并同步到飞书日历。</p>
          </div>
          <button className="primary-button" onClick={() => setIsCreateModalOpen(true)} type="button">
            新建会议
          </button>
        </section>

        <section className="workbench-metrics" aria-label="今日概览">
          <article>
            <span>今日会议</span>
            <strong>{todayMeetings.length}</strong>
            <p>{filteredMeetings.length} 场会议进入当前筛选</p>
          </article>
          <article>
            <span>阻塞流程</span>
            <strong>{blockedRuns.length}</strong>
            <p>需要处理的人工审批或重试</p>
          </article>
        </section>

        <section className="workbench-console" id="workflow-console">
          <StatusBanner error={error} feedback={feedback} />
          <StatusBanner error={calendarError} feedback={calendarFeedback} />
          <StatusBanner error={feishuCalendarError} feedback={feishuCalendarFeedback} />

          <div className="workbench-grid" id="meetings">
            <MeetingListPanel
              dateFilter={dateFilter}
              isLoading={isLoading}
              meetings={filteredMeetings}
              organizerFilter={organizerFilter}
              organizerOptions={organizerOptions}
              searchQuery={searchQuery}
              selectedMeetingId={selectedMeetingId}
              sortBy={sortBy}
              statusFilter={statusFilter}
              typeFilter={typeFilter}
              onDateFilterChange={setDateFilter}
              onOrganizerFilterChange={setOrganizerFilter}
              onSearchChange={setSearchQuery}
              onSelectMeeting={setSelectedMeetingId}
              onSortByChange={setSortBy}
              onStatusFilterChange={setStatusFilter}
              onTypeFilterChange={setTypeFilter}
            />

            {selectedMeeting ? (
              <WorkflowTemplatePanel
                selectedMeeting={selectedMeeting}
                isMutating={isMutating}
                isWorkflowLoading={isWorkflowLoading}
                isWorkflowMutating={isWorkflowMutating}
                workflowError={workflowError}
                workflowFeedback={workflowFeedback}
                workflowRuns={workflowRuns}
                workflowTemplates={workflowTemplates}
                isGoogleCalendarConfigured={isGoogleCalendarConfigured}
                isCalendarLoading={isCalendarLoading}
                isCalendarMutating={isCalendarMutating}
                googleRedirectUri={googleRedirectUri}
                calendarStatusMessage={calendarStatusMessage}
                isGoogleCalendarConnected={isGoogleCalendarConnected}
                isFeishuCalendarConfigured={isFeishuCalendarConfigured}
                isFeishuCalendarConnected={isFeishuCalendarConnected}
                isFeishuCalendarLoading={isFeishuCalendarLoading}
                isFeishuCalendarMutating={isFeishuCalendarMutating}
                feishuRedirectUri={feishuRedirectUri}
                feishuCalendarStatusMessage={feishuCalendarStatusMessage}
                onConnectGoogleCalendar={connectGoogleCalendar}
                onConnectFeishuCalendar={connectFeishuCalendar}
                onOpenDetail={() => openMeetingDetail(selectedMeeting.id)}
                onEditMeeting={() => editMeetingDetail(selectedMeeting.id)}
                onSyncGoogleCalendar={() => syncMeetingToGoogleCalendar(selectedMeeting.id)}
                onSyncFeishuCalendar={() => syncMeetingToFeishuCalendar(selectedMeeting.id)}
                onStartWorkflowRun={(templateId) => startWorkflowRun(selectedMeeting.id, templateId)}
                onAdvanceWorkflowRun={advanceWorkflowRun}
                onCancelWorkflowRun={cancelWorkflowRun}
                onRetryWorkflowRun={retryWorkflowRun}
                onSaveTemplateCanvas={saveTemplateCanvas}
                onUpdateStatus={updateMeetingStatus}
              />
            ) : (
              <section className="workbench-empty" aria-label="入门指南">
                <div className="workbench-empty__icon" aria-hidden="true" />
                <h2>选择会议开始编排流程</h2>
                <p>
                  {filteredMeetings.length > 0
                    ? "从左侧列表选择一场会议，即可查看和编排它的工作流模板、运行记录和待办事项。"
                    : "还没有会议。点击上方“新建会议”创建第一场会议。"}
                </p>
                {filteredMeetings.length === 0 && (
                  <button
                    className="primary-button"
                    onClick={() => setIsCreateModalOpen(true)}
                    type="button"
                  >
                    新建会议
                  </button>
                )}
              </section>
            )}
          </div>
        </section>
      </main>

      {isCreateModalOpen && (
        <Modal onClose={() => setIsCreateModalOpen(false)} size="xl" title="新建会议流程">
          <MeetingCreateForm
            formState={formState}
            isSubmitting={isSubmitting}
            onAddAgendaItem={addFormAgendaItem}
            onAddParticipant={addFormParticipant}
            onAgendaItemChange={updateFormAgendaItem}
            onFieldChange={handleFieldChange}
            onParticipantChange={updateFormParticipant}
            onRemoveAgendaItem={removeFormAgendaItem}
            onRemoveParticipant={removeFormParticipant}
            onSubmit={handleCreateMeeting}
          />
        </Modal>
      )}

      {isDetailModalOpen && selectedMeeting && selectedMeetingEditable && (
        <Modal onClose={closeMeetingDetail} size="lg" title={isDetailEditing ? "编辑会议" : selectedMeeting.title}>
          <MeetingDetailPanel
            editableMeeting={selectedMeetingEditable}
            isEditing={isDetailEditing}
            isMutating={isMutating}
            meeting={selectedMeeting}
            onCancelMeeting={cancelMeeting}
            onDeleteMeeting={handleDeleteMeeting}
            onEditingChange={setIsDetailEditing}
            onSaveMeeting={saveMeetingEdits}
            onUpdateStatus={updateMeetingStatus}
          />
        </Modal>
      )}
    </div>
  );
}
