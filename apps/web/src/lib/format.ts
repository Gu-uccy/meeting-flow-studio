export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium"
  }).format(new Date(value));
}

export function durationLabel(minutes: number) {
  if (minutes < 60) {
    return `${minutes} 分钟`;
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (restMinutes === 0) {
    return `${hours} 小时`;
  }

  return `${hours} 小时 ${restMinutes} 分钟`;
}

export function formatDateRange(startAt: string, endAt: string) {
  const end = new Date(endAt);

  return `${formatDateTime(startAt)} - ${new Intl.DateTimeFormat("zh-CN", {
    timeStyle: "short"
  }).format(end)}`;
}

export function toDateInputValue(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
