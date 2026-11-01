import type React from "react";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Icon } from "../ui/Icon";
import { Link } from "react-router-dom";
import { useUser } from "../../hooks/useUser";

export function PageLayout({ children }: { children: React.ReactNode }) {
  const user = useUser();
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      {user?.role === "client" && (
        <Link
          to="/account/support"
          className="chat-fab"
          aria-label="Написать в поддержку"
        >
          <Icon type="chat" />
        </Link>
      )}
    </>
  );
}
