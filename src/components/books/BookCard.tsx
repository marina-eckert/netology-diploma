import type { Book } from "../../types/index";
import { Icon } from "../ui/Icon";
import { Link, useSearchParams } from "react-router-dom";

export function BookCard({ book: b }: { book: Book }) {
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
