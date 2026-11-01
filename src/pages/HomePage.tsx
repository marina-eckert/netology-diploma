import { getErrorMessage } from "../lib/errors";
import type { Book } from "../types/index";
import { BookCard } from "../components/books/BookCard";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { HeroArt } from "../components/home/HeroArt";
import { Icon } from "../components/ui/Icon";
import { Link } from "react-router-dom";
import { SearchForm } from "../components/books/SearchForm";
import { api } from "../lib/api";
import { useEffect, useState } from "react";

export function HomePage() {
  const [books, setBooks] = useState<Book[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    api<Book[]>("/common/books?limit=11")
      .then(setBooks)
      .catch((e) => setError(getErrorMessage(e)));
  }, []);
  return (
    <>
      <section className="container hero">
        <div className="hero-heading">
          <span className="eyebrow">БИБЛИОТЕКИ МОСКВЫ · ОНЛАЙН</span>
          <h1>
            Найдите книгу.
            <br />
            <em>Откройте свой мир.</em>
          </h1>
          <p>
            Тысячи историй — в библиотеках рядом с вами.
            <br />
            Выберите книгу и забронируйте её за пару минут.
          </p>
        </div>
        <div className="hero-body">
          <SearchForm />
          <HeroArt />
        </div>
      </section>
      <section className="container section">
        <div className="section-head">
          <div>
            <span className="eyebrow">НА КНИЖНОЙ ПОЛКЕ</span>
            <h2>Популярные книги</h2>
          </div>
          <Link to="/catalog" className="more">
            Весь каталог <Icon type="arrow" size={20} />
          </Link>
        </div>
        <ErrorMessage error={error} />
        <div className="book-grid">
          {books.slice(0, 6).map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      </section>
      <section className="how-section">
        <div className="container">
          <span className="eyebrow">ПРОСТО НАЧНИТЕ ЧИТАТЬ</span>
          <h2>От поиска до первой страницы</h2>
          <div className="steps">
            {[
              [
                "01",
                "Найдите свою книгу",
                "Ищите по названию, автору или выберите что-то новое.",
              ],
              [
                "02",
                "Выберите даты",
                "Забронируйте книгу в удобной библиотеке.",
              ],
              [
                "03",
                "Приходите за историей",
                "Заберите книгу и наслаждайтесь чтением.",
              ],
            ].map(([n, t, p]) => (
              <div key={n}>
                <span>{n}</span>
                <h3>{t}</h3>
                <p>{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="container section">
        <div className="section-head">
          <div>
            <span className="eyebrow">ЕСТЬ ЧТО ОТКРЫТЬ</span>
            <h2>Новые поступления</h2>
          </div>
          <Link className="more" to="/catalog">
            Найти свою книгу <Icon type="arrow" size={20} />
          </Link>
        </div>
        <div className="book-grid">
          {books.slice(6, 9).map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      </section>
      <section className="container section">
        <div className="section-head">
          <h2>Библиотеки Москвы</h2>
          <Link to="/libraries" className="more">
            Адреса библиотек <Icon type="arrow" size={20} />
          </Link>
        </div>
        <Link to="/libraries" className="map-preview">
          <img src="/map.jpg" alt="Карта библиотек Москвы из макета" />
          <span>
            <Icon type="pin" />
            Найдите библиотеку рядом
          </span>
        </Link>
      </section>
    </>
  );
}
