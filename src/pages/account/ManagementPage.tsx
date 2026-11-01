import { getErrorMessage } from "../../lib/errors";
import { ResourceFields } from "../../features/management/ResourceFields";
import { ManagementTable } from "../../features/management/ManagementTable";
import { resourceNames } from "../../features/management/types";
import type {
  ManagementDraft,
  ManagementRecord,
  ResourceKind,
} from "../../features/management/types";
import type React from "react";
import { AppContext } from "../../app/AppContext";
import { ErrorMessage } from "../../components/ui/ErrorMessage";
import type { Library } from "../../types/index";
import { Modal } from "../../components/ui/Modal";
import { api, send } from "../../lib/api";
import { useContext, useEffect, useState } from "react";
import { useUser } from "../../hooks/useUser";

export function ManagementPage({ kind }: { kind: ResourceKind }) {
  const user = useUser()!,
    [rows, setRows] = useState<ManagementRecord[]>([]),
    [libs, setLibs] = useState<Library[]>([]),
    [edit, setEdit] = useState<ManagementDraft | null>(null),
    [remove, setRemove] = useState<ManagementRecord | null>(null),
    [error, setError] = useState(""),
    [formError, setFormError] = useState(""),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false);
  const { notify } = useContext(AppContext);
  const names = resourceNames;
  const load = () =>
    api<ManagementRecord[]>(
      kind === "users"
        ? "/" + user.role + "/users?limit=100&name=" + encodeURIComponent(query)
        : "/common/" + kind + "?limit=100&title=" + encodeURIComponent(query),
    )
      .then(setRows)
      .catch((e) => setError(getErrorMessage(e)));
  useEffect(() => {
    load();
    if (kind === "books")
      api<Library[]>("/common/libraries")
        .then(setLibs)
        .catch(() => {});
  }, [kind, query]);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      if (!edit) return;
      const data = new FormData(e.currentTarget);
      const body =
        kind === "books"
          ? { method: edit.id ? "PATCH" : "POST", body: data }
          : send(edit.id ? "PATCH" : "POST", Object.fromEntries(data));
      await api("/admin/" + kind + (edit.id ? "/" + edit.id : ""), body);
      setEdit(null);
      notify("Изменения сохранены");
      load();
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-head">
        <h2>{names[kind]}</h2>
        {user.role === "admin" && (
          <button
            className="btn small"
            onClick={() => {
              setEdit({});
              setFormError("");
            }}
          >
            + Добавить
          </button>
        )}
      </div>
      {kind !== "libraries" && (
        <input
          className="manage-search"
          aria-label="Поиск"
          placeholder={
            kind === "books" ? "Поиск по названию" : "Поиск по имени"
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <ErrorMessage error={error} />
      <ManagementTable
        kind={kind}
        rows={rows}
        canManage={user.role === "admin"}
        onEdit={(record) => {
          setEdit(record);
          setFormError("");
        }}
        onRemove={setRemove}
      />
      {edit && (
        <Modal
          title={
            (edit.id ? "Редактировать: " : "Добавить: ") +
            names[kind].toLowerCase()
          }
          close={() => setEdit(null)}
        >
          <form onSubmit={save}>
            {<ResourceFields kind={kind} draft={edit} libraries={libs} />}

            <ErrorMessage error={formError} />
            <button className="btn wide" disabled={busy}>
              {busy ? "Сохраняем…" : "Сохранить"}
            </button>
          </form>
        </Modal>
      )}
      {remove && (
        <Modal title="Удалить запись?" close={() => setRemove(null)}>
          <p>
            «{remove.title || remove.name}» будет удалена. Это действие нельзя
            отменить.
          </p>
          <ErrorMessage error={error} />
          <div className="button-row">
            <button className="btn outline" onClick={() => setRemove(null)}>
              Отмена
            </button>
            <button
              className="btn"
              onClick={async () => {
                try {
                  await api("/admin/" + kind + "/" + remove.id, {
                    method: "DELETE",
                  });
                  setRemove(null);
                  load();
                  notify("Запись удалена");
                } catch (e) {
                  setError(getErrorMessage(e));
                }
              }}
            >
              Удалить
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
