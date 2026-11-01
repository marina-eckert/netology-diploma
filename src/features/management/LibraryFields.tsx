import { Field } from "../../components/ui/Field";
import type { ManagementDraft } from "./types";

export function LibraryFields({ draft }: { draft: ManagementDraft }) {
  return (
    <>
      <Field label="Название">
        <input name="name" required minLength={2} defaultValue={draft.name} />
      </Field>
      <Field label="Адрес">
        <input
          name="address"
          required
          minLength={2}
          defaultValue={draft.address}
        />
      </Field>
    </>
  );
}
