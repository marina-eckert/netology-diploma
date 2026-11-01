import { configureStore, createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { User } from "../types";
const session = createSlice({
  name: "session",
  initialState: { user: null as User | null, ready: false },
  reducers: {
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
      state.ready = true;
    },
  },
});
export const { setUser } = session.actions;
export const store = configureStore({ reducer: { session: session.reducer } });
export type RootState = ReturnType<typeof store.getState>;
