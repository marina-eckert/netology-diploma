import React, {
  useEffect,
  useState,
  createContext,
  useContext,
  useRef,
} from "react";
import { createRoot } from "react-dom/client";
import { Provider, useSelector, useDispatch } from "react-redux";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  useNavigate,
  useSearchParams,
  useParams,
  useLocation,
} from "react-router-dom";
import { io } from "socket.io-client";
import { store, setUser, RootState } from "./store";
import { api, send, Book, Library, User } from "./api";
import "./style.css";
const AppContext = createContext({
  notify: (_s: string) => {},
  login: () => {},
});
const useUser = () => useSelector((s: RootState) => s.session.user);
function Icon({ type = "book", size = 24 }: { type?: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    book: (
      <>
        <path d="M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Z" />
        <path d="M12 5v16" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 22v-3a8 8 0 0 1 16 0v3" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 12h16m-6-6 6 6-6 6" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    chat: (
      <>
        <path d="M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4Z" />
        <path d="M8 9h8M8 13h5" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[type] || paths.book}
    </svg>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function ErrorBox({ error }: { error: string }) {
  return error ? (
    <p className="error" role="alert">
      {error}
    </p>
  ) : null;
}
function Empty({
  title = "Пока ничего нет",
  children,
}: {
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Icon size={44} />
      <h2>{title}</h2>
      <p>{children || "Здесь появятся ваши записи."}</p>
    </div>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("input,button")?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          "button,input,select,textarea,a[href]",
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <button className="close" onClick={close} aria-label="Закрыть">
          ×
        </button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
function Auth({
  close,
  initialRegister = false,
}: {
  close: () => void;
  initialRegister?: boolean;
}) {
  const [register, setRegister] = useState(initialRegister),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const dispatch = useDispatch();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const b = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (register) await api("/client/register", send("POST", b));
      dispatch(setUser(await api("/auth/login", send("POST", b))));
      close();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={register ? "Регистрация" : "Вход в личный кабинет"}
      close={close}
    >
      <p className="muted">
        {register
          ? "Создайте аккаунт и бронируйте книги онлайн"
          : "Рады видеть вас снова"}
      </p>
      <form onSubmit={submit}>
        {register && (
          <Field label="Ваше имя">
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
            />
          </Field>
        )}
        <Field label="Электронная почта">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.ru"
          />
        </Field>
        <Field label="Пароль">
          <input
            name="password"
            type="password"
            required
            minLength={register ? 8 : 1}
            maxLength={128}
            autoComplete={register ? "new-password" : "current-password"}
          />
        </Field>
        {register && (
          <Field label="Телефон (необязательно)">
            <input name="contactPhone" type="tel" autoComplete="tel" />
          </Field>
        )}
        <ErrorBox error={error} />
        <button className="btn wide" disabled={busy}>
          {busy ? "Подождите…" : register ? "Зарегистрироваться" : "Войти"}
        </button>
      </form>
      <p className="auth-switch">
        {register ? "Уже есть аккаунт?" : "Ещё нет аккаунта?"}{" "}
        <button
          className="text-button"
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register ? "Войти" : "Зарегистрироваться"}
        </button>
      </p>
    </Modal>
  );
}
function App() {
  const [auth, setAuth] = useState<false | "login" | "register">(false),
    [notice, setNotice] = useState("");
  const dispatch = useDispatch(),
    user = useUser(),
    location = useLocation();
  useEffect(() => {
    api("/auth/me")
      .then((u) => dispatch(setUser(u)))
      .catch(() => dispatch(setUser(null)));
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 5000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  return (
    <AppContext.Provider
      value={{ notify: setNotice, login: () => setAuth("login") }}
    >
      <header>
        <div className="container header-row">
          <Link className="logo" to="/">
            <Icon size={35} />
            <span>
              БИБЛИО<span className="logo-dot">.</span>
            </span>
          </Link>
          <nav aria-label="Основная навигация">
            <NavLink to="/catalog">Каталог</NavLink>
            <NavLink to="/libraries">Библиотеки</NavLink>
            <NavLink to="/about">О нас</NavLink>
          </nav>
          <div className="header-actions">
            {user ? (
              <>
                <Link to="/account" className="account-link">
                  <Icon type="user" size={20} />
                  {user.name.split(" ")[0]}
                </Link>
                <button
                  className="text-button"
                  onClick={async () => {
                    try {
                      await api("/auth/logout", { method: "POST" });
                      dispatch(setUser(null));
                    } catch (e: any) {
                      setNotice(e.message);
                    }
                  }}
                >
                  Выйти
                </button>
              </>
            ) : (
              <>
                <button
                  className="text-button"
                  onClick={() => setAuth("register")}
                >
                  Регистрация
                </button>
                <button className="btn green" onClick={() => setAuth("login")}>
                  <Icon type="user" size={18} />
                  Войти
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/books/:id" element={<BookPage />} />
          <Route path="/libraries" element={<Libraries />} />
          <Route path="/about" element={<About />} />
          <Route path="/account/*" element={<Account />} />
          <Route
            path="*"
            element={
              <div className="container page">
                <Empty title="404 — страница не найдена">
                  <Link to="/">На главную</Link>
                </Empty>
              </div>
            }
          />
        </Routes>
      </main>
      <footer>
        <div className="container footer-row">
          <Link className="logo" to="/">
            <Icon size={32} />
            БИБЛИО.
          </Link>
          <div>
            <strong>Хорошая книга всегда рядом</strong>
            <p>Поиск и бронирование книг в библиотеках Москвы</p>
          </div>
          <div>
            <Link to="/libraries">Наши библиотеки</Link>
            <br />
            <Link to="/about">О проекте</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          © {new Date().getFullYear()} Библио · Учебный проект Нетологии
          <span>Читайте. Открывайте. Вдохновляйтесь.</span>
        </div>
      </footer>
      {user?.role === "client" && (
        <Link
          to="/account/support"
          className="chat-fab"
          aria-label="Написать в поддержку"
        >
          <Icon type="chat" />
        </Link>
      )}
      {auth && (
        <Auth
          initialRegister={auth === "register"}
          close={() => setAuth(false)}
        />
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button onClick={() => setNotice("")} aria-label="Закрыть">
            ×
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
function SearchForm({ compact = false }: { compact?: boolean }) {
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
function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="art-circle" />
      <div className="art-star">✦</div>
      <div className="art-spark">✳</div>
      <div className="art-plant">
        <span />
        <span />
        <span />
        <i />
      </div>
      <div className="art-book book-a">
        <span>
          МИР
          <br />
          ВНУТРИ
          <br />
          КНИГИ
        </span>
        <Icon size={48} />
      </div>
      <div className="art-book book-b">
        <span>
          ещё
          <br />
          одна
          <br />
          глава
        </span>
      </div>
      <div className="art-stack s1" />
      <div className="art-stack s2" />
      <div className="art-stack s3" />
      <div className="art-caption">
        Ваша следующая история
        <br />
        начинается здесь ↗
      </div>
    </div>
  );
}
function Home() {
  const [books, setBooks] = useState<Book[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    api("/common/books?limit=11")
      .then(setBooks)
      .catch((e) => setError(e.message));
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
        <ErrorBox error={error} />
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
function BookCard({ book: b }: { book: Book }) {
  const [params] = useSearchParams();
  const period = new URLSearchParams();
  for (const key of ["dateStart", "dateEnd"]) {
    const value = params.get(key);
    if (value) period.set(key, value);
  }
  const bookUrl = "/books/" + b.id + (period.size ? "?" + period : "");
  return (
    <article className="book-card">
      <Link className="cover-link" to={bookUrl}>
        <img
          src={b.coverImage || "/placeholder.svg"}
          alt={"Обложка: " + b.title}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = "/placeholder.svg";
          }}
        />
      </Link>
      <div className="card-info">
        <span className="availability">
          <i />
          {b.isAvailable ? "Доступна для бронирования" : "Временно недоступна"}
        </span>
        <h3>
          <Link to={bookUrl}>{b.title}</Link>
        </h3>
        <p className="author">{b.author}</p>
        <p className="book-description">{b.description}</p>
        <p className="card-library">
          <Icon type="pin" size={14} />
          {b.libraryName}
        </p>
        <Link className="card-button" to={bookUrl}>
          Подробнее <Icon type="arrow" size={18} />
        </Link>
      </div>
    </article>
  );
}
function Catalog() {
  const [params, setParams] = useSearchParams(),
    [books, setBooks] = useState<Book[]>([]),
    [libs, setLibs] = useState<Library[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [hasNext, setHasNext] = useState(false);
  const offset = Number(params.get("offset") || 0);
  useEffect(() => {
    api("/common/libraries")
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
      .catch((e) => active && setError(e.message))
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
      <ErrorBox error={error} />
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
          <Empty title="Книги не найдены">
            Попробуйте изменить название, автора или библиотеку.
          </Empty>
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
function BookPage() {
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
    api("/common/books/" + id)
      .then(setBook)
      .catch((e) => setError(e.message));
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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="container page">
      <div className="breadcrumb">
        <Link to="/">Главная</Link> / <Link to="/catalog">Каталог</Link> / Книга
      </div>
      <ErrorBox error={error} />
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
function Libraries() {
  const [libs, setLibs] = useState<Library[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    api("/common/libraries")
      .then(setLibs)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="container page">
      <span className="eyebrow">КНИГИ РЯДОМ С ВАМИ</span>
      <h1>Библиотеки Москвы</h1>
      <p className="lead">
        Выбирайте удобную библиотеку и приходите за любимыми книгами.
      </p>
      <ErrorBox error={error} />
      <div className="library-grid">
        {libs.map((l, i) => (
          <article className="library-card" key={l.id}>
            <span className="library-number">0{i + 1}</span>
            <Icon type="pin" size={30} />
            <h2>{l.name}</h2>
            <p>{l.address}</p>
            <p className="muted">{l.description}</p>
            <Link className="more" to={"/catalog?library=" + l.id}>
              Книги библиотеки <Icon type="arrow" size={20} />
            </Link>
          </article>
        ))}
      </div>
      <div className="map-preview">
        <img src="/map.jpg" alt="Карта библиотек Москвы" />
      </div>
    </section>
  );
}
function About() {
  return (
    <section className="container page about">
      <span className="eyebrow">О ПРОЕКТЕ</span>
      <h1>
        Больше книг.
        <br />
        Больше открытий.
      </h1>
      <p className="lead">
        Библио объединяет библиотеки Москвы, чтобы хорошую книгу было проще
        найти.
      </p>
      <div className="about-panel">
        <Icon size={70} />
        <h2>Библиотека начинается с любопытства</h2>
        <p>
          Ищите книги по названию и автору, выбирайте библиотеку, бронируйте
          удобные даты. В личном кабинете можно следить за бронированиями и
          общаться с консультантом.
        </p>
        <Link className="btn" to="/catalog">
          Открыть каталог <Icon type="arrow" size={20} />
        </Link>
      </div>
      <h2>Как получить книгу</h2>
      <p>
        Зарегистрируйтесь, выберите книгу и период аренды. После подтверждения
        приходите в указанную библиотеку с читательским билетом или документом.
        По вопросам бронирования напишите в поддержку в личном кабинете.
      </p>
      <p className="muted">
        Сайт создан в рамках дипломного проекта Fullstack-разработчика
        Нетологии. Данные библиотек используются для демонстрации.
      </p>
    </section>
  );
}
function Account() {
  const user = useUser(),
    ready = useSelector((s: RootState) => s.session.ready),
    { login } = useContext(AppContext);
  if (!ready) return <p className="container loading">Загрузка…</p>;
  if (!user)
    return (
      <div className="container page">
        <Empty title="Войдите в личный кабинет">
          <button className="btn" onClick={login}>
            Войти или зарегистрироваться
          </button>
        </Empty>
      </div>
    );
  return (
    <section className="container page">
      <div className="account-title">
        <div>
          <span className="eyebrow">
            {
              {
                client: "ЧИТАТЕЛЬ",
                admin: "АДМИНИСТРАТОР",
                manager: "КОНСУЛЬТАНТ",
              }[user.role]
            }
          </span>
          <h1>Личный кабинет</h1>
        </div>
        <span className="avatar">{user.name[0]}</span>
      </div>
      <div className="account-layout">
        <aside>
          <NavLink end to="/account">
            Мой профиль
          </NavLink>
          <NavLink to="/account/rentals">
            {user.role === "client" ? "Мои бронирования" : "Бронирования"}
          </NavLink>
          {user.role !== "admin" && (
            <NavLink to="/account/support">
              {user.role === "manager" ? "Обращения читателей" : "Поддержка"}
            </NavLink>
          )}
          {user.role === "admin" && (
            <>
              <NavLink to="/account/books">Управление книгами</NavLink>
              <NavLink to="/account/libraries">Библиотеки</NavLink>
            </>
          )}
          {user.role !== "client" && (
            <NavLink to="/account/users">Пользователи</NavLink>
          )}
        </aside>
        <div className="account-content">
          <Routes>
            <Route index element={<Profile user={user} />} />
            <Route path="rentals" element={<RentalList />} />
            {user.role !== "admin" && (
              <Route path="support" element={<Support />} />
            )}
            {user.role === "admin" && (
              <>
                <Route path="books" element={<Manage kind="books" />} />
                <Route path="libraries" element={<Manage kind="libraries" />} />
              </>
            )}
            {user.role !== "client" && (
              <Route path="users" element={<Manage kind="users" />} />
            )}
            <Route path="*" element={<Empty title="Раздел не найден" />} />
          </Routes>
        </div>
      </div>
    </section>
  );
}
function Profile({ user }: { user: User }) {
  const [editing, setEditing] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const dispatch = useDispatch();
  const { notify } = useContext(AppContext);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const updated = await api(
        "/auth/me",
        send("PATCH", Object.fromEntries(new FormData(e.currentTarget))),
      );
      dispatch(setUser(updated));
      setEditing(false);
      notify("Данные профиля сохранены");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h2>Здравствуйте, {user.name.split(" ")[0]}!</h2>
      <p className="muted">Здесь всё, что нужно для новых книжных открытий.</p>
      <div className="profile-card">
        <div className="avatar">{user.name[0]}</div>
        <div>
          <h3>{user.name}</h3>
          <p>{user.email}</p>
          <p>{user.contactPhone || "Телефон не указан"}</p>
        </div>
      </div>
      <button
        className="text-button"
        style={{ display: "block", marginBottom: 25 }}
        onClick={() => setEditing(true)}
      >
        Редактировать профиль
      </button>
      <Link
        to={user.role === "client" ? "/catalog" : "/account/rentals"}
        className="btn"
      >
        {user.role === "client" ? "Выбрать книгу" : "Перейти к бронированиям"}{" "}
        <Icon type="arrow" size={20} />
      </Link>
      {editing && (
        <Modal title="Редактировать профиль" close={() => setEditing(false)}>
          <form onSubmit={save}>
            <Field label="Имя">
              <input
                name="name"
                required
                minLength={2}
                maxLength={100}
                defaultValue={user.name}
              />
            </Field>
            <Field label="Email">
              <input
                name="email"
                type="email"
                required
                defaultValue={user.email}
              />
            </Field>
            <Field label="Телефон">
              <input
                name="contactPhone"
                type="tel"
                maxLength={40}
                defaultValue={user.contactPhone}
              />
            </Field>
            <ErrorBox error={error} />
            <button className="btn" disabled={busy}>
              {busy ? "Сохраняем…" : "Сохранить"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
const statusLabels: Record<string, string> = {
  reserved: "Забронировано",
  active: "На руках",
  completed: "Возвращено",
  cancelled: "Отменено",
};
const date = (s: string) => new Date(s).toLocaleDateString("ru-RU");
function RentalList() {
  const user = useUser()!,
    [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const { notify } = useContext(AppContext);
  const load = () =>
    api("/" + user.role + "/rentals?limit=100")
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);
  async function change(r: any, status: string) {
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
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <>
      <h2>
        {user.role === "client" ? "Мои бронирования" : "Бронирования читателей"}
      </h2>
      <ErrorBox error={error} />
      {loading ? (
        <p>Загрузка…</p>
      ) : !rows.length ? (
        <Empty title="Бронирований пока нет">
          <Link to="/catalog">Найдите свою первую книгу →</Link>
        </Empty>
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
                  {date(r.dateStart)} — {date(r.dateEnd)}
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
function Support() {
  const user = useUser()!,
    [chats, setChats] = useState<any[]>([]),
    [selected, setSelected] = useState<number | null>(null),
    [messages, setMessages] = useState<any[]>([]),
    [draft, setDraft] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [newChat, setNewChat] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const loadChats = () =>
    api("/" + user.role + "/support-requests?limit=100")
      .then(setChats)
      .catch((e) => setError(e.message));
  const active = chats.find((c) => c.id === selected);
  useEffect(() => {
    loadChats();
  }, []);
  useEffect(() => {
    if (!selected) return;
    let live = true;
    const socket = io({ withCredentials: true });
    socket.on("connect", () => socket.emit("subscribeToChat", selected));
    const refresh = () =>
      api("/common/support-requests/" + selected + "/messages")
        .then((m) => {
          if (live) setMessages(m);
        })
        .catch((e) => live && setError(e.message));
    const read = () =>
      api(
        "/common/support-requests/" + selected + "/messages/read",
        send("POST", { createdBefore: new Date().toISOString() }),
      )
        .then(loadChats)
        .catch(() => {});
    refresh().then(read);
    socket.on("message", () => {
      refresh().then(read);
    });
    socket.on("closed", loadChats);
    socket.on("read", refresh);
    socket.on("chatError", (e) => setError(e.message));
    return () => {
      live = false;
      socket.disconnect();
    };
  }, [selected]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    setError("");
    try {
      if (newChat || !selected) {
        const c = await api(
          "/client/support-requests",
          send("POST", { text: draft }),
        );
        await loadChats();
        setSelected(c[0].id);
        setNewChat(false);
      } else {
        await api(
          "/common/support-requests/" + selected + "/messages",
          send("POST", { text: draft }),
        );
        setMessages(
          await api("/common/support-requests/" + selected + "/messages"),
        );
      }
      setDraft("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-head">
        <h2>{user.role === "client" ? "Поддержка" : "Обращения читателей"}</h2>
        {user.role === "client" && (
          <button
            className="btn small"
            onClick={() => {
              setNewChat(true);
              setSelected(null);
              setMessages([]);
            }}
          >
            Новое обращение
          </button>
        )}
      </div>
      <ErrorBox error={error} />
      <div className="support-layout">
        <div className="chat-list">
          {chats.map((c) => (
            <button
              className={selected === c.id ? "selected" : ""}
              key={c.id}
              onClick={() => {
                setSelected(c.id);
                setNewChat(false);
                setError("");
              }}
            >
              <strong>
                {user.role === "manager" ? c.client.name : "Обращение №" + c.id}
                {c.hasNewMessages && <span className="unread-dot" />}
              </strong>
              <span>
                {date(c.createdAt)} · {c.isActive ? "Открыто" : "Закрыто"}
              </span>
            </button>
          ))}
        </div>
        <div className="chat-panel">
          {!selected && !newChat ? (
            <Empty title="Ваш диалог с поддержкой">
              {user.role === "client"
                ? "Создайте обращение — мы поможем с бронированием."
                : "Выберите обращение слева."}
            </Empty>
          ) : (
            <>
              <div className="chat-heading">
                <strong>
                  {newChat ? "Новое обращение" : "Обращение №" + selected}
                </strong>
                {user.role === "manager" && active?.isActive && (
                  <button
                    className="text-button"
                    onClick={async () => {
                      try {
                        await api(
                          "/manager/support-requests/" + selected + "/close",
                          { method: "POST" },
                        );
                        loadChats();
                      } catch (e: any) {
                        setError(e.message);
                      }
                    }}
                  >
                    Закрыть обращение
                  </button>
                )}
              </div>
              <div className="messages">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      "message " + (m.author.id === user.id ? "mine" : "")
                    }
                  >
                    <strong>{m.author.name}</strong>
                    <p>{m.text}</p>
                    <span>
                      {new Date(m.createdAt).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {m.author.id === user.id &&
                        (m.readAt ? " · Прочитано" : " · Отправлено")}
                    </span>
                  </div>
                ))}
                <div ref={end} />
              </div>
              {newChat || active?.isActive ? (
                <form className="message-form" onSubmit={submit}>
                  <textarea
                    aria-label="Сообщение"
                    placeholder="Напишите сообщение…"
                    maxLength={5000}
                    required
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button className="btn" disabled={busy}>
                    Отправить
                  </button>
                </form>
              ) : (
                <p className="closed-note">Обращение закрыто</p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
function Manage({ kind }: { kind: "books" | "libraries" | "users" }) {
  const user = useUser()!,
    [rows, setRows] = useState<any[]>([]),
    [libs, setLibs] = useState<Library[]>([]),
    [edit, setEdit] = useState<any | null>(null),
    [remove, setRemove] = useState<any | null>(null),
    [error, setError] = useState(""),
    [formError, setFormError] = useState(""),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false);
  const { notify } = useContext(AppContext);
  const names = {
    books: "Книги",
    libraries: "Библиотеки",
    users: "Пользователи",
  };
  const load = () =>
    api(
      kind === "users"
        ? "/" + user.role + "/users?limit=100&name=" + encodeURIComponent(query)
        : "/common/" + kind + "?limit=100&title=" + encodeURIComponent(query),
    )
      .then(setRows)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    if (kind === "books")
      api("/common/libraries")
        .then(setLibs)
        .catch(() => {});
  }, [kind, query]);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const data = new FormData(e.currentTarget);
      const body =
        kind === "books"
          ? { method: edit.id ? "PATCH" : "POST", body: data }
          : send(edit.id ? "PATCH" : "POST", Object.fromEntries(data));
      await api("/admin/" + kind + (edit.id ? "/" + edit.id : ""), body);
      setEdit(null);
      notify("Изменения сохранены");
      load();
    } catch (e: any) {
      setFormError(e.message);
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
      <ErrorBox error={error} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>{kind === "users" ? "Имя" : "Название"}</th>
              <th>
                {kind === "books"
                  ? "Экземпляры"
                  : kind === "users"
                    ? "Email / роль"
                    : "Адрес"}
              </th>
              {user.role === "admin" && <th>Действия</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.title || r.name}</td>
                <td>
                  {kind === "books"
                    ? `${r.totalCopies} · ${r.isAvailable ? "опубликована" : "скрыта"}`
                    : kind === "users"
                      ? `${r.email} · ${r.role}`
                      : r.address}
                </td>
                {user.role === "admin" && (
                  <td>
                    <div className="table-actions">
                      <button
                        className="text-button"
                        onClick={() => {
                          setEdit(r);
                          setFormError("");
                        }}
                      >
                        Изменить
                      </button>
                      <button
                        className="text-button danger"
                        onClick={() => setRemove(r)}
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty title="Записей не найдено" />}
      </div>
      {edit && (
        <Modal
          title={
            (edit.id ? "Редактировать: " : "Добавить: ") +
            names[kind].toLowerCase()
          }
          close={() => setEdit(null)}
        >
          <form onSubmit={save}>
            {kind === "books" ? (
              <>
                <Field label="Название">
                  <input
                    name="title"
                    required
                    defaultValue={edit.title}
                    maxLength={300}
                  />
                </Field>
                <Field label="Автор">
                  <input
                    name="author"
                    required
                    defaultValue={edit.author}
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
                      defaultValue={edit.year}
                    />
                  </Field>
                  <Field label="Количество экземпляров">
                    <input
                      name="totalCopies"
                      type="number"
                      required
                      min={0}
                      defaultValue={edit.totalCopies ?? 1}
                    />
                  </Field>
                </div>
                <Field label="Библиотека">
                  <select
                    name="libraryId"
                    required
                    defaultValue={edit.libraryId || ""}
                  >
                    <option value="" disabled>
                      Выберите библиотеку
                    </option>
                    {libs.map((l) => (
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
                    defaultValue={String(edit.isAvailable ?? true)}
                  >
                    <option value="true">Доступна</option>
                    <option value="false">Временно скрыта</option>
                  </select>
                </Field>
              </>
            ) : kind === "libraries" ? (
              <>
                <Field label="Название">
                  <input
                    name="name"
                    required
                    minLength={2}
                    defaultValue={edit.name}
                  />
                </Field>
                <Field label="Адрес">
                  <input
                    name="address"
                    required
                    minLength={2}
                    defaultValue={edit.address}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Имя">
                  <input
                    name="name"
                    required
                    minLength={2}
                    defaultValue={edit.name}
                  />
                </Field>
                <Field label="Email">
                  <input
                    name="email"
                    type="email"
                    required
                    defaultValue={edit.email}
                  />
                </Field>
                <Field
                  label={edit.id ? "Новый пароль (необязательно)" : "Пароль"}
                >
                  <input
                    name="password"
                    type="password"
                    required={!edit.id}
                    minLength={8}
                  />
                </Field>
                <Field label="Телефон">
                  <input name="contactPhone" defaultValue={edit.contactPhone} />
                </Field>
                <Field label="Роль">
                  <select name="role" defaultValue={edit.role || "client"}>
                    <option value="client">Читатель</option>
                    <option value="manager">Консультант</option>
                    <option value="admin">Администратор</option>
                  </select>
                </Field>
              </>
            )}
            {kind !== "users" && (
              <Field label="Описание">
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={edit.description}
                />
              </Field>
            )}
            <ErrorBox error={formError} />
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
          <ErrorBox error={error} />
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
                } catch (e: any) {
                  setError(e.message);
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
createRoot(document.getElementById("root")!).render(
  <Provider store={store}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </Provider>,
);
