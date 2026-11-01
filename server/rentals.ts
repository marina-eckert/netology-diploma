import {
  Injectable,
  Module,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { Database } from "./database.js";
import { allow } from "./auth.js";
import { dates, id, page } from "./validation.js";
import { peakReservations } from "./availability.js";
import { queryRows } from "./query.js";
@Injectable()
export class RentalsService {
  constructor(private db: Database) {}
  async list(userId: number | null, q: any) {
    const [limit, offset] = page(q);
    return this.db.query(
      'SELECT r.*,b.title,b.author,b."coverImage",l.name AS "libraryName",u.name AS "userName",u.email FROM rentals r JOIN books b ON b.id=r."bookId" JOIN libraries l ON l.id=r."libraryId" JOIN users u ON u.id=r."userId" WHERE ($1::int IS NULL OR r."userId"=$1) ORDER BY r.id DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset],
    );
  }
  async reserve(userId: number, b: any) {
    const bookId = id(b.bookId),
      libraryId = id(b.libraryId),
      [start, end] = dates(b.dateStart, b.dateEnd);
    return this.db.transaction(async (em) => {
      const book = (
        await em.query("SELECT * FROM books WHERE id=$1 FOR UPDATE", [bookId])
      )[0];
      if (!book) throw new NotFoundException("Книга не найдена");
      if (book.libraryId !== libraryId)
        throw new BadRequestException("Книга относится к другой библиотеке");
      if (!book.isAvailable)
        throw new ConflictException("Книга временно недоступна");
      const busy = await em.query(
        `SELECT "dateStart","dateEnd" FROM rentals WHERE "bookId"=$1 AND status IN ('reserved','active') AND "dateStart"<$3 AND "dateEnd">$2`,
        [bookId, start, end],
      );
      if (peakReservations(busy, start, end) >= book.totalCopies)
        throw new ConflictException(
          "На выбранные даты все экземпляры забронированы",
        );
      const rental = (
        await em.query(
          'INSERT INTO rentals("userId","libraryId","bookId","dateStart","dateEnd") VALUES($1,$2,$3,$4,$5) RETURNING *',
          [userId, libraryId, bookId, start, end],
        )
      )[0];
      await this.refresh(em, bookId);
      return rental;
    });
  }
  async refresh(em: any, bookId: number) {
    await em.query(
      `UPDATE books SET "availableCopies"=GREATEST(0,"totalCopies"-(SELECT count(*)::int FROM rentals WHERE "bookId"=$1 AND status IN ('reserved','active') AND "dateStart"<=now() AND "dateEnd">now())) WHERE id=$1`,
      [bookId],
    );
  }
  async status(rentalId: number, user: any, next: string) {
    return this.db.transaction(async (em) => {
      // Always lock book before rental, the same order used by reservation and catalogue changes.
      const preliminary = (
        await em.query('SELECT "bookId" FROM rentals WHERE id=$1', [rentalId])
      )[0];
      if (!preliminary) throw new NotFoundException();
      await em.query("SELECT id FROM books WHERE id=$1 FOR UPDATE", [
        preliminary.bookId,
      ]);
      const r = (
        await em.query("SELECT * FROM rentals WHERE id=$1 FOR UPDATE", [
          rentalId,
        ])
      )[0];
      if (
        user.role === "client" &&
        (r.userId !== user.id || next !== "cancelled")
      )
        throw new BadRequestException(
          "Можно отменить только своё бронирование",
        );
      const transitions: Record<string, string[]> = {
        reserved: ["active", "cancelled"],
        active: ["completed"],
        completed: [],
        cancelled: [],
      };
      if (!transitions[r.status].includes(next))
        throw new ConflictException("Недопустимое изменение статуса");
      const result = queryRows(
        await em.query(
          'UPDATE rentals SET status=$1,"updatedAt"=now() WHERE id=$2 RETURNING *',
          [next, rentalId],
        ),
      )[0];
      await this.refresh(em, r.bookId);
      return result;
    });
  }
}
@Controller("api")
export class RentalsController {
  constructor(private rentals: RentalsService) {}
  @Post("client/rentals") reserve(@Req() req: any, @Body() b: any) {
    allow(req, "client");
    return this.rentals.reserve(req.user.id, b);
  }
  @Get("client/rentals") mine(@Req() req: any, @Query() q: any) {
    allow(req, "client");
    return this.rentals.list(req.user.id, q);
  }
  @Post("client/rentals/:id/cancel") cancel(
    @Req() req: any,
    @Param("id") v: string,
  ) {
    allow(req, "client");
    return this.rentals.status(id(v), req.user, "cancelled");
  }
  @Get(["admin/rentals", "manager/rentals"]) all(
    @Req() req: any,
    @Query() q: any,
  ) {
    allow(req, req.path.includes("/admin/") ? "admin" : "manager");
    return this.rentals.list(null, q);
  }
  @Patch(["admin/rentals/:id", "manager/rentals/:id"]) status(
    @Req() req: any,
    @Param("id") v: string,
    @Body() b: any,
  ) {
    allow(req, req.path.includes("/admin/") ? "admin" : "manager");
    return this.rentals.status(id(v), req.user, b.status);
  }
}
@Module({ controllers: [RentalsController], providers: [RentalsService] })
export class RentalsModule {}
