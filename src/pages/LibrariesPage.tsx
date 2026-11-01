import { getErrorMessage } from "../lib/errors";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { Icon } from "../components/ui/Icon";
import type { Library } from "../types/index";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useEffect, useState } from "react";

export function LibrariesPage() {
  const [libs, setLibs] = useState<Library[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    api<Library[]>("/common/libraries")
      .then(setLibs)
      .catch((e) => setError(getErrorMessage(e)));
  }, []);
  return (
    <section className="container page">
      <span className="eyebrow">КНИГИ РЯДОМ С ВАМИ</span>
      <h1>Библиотеки Москвы</h1>
      <p className="lead">
        Выбирайте удобную библиотеку и приходите за любимыми книгами.
      </p>
      <ErrorMessage error={error} />
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
