import { AboutPage } from "../pages/AboutPage";
import { AccountLayout } from "../pages/account/AccountLayout";
import { BookPage } from "../pages/BookPage";
import { CatalogPage } from "../pages/CatalogPage";
import { HomePage } from "../pages/HomePage";
import { LibrariesPage } from "../pages/LibrariesPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { Route, Routes } from "react-router-dom";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/catalog" element={<CatalogPage />} />
      <Route path="/books/:id" element={<BookPage />} />
      <Route path="/libraries" element={<LibrariesPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/account/*" element={<AccountLayout />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
