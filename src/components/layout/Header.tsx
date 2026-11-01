import { getErrorMessage } from "../../lib/errors";
import { AppContext } from "../../app/AppContext";
import { Icon } from "../ui/Icon";
import { Link, NavLink } from "react-router-dom";
import { api } from "../../lib/api";
import { setUser } from "../../store/index";
import { useContext } from "react";
import { useDispatch } from "react-redux";
import { useUser } from "../../hooks/useUser";

export function Header() {
  const user = useUser();
  const dispatch = useDispatch();
  const { notify, openAuth } = useContext(AppContext);
  return (
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
                  } catch (e) {
                    notify(getErrorMessage(e));
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
                onClick={() => openAuth("register")}
              >
                Регистрация
              </button>
              <button className="btn green" onClick={() => openAuth("login")}>
                <Icon type="user" size={18} />
                Войти
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
