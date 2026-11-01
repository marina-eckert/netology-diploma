import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  Res,
  Injectable,
  Module,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  UseGuards,
  HttpCode,
  NotFoundException,
} from "@nestjs/common";
import passport from "passport";
import { Strategy } from "passport-local";
import { compare, hash } from "bcryptjs";
import { Database } from "./database.js";
import { text, publicUser, page, password } from "./validation.js";
import type { User, SearchUserParams, IUserService } from "./models.js";
import { queryRows } from "./query.js";
@Injectable()
export class UsersService implements IUserService {
  constructor(private db: Database) {}
  async findById(id: number): Promise<User> {
    const user = (
      await this.db.query("SELECT * FROM users WHERE id=$1", [id])
    )[0];
    if (!user) throw new NotFoundException("Пользователь не найден");
    return user;
  }
  async findByEmail(email: string): Promise<User> {
    const user = (
      await this.db.query("SELECT * FROM users WHERE email=$1", [
        email.toLowerCase(),
      ])
    )[0];
    if (!user) throw new NotFoundException("Пользователь не найден");
    return user;
  }
  async createAccount(data: any): Promise<User> {
    return this.create({
      email: data.email,
      name: data.name,
      contactPhone: data.contactPhone,
      role: data.role,
      passwordHash: await hash(password(data.password), 12),
    });
  }
  async create(data: Partial<User>): Promise<User> {
    const email = text(data.email, "Email").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new ConflictException("Некорректный email");
    const name = text(data.name, "Имя", 2, 100),
      phone = text(data.contactPhone || "", "Телефон", 0, 40);
    if (
      !data.passwordHash ||
      !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(data.passwordHash)
    )
      throw new BadRequestException("Требуется bcrypt-хеш пароля");
    const role = data.role || "client";
    if (!["client", "admin", "manager"].includes(role))
      throw new ConflictException("Некорректная роль");
    try {
      return (
        await this.db.query(
          'INSERT INTO users(email,name,"passwordHash","contactPhone",role) VALUES($1,$2,$3,$4,$5) RETURNING *',
          [email, name, data.passwordHash, phone, role],
        )
      )[0];
    } catch (e: any) {
      if (e.code === "23505") throw new BadRequestException("Email уже занят");
      throw e;
    }
  }
  async findAll(q: Partial<SearchUserParams>): Promise<User[]> {
    const [limit, offset] = page(q);
    return await this.db.query(
      'SELECT * FROM users WHERE email ILIKE $1 AND name ILIKE $2 AND "contactPhone" ILIKE $3 ORDER BY id LIMIT $4 OFFSET $5',
      [
        `%${q.email || ""}%`,
        `%${q.name || ""}%`,
        `%${q.contactPhone || ""}%`,
        limit,
        offset,
      ],
    );
  }
  async update(userId: number, data: any, actor: any) {
    const old = await this.findById(userId);
    if (!old) throw new ConflictException("Пользователь не найден");
    const email = text(data.email ?? old.email, "Email").toLowerCase(),
      name = text(data.name ?? old.name, "Имя", 2, 100),
      phone = text(data.contactPhone ?? old.contactPhone, "Телефон", 0, 40),
      role = actor.role === "admin" ? (data.role ?? old.role) : old.role;
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !["client", "manager", "admin"].includes(role)
    )
      throw new ConflictException("Некорректные данные");
    if (actor.id === userId && role !== old.role)
      throw new ConflictException("Нельзя изменить собственную роль");
    const passwordHash = data.password
      ? await hash(password(data.password), 12)
      : old.passwordHash;
    try {
      return publicUser(
        queryRows(
          await this.db.query(
            'UPDATE users SET email=$1,name=$2,"contactPhone"=$3,role=$4,"passwordHash"=$5 WHERE id=$6 RETURNING *',
            [email, name, phone, role, passwordHash, userId],
          ),
        )[0],
      );
    } catch (e: any) {
      if (e.code === "23505") throw new ConflictException("Email уже занят");
      throw e;
    }
  }
  async remove(userId: number, actor: any) {
    if (userId === actor.id)
      throw new ConflictException("Нельзя удалить собственный аккаунт");
    try {
      const rows = queryRows(
        await this.db.query("DELETE FROM users WHERE id=$1 RETURNING id", [
          userId,
        ]),
      );
      if (!rows.length) throw new NotFoundException("Пользователь не найден");
      return { success: true };
    } catch (e: any) {
      if (e.code === "23503")
        throw new ConflictException(
          "У пользователя есть бронирования или обращения. Удаление недоступно.",
        );
      throw e;
    }
  }
}
@Module({ providers: [UsersService], exports: [UsersService] })
export class UsersModule {}
@Injectable()
export class SessionGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    if (!req.isAuthenticated?.())
      throw new UnauthorizedException("Войдите в аккаунт");
    return true;
  }
}
export function allow(req: any, ...roles: string[]) {
  if (!req.user) throw new UnauthorizedException("Войдите в аккаунт");
  if (!roles.includes(req.user.role))
    throw new ForbiddenException("Недостаточно прав");
}
@Controller("api/auth")
export class AuthController {
  constructor(private users: UsersService) {}
  @Get("me") me(@Req() req: any) {
    return publicUser(req.user);
  }
  @UseGuards(SessionGuard) @Patch("me") update(
    @Req() req: any,
    @Body() body: any,
  ) {
    return this.users.update(
      req.user.id,
      { name: body.name, contactPhone: body.contactPhone, email: body.email },
      req.user,
    );
  }
  @Post("login") @HttpCode(200) login(
    @Req() req: any,
    @Res() res: any,
    @Body() body: any,
  ) {
    text(body.email, "Email");
    password(body.password, 1);
    if (req.user) throw new ConflictException("Вы уже вошли");
    passport.authenticate("local", (err: any, user: any) => {
      if (err) return res.status(500).json({ message: "Не удалось войти" });
      if (!user)
        return res.status(401).json({ message: "Неверный email или пароль" });
      req.logIn(user, (e: any) =>
        e
          ? res.status(500).json({ message: "Ошибка сессии" })
          : res.json(publicUser(user)),
      );
    })(req, res);
  }
  @UseGuards(SessionGuard) @Post("logout") logout(
    @Req() req: any,
    @Res() res: any,
  ) {
    req.logout(() =>
      req.session.destroy(() => {
        res.clearCookie("library.sid");
        res.status(200).end();
      }),
    );
  }
}
@Controller("api/client")
export class RegisterController {
  constructor(private users: UsersService) {}
  @Post("register") async register(@Body() body: any, @Req() req: any) {
    if (req.user) throw new ConflictException("Вы уже вошли");
    return publicUser(
      await this.users.createAccount({ ...body, role: "client" }),
    );
  }
}
@Module({
  imports: [UsersModule],
  controllers: [AuthController, RegisterController],
  providers: [SessionGuard],
  exports: [SessionGuard],
})
export class AuthModule {}
export function configurePassport(users: UsersService) {
  passport.use(
    new Strategy({ usernameField: "email" }, async (email, password, done) => {
      try {
        const u = await users.findByEmail(email);
        done(null, u && (await compare(password, u.passwordHash)) ? u : false);
      } catch (e) {
        if (e instanceof NotFoundException) done(null, false);
        else done(e);
      }
    }),
  );
  passport.serializeUser((u: any, done) => done(null, u.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      done(null, (await users.findById(id)) || false);
    } catch (e) {
      if (e instanceof NotFoundException) done(null, false);
      else done(e);
    }
  });
}
