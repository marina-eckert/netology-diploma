import { Icon } from "../ui/Icon";
import { Link } from "react-router-dom";

export function Footer() {
  return (
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
  );
}
