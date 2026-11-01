import { EmptyState } from "../components/ui/EmptyState";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="container page">
      <EmptyState title="404 — страница не найдена">
        <Link to="/">На главную</Link>
      </EmptyState>
    </div>
  );
}
