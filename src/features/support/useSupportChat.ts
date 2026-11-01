import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { io } from "socket.io-client";
import { api, send } from "../../lib/api";
import { getErrorMessage } from "../../lib/errors";
import type { SupportMessage, SupportRequest, User } from "../../types";

export function useSupportChat(user: User) {
  const [chats, setChats] = useState<SupportRequest[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newChat, setNewChat] = useState(false);
  const active = chats.find((chat) => chat.id === selected);

  const loadChats = useCallback(
    () =>
      api<SupportRequest[]>("/" + user.role + "/support-requests?limit=100")
        .then(setChats)
        .catch((error) => setError(getErrorMessage(error))),
    [user.role],
  );

  useEffect(() => {
    void loadChats();
  }, [loadChats]);
  useEffect(() => {
    if (!selected) return;
    let live = true;
    const socket = io({ withCredentials: true });
    const refresh = () =>
      api<SupportMessage[]>(
        "/common/support-requests/" + selected + "/messages",
      )
        .then((history) => {
          if (live) setMessages(history);
        })
        .catch((error) => {
          if (live) setError(getErrorMessage(error));
        });
    const read = () =>
      api(
        "/common/support-requests/" + selected + "/messages/read",
        send("POST", { createdBefore: new Date().toISOString() }),
      )
        .then(loadChats)
        .catch(() => {});
    socket.on("connect", () => socket.emit("subscribeToChat", selected));
    void refresh().then(read);
    socket.on("message", () => {
      void refresh().then(read);
    });
    socket.on("closed", loadChats);
    socket.on("read", refresh);
    socket.on("chatError", (error) => setError(getErrorMessage(error)));
    return () => {
      live = false;
      socket.disconnect();
    };
  }, [selected, loadChats]);

  function startChat() {
    setNewChat(true);
    setSelected(null);
    setMessages([]);
  }
  function selectChat(chatId: number) {
    setSelected(chatId);
    setNewChat(false);
    setError("");
  }
  async function closeChat() {
    try {
      await api("/manager/support-requests/" + selected + "/close", {
        method: "POST",
      });
      await loadChats();
    } catch (error) {
      setError(getErrorMessage(error));
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    setError("");
    try {
      if (newChat || !selected) {
        const created = await api<SupportRequest[]>(
          "/client/support-requests",
          send("POST", { text: draft }),
        );
        await loadChats();
        setSelected(created[0].id);
        setNewChat(false);
      } else {
        await api(
          "/common/support-requests/" + selected + "/messages",
          send("POST", { text: draft }),
        );
        setMessages(
          await api<SupportMessage[]>(
            "/common/support-requests/" + selected + "/messages",
          ),
        );
      }
      setDraft("");
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return {
    chats,
    selected,
    messages,
    draft,
    error,
    busy,
    newChat,
    active,
    setDraft,
    startChat,
    selectChat,
    closeChat,
    submit,
  };
}
