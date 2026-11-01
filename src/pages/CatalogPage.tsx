import { getErrorMessage } from "../lib/errors";
import type { Book, Library } from "../types/index";
import { BookCard } from "../components/books/BookCard";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { Link, useSearchParams } from "react-router-dom";
import { SearchForm } from "../components/books/SearchForm";
import { api } from "../lib/api";
import { useEffect, useState } from "react";

export function CatalogPage() {
  const [params, setParams] = useSearchParams(),
    [books, setBooks] = useState<Book[]>([]),
    [libs, setLibs] = useState<Library[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [hasNext, setHasNext] = useState(false);
  const offset = Number(params.get("offset") || 0);
  useEffect(() => {
    api<Library[]>("/common/libraries")
      .then(setLibs)
      .catch(() => {});
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const q = new URLSearchParams(params);
    q.set("limit", "12");
    api<Book[]>("/common/books?" + q)
      .then((b) => {
        if (active) {
          setBooks(b);
          setHasNext(b.length === 12);
        }
      })
      .catch((e) => active && setError(getErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [params]);
  function filter(key: string, value: string) {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value);
    else p.delete(key);
    p.delete("offset");
    setParams(p);
  }
  return (
    <section className="container page">
      <div className="breadcrumb">
        <Link to="/">Главная</Link> / Каталог
      </div>
      <h1>Найдите свою следующую книгу</h1>
      <SearchForm compact />
      <div className="catalog-toolbar">
        <h2>Каталог книг</h2>
        <div className="filters">
          <select
            aria-label="Библиотека"
            value={params.get("library") || ""}
            onChange={(e) => filter("library", e.target.value)}
          >
            <option value="">Все библиотеки</option>
            {libs.map((l) => (
              <option value={l.id} key={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={params.get("availableOnly") === "true"}
              onChange={(e) =>
                filter("availableOnly", e.target.checked ? "true" : "")
              }
            />
            Только доступные
          </label>
        </div>
      </div>
      <ErrorMessage error={error} />
      {loading ? (
        <p className="loading">Ищем книги…</p>
      ) : books.length ? (
        <div className="book-grid">
          {books.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      ) : (
        !error && (
          <EmptyState title="Книги не найдены">
            Попробуйте изменить название, автора или библиотеку.
          </EmptyState>
        )
      )}
      <div className="pagination">
        <button
          className="btn outline"
          disabled={offset === 0}
          onClick={() => {
            const p = new URLSearchParams(params);
            p.set("offset", String(Math.max(0, offset - 12)));
            setParams(p);
          }}
        >
          ← Назад
        </button>
        <span>Страница {Math.floor(offset / 12) + 1}</span>
        <button
          className="btn outline"
          disabled={!hasNext}
          onClick={() => {
            const p = new URLSearchParams(params);
            p.set("offset", String(offset + 12));
            setParams(p);
          }}
        >
          Далее →
        </button>
      </div>
    </section>
  );
}
