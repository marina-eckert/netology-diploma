import { useEffect, useRef } from "react";
import type { SupportMessage } from "../../types";
export function ChatMessageList({
  messages,
  userId,
}: {
  messages: SupportMessage[];
  userId: number;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);
  return (
    <div className="messages">
      {messages.map((message) => (
        <div
          key={message.id}
          className={"message " + (message.author.id === userId ? "mine" : "")}
        >
          <strong>{message.author.name}</strong>
          <p>{message.text}</p>
          <span>
            {new Date(message.createdAt).toLocaleTimeString("ru-RU", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {message.author.id === userId &&
              (message.readAt ? " · Прочитано" : " · Отправлено")}
          </span>
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}
