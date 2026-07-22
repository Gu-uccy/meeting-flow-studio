import { useEffect, useState } from "react";

export function useWorkflowUnsavedGuard(isCanvasDirty: boolean) {
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);

  useEffect(() => {
    if (!isCanvasDirty) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isCanvasDirty]);

  function requestTemplateSwitch(templateId: string, currentTemplateId: string, onSelectTemplate: (templateId: string) => void) {
    if (templateId === currentTemplateId) {
      return;
    }
    if (isCanvasDirty) {
      setPendingTemplateId(templateId);
      return;
    }
    onSelectTemplate(templateId);
  }

  function cancelTemplateSwitch() {
    setPendingTemplateId(null);
  }

  function confirmTemplateSwitch(onSelectTemplate: (templateId: string) => void) {
    if (!pendingTemplateId) {
      return;
    }
    onSelectTemplate(pendingTemplateId);
    setPendingTemplateId(null);
  }

  return {
    cancelTemplateSwitch,
    confirmTemplateSwitch,
    pendingTemplateId,
    requestTemplateSwitch
  };
}
