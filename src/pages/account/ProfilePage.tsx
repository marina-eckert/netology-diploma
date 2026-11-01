import { getErrorMessage } from "../../lib/errors";
import type React from "react";
import { AppContext } from "../../app/AppContext";
import { ErrorMessage } from "../../components/ui/ErrorMessage";
import { Field } from "../../components/ui/Field";
import { Icon } from "../../components/ui/Icon";
import { Link } from "react-router-dom";
import { Modal } from "../../components/ui/Modal";
import type { User } from "../../types/index";
import { api, send } from "../../lib/api";
import { setUser } from "../../store/index";
import { useContext, useState } from "react";
import { useDispatch } from "react-redux";

export function ProfilePage({ user }: { user: User }) {
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
      const updated = await api<User>(
        "/auth/me",
        send("PATCH", Object.fromEntries(new FormData(e.currentTarget))),
      );
      dispatch(setUser(updated));
      setEditing(false);
      notify("Данные профиля сохранены");
    } catch (e) {
      setError(getErrorMessage(e));
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
            <ErrorMessage error={error} />
            <button className="btn" disabled={busy}>
              {busy ? "Сохраняем…" : "Сохранить"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
