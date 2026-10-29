import {
  Injectable,
  Module,
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  OnModuleInit,
} from "@nestjs/common";
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { EventEmitter } from "node:events";
import { Database } from "./database.js";
import { allow } from "./auth.js";
import { id, text, page } from "./validation.js";
@Injectable()
export class SupportRequestService {
  readonly events = new EventEmitter();
  constructor(private db: Database) {}
  async authorize(chatId: number, user: any) {
    allow({ user }, "client", "manager");
    const chat = (
      await this.db.query("SELECT * FROM support_requests WHERE id=$1", [
        chatId,
      ])
    )[0];
    if (!chat) throw new NotFoundException();
    if (user.role === "client" && chat.userId !== user.id)
      throw new ForbiddenException();
    return chat;
  }
  async findSupportRequests(user: any, q?: any) {
    if (q === undefined) {
      const params = user;
      user = {
        id: params.user,
        role: params.user === null ? "manager" : "client",
      };
      q = {
        isActive:
          params.isActive === undefined ? undefined : String(params.isActive),
        limit: 100,
      };
    }
    const [limit, offset] = page(q);
    return this.db.query(
      `SELECT s.*,json_build_object('id',u.id,'name',u.name,'email',u.email,'contactPhone',u."contactPhone") AS client,EXISTS(SELECT 1 FROM messages m JOIN users a ON a.id=m."authorId" WHERE m."supportRequest"=s.id AND m."readAt" IS NULL AND (($1::int IS NOT NULL AND a.role='manager') OR ($1::int IS NULL AND a.role='client'))) AS "hasNewMessages" FROM support_requests s JOIN users u ON u.id=s."userId" WHERE ($1::int IS NULL OR s."userId"=$1) AND ($2::boolean IS NULL OR s."isActive"=$2) ORDER BY s.id DESC LIMIT $3 OFFSET $4`,
      [
        user.role === "client" ? user.id : null,
        q.isActive === undefined ? null : q.isActive === "true",
        limit,
        offset,
      ],
    );
  }
  async createSupportRequest(user: any, value: any) {
    const message = text(value, "Сообщение", 1, 5000);
    return this.db.transaction(async (em) => {
      const chat = (
        await em.query(
          'INSERT INTO support_requests("userId") VALUES($1) RETURNING *',
          [user.id],
        )
      )[0];
      await em.query(
        'INSERT INTO messages("supportRequest","authorId",text) VALUES($1,$2,$3)',
        [chat.id, user.id, message],
      );
      return chat;
    });
  }
  async getMessages(chatId: number, user?: any) {
    if (user !== undefined) await this.authorize(chatId, user);
    return this.db.query(
      `SELECT m.id,m.text,m."sentAt",m."sentAt" AS "createdAt",m."readAt",json_build_object('id',u.id,'name',u.name) AS author FROM messages m JOIN users u ON u.id=m."authorId" WHERE m."supportRequest"=$1 ORDER BY m.id`,
      [chatId],
    );
  }
  async sendMessage(chatId: any, user?: any, value?: any): Promise<any> {
    if (typeof chatId === "object") {
      const data = chatId;
      const author = (
        await this.db.query("SELECT * FROM users WHERE id=$1", [
          id(data.author),
        ])
      )[0];
      return this.sendMessage(id(data.supportRequest), author, data.text);
    }
    const request = await this.authorize(chatId, user);
    const message = text(value, "Сообщение", 1, 5000);
    const result = await this.db.transaction(async (em) => {
      const chat = (
        await em.query(
          "SELECT * FROM support_requests WHERE id=$1 FOR UPDATE",
          [chatId],
        )
      )[0];
      if (!chat.isActive) throw new ConflictException("Обращение закрыто");
      const m = (
        await em.query(
          'INSERT INTO messages("supportRequest","authorId",text) VALUES($1,$2,$3) RETURNING *',
          [chatId, user.id, message],
        )
      )[0];
      return {
        id: m.id,
        text: m.text,
        sentAt: m.sentAt,
        createdAt: m.sentAt,
        readAt: m.readAt,
        author: { id: user.id, name: user.name },
      };
    });
    this.events.emit("message", request, result);
    return result;
  }
  subscribe(handler: (request: any, message: any) => void) {
    this.events.on("message", handler);
    return () => {
      this.events.off("message", handler);
    };
  }
  async markMessagesAsRead(chatId: number, user: any, before: any) {
    await this.authorize(chatId, user);
    const date = new Date(String(before));
    if (!Number.isFinite(+date) || date > new Date())
      throw new ConflictException("Некорректная дата");
    await this.db.query(
      `UPDATE messages SET "readAt"=now() WHERE "supportRequest"=$1 AND "authorId" IN (SELECT id FROM users WHERE role=$2) AND "readAt" IS NULL AND "sentAt"<=$3`,
      [chatId, user.role === "client" ? "manager" : "client", date],
    );
    this.events.emit("read", chatId);
    return { success: true };
  }
  async getUnreadCount(chatId: number, user: any) {
    await this.authorize(chatId, user);
    return Number(
      (
        await this.db.query(
          'SELECT count(*) FROM messages WHERE "supportRequest"=$1 AND "authorId" IN (SELECT id FROM users WHERE role=$2) AND "readAt" IS NULL',
          [chatId, user.role === "client" ? "manager" : "client"],
        )
      )[0].count,
    );
  }
  async closeRequest(chatId: number, user: any) {
    await this.authorize(chatId, user);
    await this.db.query(
      'UPDATE support_requests SET "isActive"=false WHERE id=$1',
      [chatId],
    );
    this.events.emit("closed", chatId);
    return { success: true };
  }
}
export interface CreateSupportRequestDto {
  user: number;
  text: string;
}
export interface MarkMessagesAsReadDto {
  user: number;
  supportRequest: number;
  createdBefore: Date;
}
export interface SendMessageDto {
  author: number;
  supportRequest: number;
  text: string;
}
export interface GetChatListParams {
  user: number | null;
  isActive: boolean;
}
export interface ISupportRequestService {
  findSupportRequests(params: GetChatListParams): Promise<any[]>;
  sendMessage(data: SendMessageDto): Promise<any>;
  getMessages(supportRequest: number): Promise<any[]>;
  subscribe(handler: (request: any, message: any) => void): () => void;
}
export interface ISupportRequestClientService {
  createSupportRequest(data: CreateSupportRequestDto): Promise<any>;
  markMessagesAsRead(params: MarkMessagesAsReadDto): Promise<any>;
  getUnreadCount(supportRequest: number): Promise<number>;
}
export interface ISupportRequestEmployeeService {
  markMessagesAsRead(params: MarkMessagesAsReadDto): Promise<any>;
  getUnreadCount(supportRequest: number): Promise<number>;
  closeRequest(supportRequest: number): Promise<void>;
}
@Injectable()
export class SupportRequestClientService implements ISupportRequestClientService {
  constructor(
    private db: Database,
    private support: SupportRequestService,
  ) {}
  private async user(userId: number) {
    const user = (
      await this.db.query("SELECT * FROM users WHERE id=$1", [id(userId)])
    )[0];
    allow({ user }, "client");
    return user;
  }
  async createSupportRequest(data: CreateSupportRequestDto) {
    return this.support.createSupportRequest(
      await this.user(data.user),
      data.text,
    );
  }
  async markMessagesAsRead(data: MarkMessagesAsReadDto) {
    return this.support.markMessagesAsRead(
      data.supportRequest,
      await this.user(data.user),
      data.createdBefore,
    );
  }
  async getUnreadCount(chatId: number) {
    return Number(
      (
        await this.db.query(
          `SELECT count(*) FROM messages m JOIN users u ON u.id=m."authorId" WHERE m."supportRequest"=$1 AND m."readAt" IS NULL AND u.role='manager'`,
          [id(chatId)],
        )
      )[0].count,
    );
  }
}
@Injectable()
export class SupportRequestEmployeeService implements ISupportRequestEmployeeService {
  constructor(
    private db: Database,
    private support: SupportRequestService,
  ) {}
  async markMessagesAsRead(data: MarkMessagesAsReadDto) {
    const user = (
      await this.db.query("SELECT * FROM users WHERE id=$1", [id(data.user)])
    )[0];
    allow({ user }, "manager");
    return this.support.markMessagesAsRead(
      data.supportRequest,
      user,
      data.createdBefore,
    );
  }
  async getUnreadCount(chatId: number) {
    return Number(
      (
        await this.db.query(
          `SELECT count(*) FROM messages m JOIN users u ON u.id=m."authorId" WHERE m."supportRequest"=$1 AND m."readAt" IS NULL AND u.role='client'`,
          [id(chatId)],
        )
      )[0].count,
    );
  }
  async closeRequest(chatId: number) {
    const rows = await this.db.query(
      'UPDATE support_requests SET "isActive"=false WHERE id=$1 RETURNING id',
      [id(chatId)],
    );
    if (!rows.length) throw new NotFoundException();
    this.support.events.emit("closed", chatId);
  }
}
@WebSocketGateway({ transports: ["websocket", "polling"] })
export class SupportGateway implements OnModuleInit {
  @WebSocketServer() server!: Server;
  constructor(private support: SupportRequestService) {}
  onModuleInit() {
    this.support.subscribe((request, m) =>
      this.server.to(`chat:${request.id}`).emit("message", m),
    );
    for (const event of ["read", "closed"])
      this.support.events.on(event, (chatId: number) =>
        this.server.to(`chat:${chatId}`).emit(event, { chatId }),
      );
  }
  @SubscribeMessage("subscribeToChat") async subscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() chatId: any,
  ) {
    try {
      const user = (socket.request as any).user;
      await this.support.authorize(id(chatId), user);
      await socket.join(`chat:${id(chatId)}`);
      return { success: true };
    } catch {
      socket.emit("chatError", { message: "Нет доступа к чату" });
      return { success: false };
    }
  }
}
@Controller("api")
export class SupportController {
  constructor(private service: SupportRequestService) {}
  @Post("client/support-requests") create(@Req() req: any, @Body() b: any) {
    allow(req, "client");
    return this.service.createSupportRequest(req.user, b.text);
  }
  @Get(["client/support-requests", "manager/support-requests"]) list(
    @Req() req: any,
    @Query() q: any,
  ) {
    allow(req, req.path.includes("/manager/") ? "manager" : "client");
    return this.service.findSupportRequests(req.user, q);
  }
  @Get("common/support-requests/:id/messages") messages(
    @Req() req: any,
    @Param("id") v: string,
  ) {
    return this.service.getMessages(id(v), req.user);
  }
  @Post("common/support-requests/:id/messages") send(
    @Req() req: any,
    @Param("id") v: string,
    @Body() b: any,
  ) {
    return this.service.sendMessage(id(v), req.user, b.text);
  }
  @Post("common/support-requests/:id/messages/read") read(
    @Req() req: any,
    @Param("id") v: string,
    @Body() b: any,
  ) {
    return this.service.markMessagesAsRead(id(v), req.user, b.createdBefore);
  }
  @Get("common/support-requests/:id/unread") unread(
    @Req() req: any,
    @Param("id") v: string,
  ) {
    return this.service.getUnreadCount(id(v), req.user);
  }
  @Post("manager/support-requests/:id/close") close(
    @Req() req: any,
    @Param("id") v: string,
  ) {
    allow(req, "manager");
    return this.service.closeRequest(id(v), req.user);
  }
}
@Module({
  controllers: [SupportController],
  providers: [
    SupportRequestService,
    SupportRequestClientService,
    SupportRequestEmployeeService,
    SupportGateway,
  ],
  exports: [
    SupportRequestService,
    SupportRequestClientService,
    SupportRequestEmployeeService,
  ],
})
export class SupportModule {}
