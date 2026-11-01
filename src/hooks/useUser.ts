import type { RootState } from "../store/index";
import { useSelector } from "react-redux";

export const useUser = () => useSelector((s: RootState) => s.session.user);
