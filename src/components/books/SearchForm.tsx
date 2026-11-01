import { Field } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { useNavigate, useSearchParams } from "react-router-dom";

export function SearchForm({ compact = false }: { compact?: boolean }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  return (
    <form
      className={"search-form " + (compact ? "compact" : "")}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const q = new URLSearchParams();
        for (const [k, v] of data) if (String(v)) q.set(k, String(v));
        navigate("/catalog?" + q);
      }}
    >
      <Field label="Название книги">
        <input
          name="title"
          placeholder="Что вы хотите прочитать?"
          defaultValue={params.get("title") || ""}
        />
      </Field>
      <Field label="Автор">
        <input
          name="author"
          placeholder="Имя или фамилия автора"
          defaultValue={params.get("author") || ""}
        />
      </Field>
      {!compact && (
        <div className="date-row">
          <Field label="Выдача книги">
            <input
              type="date"
              name="dateStart"
              min={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          <Field label="Возврат книги">
            <input
              type="date"
              name="dateEnd"
              min={new Date().toISOString().slice(0, 10)}
            />
          </Field>
        </div>
      )}
      {compact && (
        <>
          <input
            type="hidden"
            name="dateStart"
            value={params.get("dateStart") || ""}
          />
          <input
            type="hidden"
            name="dateEnd"
            value={params.get("dateEnd") || ""}
          />
        </>
      )}
      <button className="btn" type="submit">
        <Icon type="search" size={20} />
        Найти книгу
      </button>
    </form>
  );
}
