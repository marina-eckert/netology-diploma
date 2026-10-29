import { Global, Injectable, Module, OnModuleInit } from "@nestjs/common";
import { DataSource } from "typeorm";
import { readFileSync } from "node:fs";
import { hash } from "bcryptjs";
@Injectable()
export class Database extends DataSource implements OnModuleInit {
  constructor() {
    super({
      type: "postgres",
      host: process.env.POSTGRES_HOST || "127.0.0.1",
      port: Number(process.env.POSTGRES_PORT || 5438),
      username: process.env.POSTGRES_USER || "library",
      password: process.env.POSTGRES_PASSWORD || "library_local",
      database: process.env.POSTGRES_DB || "library",
      synchronize: false,
    });
  }
  async onModuleInit() {
    await this.initialize();
    await this.query(readFileSync("server/schema.sql", "utf8"));
    if (process.env.SEED_DEMO === "true") await this.seed();
  }
  async seed() {
    const password = await hash("Library123!", 12);
    for (const [email, name, role] of [
      ["admin@library.local", "Анна Администратор", "admin"],
      ["manager@library.local", "Мария Консультант", "manager"],
      ["reader@library.local", "Александр Читатель", "client"],
    ])
      await this.query(
        'INSERT INTO users(email,name,role,"passwordHash") VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING',
        [email, name, role, password],
      );
    if ((await this.query("SELECT id FROM libraries LIMIT 1")).length) return;
    const libs = await this.query(
      `INSERT INTO libraries(name,address,description) VALUES ('Библиотека имени Ф. М. Достоевского','Москва, Чистопрудный бульвар, 23','Место встречи с любимыми книгами. Пн–сб: 10:00–21:00.'),('Библиотека имени И. С. Тургенева','Москва, Бобров переулок, 6','Историческая читальня в центре города. Вт–вс: 10:00–20:00.'),('Библиотека имени А. П. Чехова','Москва, Страстной бульвар, 8','Классика и современная литература. Пн–сб: 11:00–20:00.') RETURNING id`,
    );
    const books = JSON.parse(readFileSync("server/seed-books.json", "utf8"));
    for (let i = 0; i < books.length; i++)
      await this.query(
        'INSERT INTO books("libraryId",title,author,year,description,"totalCopies","availableCopies","coverImage") VALUES($1,$2,$3,$4,$5,3,3,$6)',
        [
          libs[i % 3].id,
          books[i].title,
          books[i].author,
          books[i].year,
          books[i].description,
          `/covers/cover-${i + 1}.jpg`,
        ],
      );
  }
}
@Global()
@Module({ providers: [Database], exports: [Database] })
export class DatabaseModule {}
