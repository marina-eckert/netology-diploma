export const statusLabels: Record<string, string> = {
  reserved: "Забронировано",
  active: "На руках",
  completed: "Возвращено",
  cancelled: "Отменено",
};

export const formatDate = (s: string) =>
  new Date(s).toLocaleDateString("ru-RU");
