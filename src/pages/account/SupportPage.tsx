import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorMessage } from "../../components/ui/ErrorMessage";
import { formatDate } from "../../lib/format";
import { useUser } from "../../hooks/useUser";
import { useSupportChat } from "../../features/support/useSupportChat";
import { ChatMessageList } from "../../features/support/ChatMessageList";
export function SupportPage() {
  const user = useUser()!;
  const {
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
  } = useSupportChat(user);
  return (
    <>
      <div className="section-head">
        <h2>{user.role === "client" ? "Поддержка" : "Обращения читателей"}</h2>
        {user.role === "client" && (
          <button className="btn small" onClick={startChat}>
            Новое обращение
          </button>
        )}
      </div>
      <ErrorMessage error={error} />
      <div className="support-layout">
        <div className="chat-list">
          {chats.map((c) => (
            <button
              className={selected === c.id ? "selected" : ""}
              key={c.id}
              onClick={() => selectChat(c.id)}
            >
              <strong>
                {user.role === "manager"
                  ? c.client?.name
                  : "Обращение №" + c.id}
                {c.hasNewMessages && <span className="unread-dot" />}
              </strong>
              <span>
                {formatDate(c.createdAt)} · {c.isActive ? "Открыто" : "Закрыто"}
              </span>
            </button>
          ))}
        </div>
        <div className="chat-panel">
          {!selected && !newChat ? (
            <EmptyState title="Ваш диалог с поддержкой">
              {user.role === "client"
                ? "Создайте обращение — мы поможем с бронированием."
                : "Выберите обращение слева."}
            </EmptyState>
          ) : (
            <>
              <div className="chat-heading">
                <strong>
                  {newChat ? "Новое обращение" : "Обращение №" + selected}
                </strong>
                {user.role === "manager" && active?.isActive && (
                  <button className="text-button" onClick={closeChat}>
                    Закрыть обращение
                  </button>
                )}
              </div>
              <ChatMessageList messages={messages} userId={user.id} />
              {newChat || active?.isActive ? (
                <form className="message-form" onSubmit={submit}>
                  <textarea
                    aria-label="Сообщение"
                    placeholder="Напишите сообщение…"
                    maxLength={5000}
                    required
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button className="btn" disabled={busy}>
                    Отправить
                  </button>
                </form>
              ) : (
                <p className="closed-note">Обращение закрыто</p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
