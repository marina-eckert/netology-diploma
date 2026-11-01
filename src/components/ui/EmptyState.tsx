import type React from "react";
import { Icon } from "./Icon";

export function EmptyState({
  title = "Пока ничего нет",
  children,
}: {
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Icon size={44} />
      <h2>{title}</h2>
      <p>{children || "Здесь появятся ваши записи."}</p>
    </div>
  );
}
