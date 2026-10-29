import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env"))
  console.log(".env уже существует; настройки сохранены.");
else {
  writeFileSync(
    ".env",
    `HTTP_HOST=127.0.0.1\nHTTP_PORT=3000\nPOSTGRES_HOST=127.0.0.1\nPOSTGRES_PORT=5438\nPOSTGRES_USER=library\nPOSTGRES_PASSWORD=library_local\nPOSTGRES_DB=library\nSESSION_SECRET=${randomBytes(48).toString("hex")}\nSEED_DEMO=true\nCOOKIE_SECURE=false\n`,
  );
  console.log(
    "Создан .env для локального запуска со случайным SESSION_SECRET.",
  );
}
