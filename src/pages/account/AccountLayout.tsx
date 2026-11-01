import { AppContext } from "../../app/AppContext";
import { EmptyState } from "../../components/ui/EmptyState";
import { ManagementPage } from "./ManagementPage";
import { NavLink, Route, Routes } from "react-router-dom";
import { ProfilePage } from "./ProfilePage";
import { RentalsPage } from "./RentalsPage";
import type { RootState } from "../../store/index";
import { SupportPage } from "./SupportPage";
import { useContext } from "react";
import { useSelector } from "react-redux";
import { useUser } from "../../hooks/useUser";

export function AccountLayout() {
  const user = useUser(),
    ready = useSelector((s: RootState) => s.session.ready),
    { login } = useContext(AppContext);
  if (!ready) return <p className="container loading">Загрузка…</p>;
  if (!user)
    return (
      <div className="container page">
        <EmptyState title="Войдите в личный кабинет">
          <button className="btn" onClick={login}>
            Войти или зарегистрироваться
          </button>
        </EmptyState>
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
            <Route index element={<ProfilePage user={user} />} />
            <Route path="rentals" element={<RentalsPage />} />
            {user.role !== "admin" && (
              <Route path="support" element={<SupportPage />} />
            )}
            {user.role === "admin" && (
              <>
                <Route path="books" element={<ManagementPage kind="books" />} />
                <Route
                  path="libraries"
                  element={<ManagementPage kind="libraries" />}
                />
              </>
            )}
            {user.role !== "client" && (
              <Route path="users" element={<ManagementPage kind="users" />} />
            )}
            <Route path="*" element={<EmptyState title="Раздел не найден" />} />
          </Routes>
        </div>
      </div>
    </section>
  );
}
