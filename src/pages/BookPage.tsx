import { getErrorMessage } from "../lib/errors";
import type React from "react";
import { AppContext } from "../app/AppContext";
import type { Book } from "../types/index";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { Field } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, send } from "../lib/api";
import { useContext, useEffect, useState } from "react";
import { useUser } from "../hooks/useUser";

export function BookPage() {
  const { id } = useParams(),
    [b, setBook] = useState<Book | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [params] = useSearchParams();
  const user = useUser(),
    { notify, login } = useContext(AppContext);
  useEffect(() => {
    setBook(null);
    setError("");
    api<Book>("/common/books/" + id)
      .then(setBook)
      .catch((e) => setError(getErrorMessage(e)));
  }, [id]);
  async function reserve(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return login();
    if (!b) return;
    setBusy(true);
    setError("");
    try {
      await api(
        "/client/rentals",
        send("POST", {
          ...Object.fromEntries(new FormData(e.currentTarget)),
          bookId: b.id,
          libraryId: b.libraryId,
        }),
      );
      setDone(true);
      notify("Книга успешно забронирована");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="container page">
      <div className="breadcrumb">
        <Link to="/">Главная</Link> / <Link to="/catalog">Каталог</Link> / Книга
      </div>
      <ErrorMessage error={error} />
      {b ? (
        <>
          <div className="book-detail">
            <div className="detail-cover">
              <img src={b.coverImage || "/placeholder.svg"} alt={b.title} />
            </div>
            <div>
              <span className="eyebrow">ВАША СЛЕДУЮЩАЯ ИСТОРИЯ</span>
              <h1>{b.title}</h1>
              <p className="detail-author">{b.author}</p>
              <div className="book-meta">
                <span>
                  Год издания: <strong>{b.year || "не указан"}</strong>
                </span>
                <span>
                  Экземпляров: <strong>{b.totalCopies}</strong>
                </span>
              </div>
              <h3>О книге</h3>
              <p className="description">{b.description}</p>
              <div className="library-note">
                <Icon type="pin" />
                <div>
                  <strong>{b.libraryName}</strong>
                  <p>{b.address}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="booking">
            <div>
              <span className="eyebrow">ОТЛОЖИТЕ КНИГУ ДЛЯ СЕБЯ</span>
              <h2>
                {done ? "Готово! Книга забронирована" : "Забронировать книгу"}
              </h2>
              <p>
                {done
                  ? "Подробности бронирования доступны в личном кабинете."
                  : "Выберите даты выдачи и возврата. Доступность проверяется на выбранный период."}
              </p>
            </div>
            {done ? (
              <Link className="btn" to="/account/rentals">
                Мои бронирования <Icon type="arrow" size={20} />
              </Link>
            ) : (
              <form onSubmit={reserve}>
                <div className="date-row">
                  <Field label="Выдача книги">
                    <input
                      name="dateStart"
                      type="date"
                      required
                      defaultValue={params.get("dateStart") || ""}
                      min={new Date().toISOString().slice(0, 10)}
                    />
                  </Field>
                  <Field label="Возврат книги">
                    <input
                      name="dateEnd"
                      type="date"
                      required
                      defaultValue={params.get("dateEnd") || ""}
                      min={new Date().toISOString().slice(0, 10)}
                    />
                  </Field>
                </div>
                <button
                  className="btn wide"
                  disabled={
                    busy || !b.isAvailable || (!!user && user.role !== "client")
                  }
                >
                  {busy
                    ? "Бронируем…"
                    : user
                      ? "Забронировать"
                      : "Войти и забронировать"}
                </button>
              </form>
            )}
          </div>
        </>
      ) : (
        !error && <p className="loading">Загружаем книгу…</p>
      )}
    </section>
  );
}
