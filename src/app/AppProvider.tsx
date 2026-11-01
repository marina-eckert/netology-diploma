import type React from "react";
import { AppContext } from "./AppContext";
import { AuthModal } from "../features/auth/AuthModal";
import { useDispatch } from "react-redux";
import { Toast } from "../components/ui/Toast";
import type { User } from "../types/index";
import { api } from "../lib/api";
import { setUser } from "../store/index";
import { useEffect, useState } from "react";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<false | "login" | "register">(false),
    [notice, setNotice] = useState("");
  const dispatch = useDispatch();
  useEffect(() => {
    api<User | null>("/auth/me")
      .then((user) => dispatch(setUser(user)))
      .catch(() => dispatch(setUser(null)));
  }, [dispatch]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  return (
    <AppContext.Provider
      value={{
        notify: setNotice,
        login: () => setAuth("login"),
        openAuth: setAuth,
      }}
    >
      {children}
      {auth && (
        <AuthModal
          initialRegister={auth === "register"}
          close={() => setAuth(false)}
        />
      )}
      {notice && <Toast message={notice} onClose={() => setNotice("")} />}
    </AppContext.Provider>
  );
}
