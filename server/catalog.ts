import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  Res,
  Injectable,
  Module,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage, memoryStorage } from "multer";
import type { Response } from "express";
import { randomUUID } from "node:crypto";
import { Database } from "./database.js";
import { allow, UsersModule, UsersService } from "./auth.js";
import { text, id, count, page, dates, publicUser } from "./validation.js";
import { peakReservations } from "./availability.js";
import { queryRows } from "./query.js";
@Injectable()
export class CatalogService {
  constructor(private db: Database) {}
  async books(q: any) {
    const [limit, offset] = page(q);
    let start = new Date(),
      end = new Date(Date.now() + 1);
    if (q.dateStart || q.dateEnd) [start, end] = dates(q.dateStart, q.dateEnd);
    return this.db.query(
      `WITH found AS (SELECT b.*,l.name AS "libraryName",l.address,free_copies(b.id,$7,$8) AS "availableInPeriod" FROM books b JOIN libraries l ON l.id=b."libraryId" WHERE b.title ILIKE $1 AND b.author ILIKE $2 AND ($3::int IS NULL OR b."libraryId"=$3)) SELECT found.*,free_copies(id,now(),now()+interval '1 microsecond') AS "availableCopies" FROM found WHERE ($4::boolean=false OR ("isAvailable" AND "availableInPeriod">0)) ORDER BY id LIMIT $5 OFFSET $6`,
      [
        `%${q.title || ""}%`,
        `%${q.author || ""}%`,
        q.library ? id(q.library) : null,
        q.availableOnly === "true" || !!q.dateStart,
        limit,
        offset,
        start,
        end,
      ],
    );
  }
  async book(bookId: number) {
    const b = (
      await this.db.query(
        'SELECT b.*,l.name AS "libraryName",l.address,free_copies(b.id,now(),now()+interval \'1 microsecond\') AS "availableCopies" FROM books b JOIN libraries l ON l.id=b."libraryId" WHERE b.id=$1',
        [bookId],
      )
    )[0];
    if (!b) throw new NotFoundException("Книга не найдена");
    return b;
  }
  libraries() {
    return this.db.query("SELECT * FROM libraries ORDER BY id");
  }
  async library(data: any, libId?: number) {
    const values = [
      text(data.name, "Название", 2, 200),
      text(data.address, "Адрес", 2, 500),
      text(data.description || "", "Описание", 0, 5000),
    ];
    const rows = queryRows(
      libId
        ? await this.db.query(
            'UPDATE libraries SET name=$1,address=$2,description=$3,"updatedAt"=now() WHERE id=$4 RETURNING *',
            [...values, libId],
          )
        : await this.db.query(
            "INSERT INTO libraries(name,address,description) VALUES($1,$2,$3) RETURNING *",
            values,
          ),
    );
    if (!rows[0]) throw new NotFoundException();
    return rows[0];
  }
  async save(data: any, bookId?: number, file?: Express.Multer.File) {
    return this.db.transaction(async (em) => {
      const previous = bookId
        ? (
            await em.query("SELECT * FROM books WHERE id=$1 FOR UPDATE", [
              bookId,
            ])
          )[0]
        : null;
      if (bookId && !previous) throw new NotFoundException();
      const libraryId = id(data.libraryId ?? previous?.libraryId);
      if (
        !(await em.query("SELECT id FROM libraries WHERE id=$1", [libraryId]))
          .length
      )
        throw new BadRequestException("Выберите библиотеку");
      const total = count(data.totalCopies ?? previous?.totalCopies, 1);
      const reservations = bookId
        ? await em.query(
            `SELECT "dateStart","dateEnd" FROM rentals WHERE "bookId"=$1 AND status IN ('reserved','active')`,
            [bookId],
          )
        : [];
      const busy = peakReservations(
        reservations,
        new Date(-8640000000000000),
        new Date(8640000000000000),
      );
      const now = new Date();
      const busyNow = reservations.filter(
        (r: any) => new Date(r.dateStart) <= now && new Date(r.dateEnd) > now,
      ).length;
      if (total < busy)
        throw new ConflictException(
          "Нельзя уменьшить количество ниже числа действующих бронирований",
        );
      if (previous && libraryId !== previous.libraryId && busy)
        throw new ConflictException(
          "Сначала завершите аренды перед переносом книги",
        );
      const year =
        data.year === undefined
          ? (previous?.year ?? null)
          : data.year
            ? count(data.year, 0, 2100)
            : null;
      let cover: string | undefined;
      if (file) {
        const filename =
          file.filename ||
          randomUUID() +
            ({
              "image/jpeg": ".jpg",
              "image/png": ".png",
              "image/webp": ".webp",
            }[file.mimetype] || "");
        cover = `/uploads/${filename}`;
        if (process.env.UPLOAD_STORAGE === "database")
          await em.query(
            "INSERT INTO uploaded_covers(filename, mime_type, data) VALUES ($1,$2,$3)",
            [filename, file.mimetype, file.buffer],
          );
      }
      const values = [
        libraryId,
        text(data.title ?? previous?.title, "Название", 1, 300),
        text(data.author ?? previous?.author, "Автор", 1, 200),
        year,
        text(
          data.description ?? previous?.description ?? "",
          "Описание",
          0,
          10000,
        ),
        cover || previous?.coverImage || "",
        total,
        total - busyNow,
        data.isAvailable === undefined
          ? (previous?.isAvailable ?? true)
          : String(data.isAvailable) === "true",
      ];
      return queryRows(
        bookId
          ? await em.query(
              'UPDATE books SET "libraryId"=$1,title=$2,author=$3,year=$4,description=$5,"coverImage"=$6,"totalCopies"=$7,"availableCopies"=$8,"isAvailable"=$9,"updatedAt"=now() WHERE id=$10 RETURNING *',
              [...values, bookId],
            )
          : await em.query(
              'INSERT INTO books("libraryId",title,author,year,description,"coverImage","totalCopies","availableCopies","isAvailable") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
              values,
            ),
      )[0];
    });
  }
  async remove(kind: "books" | "libraries", recordId: number) {
    try {
      const rows = queryRows(
        await this.db.query(`DELETE FROM ${kind} WHERE id=$1 RETURNING id`, [
          recordId,
        ]),
      );
      if (!rows.length) throw new NotFoundException();
      return { success: true };
    } catch (e: any) {
      if (e.code === "23503")
        throw new ConflictException(
          "Есть связанные записи. Снимите книгу с публикации вместо удаления.",
        );
      throw e;
    }
  }
}
const upload = () =>
  FileInterceptor("coverImage", {
    storage:
      process.env.UPLOAD_STORAGE === "database"
        ? memoryStorage()
        : diskStorage({
            destination: "uploads",
            filename: (_r, f, cb) =>
              cb(
                null,
                randomUUID() +
                  ((
                    {
                      "image/jpeg": ".jpg",
                      "image/png": ".png",
                      "image/webp": ".webp",
                    } as Record<string, string>
                  )[f.mimetype] || ""),
              ),
          }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_r, f, cb) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.mimetype))
        return cb(
          new BadRequestException("Обложка должна быть JPEG, PNG или WebP"),
          false,
        );
      cb(null, true);
    },
  });
@Controller("api/common")
export class CatalogController {
  constructor(private service: CatalogService) {}
  @Get("books") books(@Query() q: any) {
    return this.service.books(q);
  }
  @Get("books/:id") book(@Param("id") value: string) {
    return this.service.book(id(value));
  }
  @Get("libraries") libraries() {
    return this.service.libraries();
  }
}
@Controller("api/admin")
export class AdminController {
  constructor(
    private service: CatalogService,
    private users: UsersService,
  ) {}
  @Post("libraries") library(@Req() req: any, @Body() b: any) {
    allow(req, "admin");
    return this.service.library(b);
  }
  @Patch("libraries/:id") editLibrary(
    @Req() req: any,
    @Body() b: any,
    @Param("id") v: string,
  ) {
    allow(req, "admin");
    return this.service.library(b, id(v));
  }
  @Delete("libraries/:id") deleteLibrary(
    @Req() req: any,
    @Param("id") v: string,
  ) {
    allow(req, "admin");
    return this.service.remove("libraries", id(v));
  }
  @Post("books") @UseInterceptors(upload()) create(
    @Req() req: any,
    @Body() b: any,
    @UploadedFile() file: any,
  ) {
    allow(req, "admin");
    return this.service.save(b, undefined, file);
  }
  @Patch("books/:id") @UseInterceptors(upload()) edit(
    @Req() req: any,
    @Body() b: any,
    @Param("id") v: string,
    @UploadedFile() file: any,
  ) {
    allow(req, "admin");
    return this.service.save(b, id(v), file);
  }
  @Delete("books/:id") remove(@Req() req: any, @Param("id") v: string) {
    allow(req, "admin");
    return this.service.remove("books", id(v));
  }
  @Get("users") async list(@Req() req: any, @Query() q: any) {
    allow(req, "admin");
    return (await this.users.findAll(q)).map(publicUser);
  }
  @Post("users") async user(@Req() req: any, @Body() b: any) {
    allow(req, "admin");
    return publicUser(await this.users.createAccount(b));
  }
  @Patch("users/:id") editUser(
    @Req() req: any,
    @Body() b: any,
    @Param("id") v: string,
  ) {
    allow(req, "admin");
    return this.users.update(id(v), b, req.user);
  }
  @Delete("users/:id") removeUser(@Req() req: any, @Param("id") v: string) {
    allow(req, "admin");
    return this.users.remove(id(v), req.user);
  }
}
@Controller("api/manager/users")
export class ManagerUsersController {
  constructor(private users: UsersService) {}
  @Get() async list(@Req() req: any, @Query() q: any) {
    allow(req, "manager");
    return (await this.users.findAll(q)).map(publicUser);
  }
}
@Controller("uploads")
export class UploadsController {
  constructor(private db: Database) {}
  @Get(":filename") async image(
    @Param("filename") filename: string,
    @Res() res: Response,
  ) {
    if (process.env.UPLOAD_STORAGE !== "database")
      throw new NotFoundException();
    const [cover] = await this.db.query(
      "SELECT mime_type, data FROM uploaded_covers WHERE filename=$1",
      [filename],
    );
    if (!cover) throw new NotFoundException();
    res.setHeader("Content-Type", cover.mime_type);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(cover.data);
  }
}
@Module({
  imports: [UsersModule],
  controllers: [
    CatalogController,
    AdminController,
    ManagerUsersController,
    UploadsController,
  ],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class LibrariesModule {}
