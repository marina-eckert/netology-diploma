import { getErrorMessage } from "../../lib/errors";
import type { Rental, RentalStatus } from "../../types";
import { AppContext } from "../../app/AppContext";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorMessage } from "../../components/ui/ErrorMessage";
import { Link } from "react-router-dom";
import { api, send } from "../../lib/api";
import { formatDate, statusLabels } from "../../lib/format";
import { useContext, useEffect, useState } from "react";
import { useUser } from "../../hooks/useUser";

export function RentalsPage() {
  const user = useUser()!,
    [rows, setRows] = useState<Rental[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const { notify } = useContext(AppContext);
  const load = () =>
    api<Rental[]>("/" + user.role + "/rentals?limit=100")
      .then(setRows)
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);
  async function change(r: Rental, status: RentalStatus) {
    try {
      await api(
        "/" +
          user.role +
          "/rentals/" +
          r.id +
          (user.role === "client" ? "/cancel" : ""),
        send(user.role === "client" ? "POST" : "PATCH", { status }),
      );
      notify("Статус обновлён");
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }
  return (
    <>
      <h2>
        {user.role === "client" ? "Мои бронирования" : "Бронирования читателей"}
      </h2>
      <ErrorMessage error={error} />
      {loading ? (
        <p>Загрузка…</p>
      ) : !rows.length ? (
        <EmptyState title="Бронирований пока нет">
          <Link to="/catalog">Найдите свою первую книгу →</Link>
        </EmptyState>
      ) : (
        <div className="rental-list">
          {rows.map((r) => (
            <article className="rental-card" key={r.id}>
              <img src={r.coverImage || "/placeholder.svg"} alt="" />
              <div>
                <span className={"badge " + r.status}>
                  {statusLabels[r.status]}
                </span>
                <h3>
                  <Link to={"/books/" + r.bookId}>{r.title}</Link>
                </h3>
                <p>{r.libraryName}</p>
                <p>
                  {formatDate(r.dateStart)} — {formatDate(r.dateEnd)}
                </p>
                {user.role !== "client" && (
                  <p className="muted">
                    {r.userName} · {r.email}
                  </p>
                )}
                {r.status === "reserved" && (
                  <div className="button-row">
                    {user.role !== "client" && (
                      <button
                        className="btn small"
                        onClick={() => change(r, "active")}
                      >
                        Выдать книгу
                      </button>
                    )}
                    <button
                      className="text-button danger"
                      onClick={() => change(r, "cancelled")}
                    >
                      Отменить бронь
                    </button>
                  </div>
                )}
                {r.status === "active" && user.role !== "client" && (
                  <button
                    className="btn small"
                    onClick={() => change(r, "completed")}
                  >
                    Принять возврат
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
