import { EmptyState } from "../../components/ui/EmptyState";
import type { ManagementRecord, ResourceKind } from "./types";
export function ManagementTable({
  kind,
  rows,
  canManage,
  onEdit,
  onRemove,
}: {
  kind: ResourceKind;
  rows: ManagementRecord[];
  canManage: boolean;
  onEdit: (record: ManagementRecord) => void;
  onRemove: (record: ManagementRecord) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>{kind === "users" ? "Имя" : "Название"}</th>
            <th>
              {kind === "books"
                ? "Экземпляры"
                : kind === "users"
                  ? "Email / роль"
                  : "Адрес"}
            </th>
            {canManage && <th>Действия</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.title || r.name}</td>
              <td>
                {kind === "books"
                  ? `${r.totalCopies} · ${r.isAvailable ? "опубликована" : "скрыта"}`
                  : kind === "users"
                    ? `${r.email} · ${r.role}`
                    : r.address}
              </td>
              {canManage && (
                <td>
                  <div className="table-actions">
                    <button
                      className="text-button"
                      onClick={() => {
                        onEdit(r);
                      }}
                    >
                      Изменить
                    </button>
                    <button
                      className="text-button danger"
                      onClick={() => onRemove(r)}
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <EmptyState title="Записей не найдено" />}
    </div>
  );
}
