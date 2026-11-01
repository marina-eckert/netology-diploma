import { Field } from "../../components/ui/Field";
import type { ManagementDraft } from "./types";

export function UserFields({ draft }: { draft: ManagementDraft }) {
  return (
    <>
      <Field label="Имя">
        <input name="name" required minLength={2} defaultValue={draft.name} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" required defaultValue={draft.email} />
      </Field>
      <Field label={draft.id ? "Новый пароль (необязательно)" : "Пароль"}>
        <input
          name="password"
          type="password"
          required={!draft.id}
          minLength={8}
        />
      </Field>
      <Field label="Телефон">
        <input name="contactPhone" defaultValue={draft.contactPhone} />
      </Field>
      <Field label="Роль">
        <select name="role" defaultValue={draft.role || "client"}>
          <option value="client">Читатель</option>
          <option value="manager">Консультант</option>
          <option value="admin">Администратор</option>
        </select>
      </Field>
    </>
  );
}
