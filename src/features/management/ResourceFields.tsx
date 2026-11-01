import { Field } from "../../components/ui/Field";
import { BookFields } from "./BookFields";
import { LibraryFields } from "./LibraryFields";
import { UserFields } from "./UserFields";
import type { ManagementDraft, ResourceKind } from "./types";
import type { Library } from "../../types";
export function ResourceFields({
  kind,
  draft,
  libraries,
}: {
  kind: ResourceKind;
  draft: ManagementDraft;
  libraries: Library[];
}) {
  return (
    <>
      {kind === "books" ? (
        <BookFields draft={draft} libraries={libraries} />
      ) : kind === "libraries" ? (
        <LibraryFields draft={draft} />
      ) : (
        <UserFields draft={draft} />
      )}
      {kind !== "users" && (
        <Field label="Описание">
          <textarea
            name="description"
            rows={3}
            defaultValue={draft.description}
          />
        </Field>
      )}
    </>
  );
}
