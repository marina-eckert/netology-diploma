import { getErrorMessage } from "../../lib/errors";
import type { User } from "../../types";
import type React from "react";
import { ErrorMessage } from "../../components/ui/ErrorMessage";
import { Field } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { api, send } from "../../lib/api";
import { setUser } from "../../store/index";
import { useDispatch } from "react-redux";
import { useState } from "react";

export function AuthModal({
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
      if (register) await api<User>("/client/register", send("POST", b));
      dispatch(setUser(await api<User>("/auth/login", send("POST", b))));
      close();
    } catch (e) {
      setError(getErrorMessage(e));
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
        <ErrorMessage error={error} />
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
