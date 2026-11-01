import { AppProvider } from "./AppProvider";
import { AppRoutes } from "./AppRoutes";
import { PageLayout } from "../components/layout/PageLayout";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <AppProvider>
      <PageLayout>
        <AppRoutes />
      </PageLayout>
    </AppProvider>
  );
}
