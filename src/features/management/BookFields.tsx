import { Field } from "../../components/ui/Field";
import type { ManagementDraft } from "./types";
import type { Library } from "../../types";
export function BookFields({
  draft,
  libraries,
}: {
  draft: ManagementDraft;
  libraries: Library[];
}) {
  return (
    <>
      <Field label="Название">
        <input
          name="title"
          required
          defaultValue={draft.title}
          maxLength={300}
        />
      </Field>
      <Field label="Автор">
        <input
          name="author"
          required
          defaultValue={draft.author}
          maxLength={200}
        />
      </Field>
      <div className="date-row">
        <Field label="Год">
          <input
            name="year"
            type="number"
            min={0}
            max={2100}
            defaultValue={draft.year}
          />
        </Field>
        <Field label="Количество экземпляров">
          <input
            name="totalCopies"
            type="number"
            required
            min={0}
            defaultValue={draft.totalCopies ?? 1}
          />
        </Field>
      </div>
      <Field label="Библиотека">
        <select name="libraryId" required defaultValue={draft.libraryId || ""}>
          <option value="" disabled>
            Выберите библиотеку
          </option>
          {libraries.map((l) => (
            <option value={l.id} key={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Обложка (JPEG, PNG, WebP, до 5 МБ)">
        <input
          name="coverImage"
          type="file"
          accept="image/jpeg,image/png,image/webp"
        />
      </Field>
      <Field label="Публикация">
        <select
          name="isAvailable"
          defaultValue={String(draft.isAvailable ?? true)}
        >
          <option value="true">Доступна</option>
          <option value="false">Временно скрыта</option>
        </select>
      </Field>
    </>
  );
}
