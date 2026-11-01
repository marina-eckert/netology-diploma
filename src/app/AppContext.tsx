import { createContext } from "react";

export type AuthMode = "login" | "register";
export interface AppActions {
  notify(message: string): void;
  login(): void;
  openAuth(mode: AuthMode): void;
}
export const AppContext = createContext<AppActions>({
  notify: () => {},
  login: () => {},
  openAuth: () => {},
});
