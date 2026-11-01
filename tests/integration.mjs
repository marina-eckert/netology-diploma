// Run only against the local diploma server. Creates uniquely named fixtures and removes only those fixtures.
import assert from "node:assert/strict";
import { DataSource } from "typeorm";
import { io } from "socket.io-client";
import { hash } from "bcryptjs";
import "reflect-metadata";
import { readFileSync } from "node:fs";
const base = process.env.TEST_URL || "http://127.0.0.1:3000";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))
  throw new Error("Tests are restricted to localhost");
const db = new DataSource({
  type: "postgres",
  host: "127.0.0.1",
  port: Number(process.env.TEST_DB_PORT || 5438),
  username: process.env.TEST_DB_USER || "library",
  password: process.env.TEST_DB_PASSWORD || "library_local",
  database: process.env.TEST_DB_NAME || "library",
});
await db.initialize();
const suffix = Date.now(),
  created = { users: [], libraries: [], books: [], chats: [] };
const sockets = [];
let checks = 0;
function ok(condition, message) {
  assert.ok(condition, message);
  checks++;
  console.log("✓ " + message);
}
async function request(
  path,
  { cookie, method = "GET", body, headers = {} } = {},
) {
  const isForm = body instanceof FormData;
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body && !isForm ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    body: await r.json().catch(() => null),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
async function login(email, password = "Library123!") {
  const r = await request("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(r.status, 200);
  assert.ok(r.cookie);
  return r.cookie;
}
const future = (n) => new Date(Date.now() + n * 86400000).toISOString();
try {
  const catalog = await request("/common/books");
  ok(
    catalog.status === 200 && catalog.body.length === 11,
    "Каталог содержит 11 книг из макета",
  );
  const guest = await request("/admin/users");
  ok(guest.status === 401, "Гость не имеет доступа к управлению");
  const admin = await login("admin@library.local"),
    manager = await login("manager@library.local");
  for (let i = 0; i < 2; i++) {
    const u = await request("/client/register", {
      method: "POST",
      body: {
        name: "Тест " + suffix + " " + i,
        email: `test-${suffix}-${i}@example.test`,
        password: "Library123!",
        role: "admin",
      },
    });
    assert.equal(u.status, 201);
    created.users.push(u.body.id);
    ok(
      u.body.role === "client" && !u.body.passwordHash,
      "Регистрация не позволяет назначить admin или получить хеш",
    );
  }
  const client = await login(`test-${suffix}-0@example.test`),
    other = await login(`test-${suffix}-1@example.test`);
  const badPassword = await request("/auth/login", {
    method: "POST",
    body: {
      email: `test-${suffix}-0@example.test`,
      password: "wrong-password",
    },
  });
  ok(badPassword.status === 401, "Неверный пароль возвращает 401");
  const unknownUser = await request("/auth/login", {
    method: "POST",
    body: { email: `absent-${suffix}@example.test`, password: "Library123!" },
  });
  ok(unknownUser.status === 401, "Неизвестный email возвращает 401");
  const duplicate = await request("/client/register", {
    method: "POST",
    body: {
      name: "Дубликат",
      email: `test-${suffix}-0@example.test`,
      password: "Library123!",
    },
  });
  ok(
    duplicate.status === 400,
    "Повторный email при регистрации возвращает 400",
  );
  const userList = await request(
    "/admin/users?" +
      new URLSearchParams({
        name: String(suffix),
        email: "example.test",
        limit: "1",
        offset: "1",
      }),
    { cookie: admin },
  );
  ok(
    userList.status === 200 &&
      userList.body.length === 1 &&
      userList.body[0].id === created.users[1] &&
      !("passwordHash" in userList.body[0]),
    "Фильтры и пагинация пользователей работают без раскрытия хешей",
  );
  const modelUser = (
    await db.query("SELECT id,_id,role FROM users WHERE id=$1", [
      created.users[0],
    ])
  )[0];
  ok(
    modelUser._id === modelUser.id,
    "Модель пользователя содержит числовой _id",
  );
  const spacedPassword = "  Library123!  ";
  const updated = await request("/admin/users/" + created.users[1], {
    cookie: admin,
    method: "PATCH",
    body: { password: spacedPassword },
  });
  ok(
    updated.status === 200 &&
      updated.body.id === created.users[1] &&
      updated.body.email === `test-${suffix}-1@example.test` &&
      !("passwordHash" in updated.body),
    "Редактирование пользователя не раскрывает хеш",
  );
  await login(`test-${suffix}-1@example.test`, spacedPassword);
  ok(true, "Пароль с пробелами сохраняется без незаметного изменения");
  const profile = await request("/auth/me", {
    cookie: client,
    method: "PATCH",
    body: { name: "Обновлённый читатель", contactPhone: "+70000000000" },
  });
  ok(
    profile.status === 200 &&
      profile.body.name === "Обновлённый читатель" &&
      profile.body.id === created.users[0],
    "Обновление профиля возвращает корректный объект пользователя",
  );
  const denied = await request("/admin/libraries", {
    cookie: client,
    method: "POST",
    body: { name: "x", address: "x" },
  });
  ok(denied.status === 403, "Клиент не может создавать библиотеки");
  const cross = await request("/client/support-requests", {
    cookie: client,
    method: "POST",
    body: { text: "x" },
    headers: { origin: "https://attacker.example" },
  });
  ok(cross.status === 403, "Запись с чужого Origin блокируется");
  const lib = await request("/admin/libraries", {
    cookie: admin,
    method: "POST",
    body: { name: "Тест " + suffix, address: "Тестовый адрес" },
  });
  assert.equal(lib.status, 201);
  created.libraries.push(lib.body.id);
  const libraryEdit = await request("/admin/libraries/" + lib.body.id, {
    cookie: admin,
    method: "PATCH",
    body: { name: "Обновлённая библиотека " + suffix, address: "Новый адрес" },
  });
  ok(
    libraryEdit.status === 200 &&
      libraryEdit.body.id === lib.body.id &&
      libraryEdit.body.address === "Новый адрес",
    "Редактирование библиотеки возвращает объект, а не служебный результат ORM",
  );
  const book = await request("/admin/books", {
    cookie: admin,
    method: "POST",
    body: {
      title: "Тест " + suffix,
      author: "Автор",
      libraryId: lib.body.id,
      totalCopies: 1,
    },
  });
  assert.equal(book.status, 201);
  created.books.push(book.body.id);
  const upload = new FormData();
  upload.set(
    "coverImage",
    new Blob([readFileSync("public/covers/cover-1.jpg")], {
      type: "image/jpeg",
    }),
    "cover.jpg",
  );
  const cover = await request("/admin/books/" + book.body.id, {
    cookie: admin,
    method: "PATCH",
    body: upload,
  });
  ok(
    cover.status === 200 && cover.body.coverImage.startsWith("/uploads/"),
    "Обложка загружается через multipart/form-data",
  );
  const coverFile = await fetch(base + cover.body.coverImage);
  ok(
    coverFile.status === 200 &&
      coverFile.headers.get("content-type").startsWith("image/jpeg"),
    "Загруженная обложка доступна с безопасным MIME-типом",
  );
  const unsupported = new FormData();
  unsupported.set(
    "coverImage",
    new Blob(["<script>alert(1)</script>"], { type: "text/html" }),
    "cover.html",
  );
  const unsafeUpload = await request("/admin/books/" + book.body.id, {
    cookie: admin,
    method: "PATCH",
    body: unsupported,
  });
  ok(unsafeUpload.status === 400, "HTML вместо обложки отклоняется");
  const booking = {
    bookId: book.body.id,
    libraryId: lib.body.id,
    dateStart: future(2),
    dateEnd: future(7),
  };
  const wrong = await request("/client/rentals", {
    cookie: client,
    method: "POST",
    body: { ...booking, dateEnd: future(1) },
  });
  ok(wrong.status === 400, "Обратный период аренды отклоняется");
  const concurrent = await Promise.all(
    [client, other].map((cookie) =>
      request("/client/rentals", { cookie, method: "POST", body: booking }),
    ),
  );
  ok(
    concurrent.filter((r) => r.status === 201).length === 1 &&
      concurrent.filter((r) => r.status === 409).length === 1,
    "Два одновременных запроса: последний экземпляр достаётся только одному",
  );
  const winner = concurrent[0].status === 201 ? client : other,
    loser = winner === client ? other : client,
    rental = concurrent.find((r) => r.status === 201).body;
  const unavailable = await request(
    "/common/books?" +
      new URLSearchParams({
        library: String(lib.body.id),
        dateStart: booking.dateStart,
        dateEnd: booking.dateEnd,
      }),
  );
  ok(
    unavailable.status === 200 && unavailable.body.length === 0,
    "Каталог исключает занятую книгу на выбранный период",
  );
  const later = await request(
    "/common/books?" +
      new URLSearchParams({
        library: String(lib.body.id),
        dateStart: future(8),
        dateEnd: future(9),
      }),
  );
  ok(
    later.status === 200 && later.body.length === 1,
    "Та же книга доступна в непересекающийся период",
  );
  const theft = await request("/client/rentals/" + rental.id + "/cancel", {
    cookie: loser,
    method: "POST",
  });
  ok(theft.status === 400, "Нельзя отменить чужое бронирование");
  const cancel = await request("/client/rentals/" + rental.id + "/cancel", {
    cookie: winner,
    method: "POST",
  });
  ok(cancel.status === 201, "Владелец может отменить свою бронь");
  const again = await request("/client/rentals", {
    cookie: loser,
    method: "POST",
    body: booking,
  });
  ok(again.status === 201, "После отмены экземпляр снова доступен");
  const activate = await request("/manager/rentals/" + again.body.id, {
    cookie: manager,
    method: "PATCH",
    body: { status: "active" },
  });
  ok(
    activate.status === 200 &&
      activate.body.id === again.body.id &&
      activate.body.status === "active",
    "Консультант может выдать книгу",
  );
  const complete = await request("/manager/rentals/" + again.body.id, {
    cookie: manager,
    method: "PATCH",
    body: { status: "completed" },
  });
  ok(
    complete.status === 200 && complete.body.status === "completed",
    "Консультант может принять возврат",
  );
  const elapsedReservation = (
    await db.query(
      'INSERT INTO rentals("userId","libraryId","bookId","dateStart","dateEnd") VALUES($1,$2,$3,now()-interval \'1 hour\',now()+interval \'1 hour\') RETURNING id',
      [created.users[0], lib.body.id, book.body.id],
    )
  )[0];
  const currentBook = await request("/common/books/" + book.body.id);
  ok(
    currentBook.body.availableCopies === 0,
    "availableCopies вычисляется на текущий момент, даже после смены времени",
  );
  await db.query("DELETE FROM rentals WHERE id=$1", [elapsedReservation.id]);
  const chat = await request("/client/support-requests", {
    cookie: client,
    method: "POST",
    body: { text: "Тестовое обращение" },
  });
  assert.equal(chat.status, 201);
  ok(
    Array.isArray(chat.body) &&
      chat.body.length === 1 &&
      chat.body[0].hasNewMessages === false,
    "Создание обращения возвращает массив и hasNewMessages согласно заданию",
  );
  const chatResult = chat.body[0];
  chat.body = chatResult;
  created.chats.push(chatResult.id);
  const anonymousHistory = await request(
    "/common/support-requests/" + chatResult.id + "/messages",
  );
  ok(anonymousHistory.status === 401, "Гость не может читать историю чата");
  for (const [path, method, body] of [
    ["/client/support-requests", "GET", undefined],
    ["/manager/support-requests", "GET", undefined],
    [
      "/common/support-requests/" + chatResult.id + "/messages",
      "POST",
      { text: "Гость" },
    ],
    [
      "/common/support-requests/" + chatResult.id + "/messages/read",
      "POST",
      { createdBefore: new Date().toISOString() },
    ],
  ]) {
    const denied = await request(path, { method, body });
    ok(denied.status === 401, `Гостю запрещён ${method} ${path}`);
  }
  const adminHistory = await request(
    "/common/support-requests/" + chatResult.id + "/messages",
    { cookie: admin },
  );
  ok(
    adminHistory.status === 403,
    "Роль admin не получает доступ к чату консультанта",
  );
  const chatModels = (
    await db.query(
      'SELECT _id,id,"user", "userId" FROM support_requests WHERE id=$1',
      [chatResult.id],
    )
  )[0];
  ok(
    chatModels._id === chatModels.id && chatModels.user === created.users[0],
    "Модель обращения содержит _id и user",
  );
  const spy = await request(
    "/common/support-requests/" + chat.body.id + "/messages",
    { cookie: other },
  );
  ok(spy.status === 403, "История чужого чата недоступна");
  const socket = io(base, {
    transports: ["websocket"],
    extraHeaders: { cookie: client },
    forceNew: true,
  });
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
    setTimeout(
      () => reject(new Error("WebSocket connection timeout")),
      5000,
    ).unref();
  });
  const subscribed = await new Promise((resolve) =>
    socket.emit("subscribeToChat", chat.body.id, resolve),
  );
  ok(subscribed.success, "WebSocket подписывается с HTTP-сессией Passport");
  const message = new Promise((resolve, reject) => {
    socket.once("message", resolve);
    setTimeout(() => reject(new Error("No message event")), 5000).unref();
  });
  const answer = await request(
    "/common/support-requests/" + chat.body.id + "/messages",
    { cookie: manager, method: "POST", body: { text: "Ответ консультанта" } },
  );
  assert.equal(answer.status, 201);
  ok(
    Array.isArray(answer.body) &&
      answer.body[0].author.name &&
      answer.body[0].createdAt,
    "Отправка сообщения возвращает массив с автором и временем",
  );
  const messageModel = (
    await db.query(
      'SELECT id,_id,author,"authorId" FROM messages WHERE id=$1',
      [answer.body[0].id],
    )
  )[0];
  ok(
    messageModel._id === messageModel.id &&
      messageModel.author === messageModel.authorId,
    "Модель сообщения содержит _id и числовой author",
  );
  ok(
    (await message).text === "Ответ консультанта",
    "Ответ консультанта доставляется через WebSocket",
  );
  const unread = await request(
    "/common/support-requests/" + chat.body.id + "/unread",
    { cookie: client },
  );
  ok(unread.body === 1, "Счётчик непрочитанных учитывает ответ сотрудника");
  await request("/common/support-requests/" + chat.body.id + "/messages/read", {
    cookie: client,
    method: "POST",
    body: { createdBefore: new Date().toISOString() },
  });
  const read = await request(
    "/common/support-requests/" + chat.body.id + "/unread",
    { cookie: client },
  );
  ok(read.body === 0, "Прочтение обнуляет счётчик");
  const temporaryManager = await request("/admin/users", {
    cookie: admin,
    method: "POST",
    body: {
      name: "Временный консультант",
      email: `manager-${suffix}@example.test`,
      password: "Library123!",
      role: "manager",
    },
  });
  created.users.push(temporaryManager.body.id);
  const temporaryCookie = await login(`manager-${suffix}@example.test`);
  const revokedSocket = io(base, {
    transports: ["websocket"],
    extraHeaders: { cookie: temporaryCookie },
    forceNew: true,
  });
  sockets.push(revokedSocket);
  await new Promise((resolve, reject) => {
    revokedSocket.once("connect", resolve);
    revokedSocket.once("connect_error", reject);
    setTimeout(() => reject(new Error("Socket timeout")), 5000).unref();
  });
  const roleSubscription = await new Promise((resolve) =>
    revokedSocket.emit("subscribeToChat", chat.body.id, resolve),
  );
  ok(roleSubscription.success, "Консультант может подписаться на обращение");
  await request("/admin/users/" + temporaryManager.body.id, {
    cookie: admin,
    method: "PATCH",
    body: { role: "client" },
  });
  let leakedMessage = false;
  revokedSocket.on("message", () => {
    leakedMessage = true;
  });
  const revoked = new Promise((resolve, reject) => {
    revokedSocket.once("disconnect", resolve);
    setTimeout(
      () => reject(new Error("Revoked role remained subscribed")),
      5000,
    ).unref();
  });
  await request("/common/support-requests/" + chat.body.id + "/messages", {
    cookie: client,
    method: "POST",
    body: { text: "После смены роли" },
  });
  await revoked;
  ok(
    !leakedMessage && !revokedSocket.connected,
    "После снятия роли консультанта WebSocket не раскрывает новые сообщения",
  );
  await request("/manager/support-requests/" + chat.body.id + "/close", {
    cookie: manager,
    method: "POST",
  });
  const closed = await request(
    "/common/support-requests/" + chat.body.id + "/messages",
    { cookie: client, method: "POST", body: { text: "Закрыто" } },
  );
  ok(closed.status === 409, "В закрытый чат нельзя отправить сообщение");
  const stranger = io(base, {
    transports: ["websocket"],
    extraHeaders: { cookie: other },
    forceNew: true,
  });
  sockets.push(stranger);
  await new Promise((r, j) => {
    stranger.once("connect", r);
    stranger.once("connect_error", j);
  });
  const sub = await new Promise((r) =>
    stranger.emit("subscribeToChat", chat.body.id, r),
  );
  ok(!sub.success, "Нельзя подписаться на чужой чат через WebSocket");
  const disconnected = new Promise((resolve, reject) => {
    socket.once("disconnect", resolve);
    setTimeout(
      () => reject(new Error("Socket remained connected after logout")),
      5000,
    ).unref();
  });
  const logout = await request("/auth/logout", {
    cookie: client,
    method: "POST",
  });
  ok(
    logout.status === 200 && logout.body === null,
    "Выход возвращает пустой ответ",
  );
  await disconnected;
  ok(!socket.connected, "Выход отключает WebSocket той же сессии");
  const after = await request("/client/rentals", { cookie: client });
  ok(after.status === 401, "Выход уничтожает серверную сессию");
  const { UsersService } = await import("../dist-server/auth.js");
  const {
    SupportRequestService,
    SupportRequestClientService,
    SupportRequestEmployeeService,
  } = await import("../dist-server/support.js");
  const usersService = new UsersService(db);
  const internalUser = await usersService.create({
    email: `service-${suffix}@example.test`,
    name: "Сервисный пользователь",
    passwordHash: await hash("Library123!", 4),
  });
  created.users.push(internalUser.id);
  ok(
    internalUser._id === internalUser.id && !!internalUser.passwordHash,
    "IUserService.create принимает Partial<User> с passwordHash",
  );
  const service = new SupportRequestService(db),
    clientService = new SupportRequestClientService(db, service),
    employeeService = new SupportRequestEmployeeService(db, service);
  const serviceChat = await clientService.createSupportRequest({
    user: created.users[0],
    text: "Сервисное обращение",
  });
  created.chats.push(serviceChat.id);
  const serviceChats = await service.findSupportRequests({
    user: created.users[0],
    isActive: true,
  });
  ok(
    serviceChats.some(
      (c) => c._id === serviceChat.id && c.user === created.users[0],
    ),
    "ISupportRequestService.findSupportRequests принимает GetChatListParams",
  );
  let notifications = 0;
  const unsubscribe = service.subscribe((c, m) => {
    assert.equal(c._id, serviceChat.id);
    assert.equal(typeof m.author, "number");
    notifications++;
  });
  const managerId = (
    await db.query("SELECT id FROM users WHERE email=$1", [
      "manager@library.local",
    ])
  )[0].id;
  await service.sendMessage({
    supportRequest: serviceChat.id,
    author: managerId,
    text: "Ответ через сервис",
  });
  ok(notifications === 1, "EventEmitter передаёт модели обращения и сообщения");
  unsubscribe();
  const internalMessages = await service.getMessages(serviceChat.id);
  ok(
    internalMessages.length === 2 &&
      internalMessages[0]._id &&
      typeof internalMessages[0].author === "number",
    "Внутренний getMessages возвращает модели Message",
  );
  ok(
    (await clientService.getUnreadCount(serviceChat.id)) === 1,
    "Сервис клиента считает непрочитанные ответы сотрудников",
  );
  await clientService.markMessagesAsRead({
    user: created.users[0],
    supportRequest: serviceChat.id,
    createdBefore: new Date(),
  });
  ok(
    (await clientService.getUnreadCount(serviceChat.id)) === 0,
    "Сервис клиента помечает ответы прочитанными",
  );
  ok(
    (await employeeService.getUnreadCount(serviceChat.id)) === 1,
    "Сервис сотрудника считает непрочитанные сообщения клиента",
  );
  await employeeService.markMessagesAsRead({
    user: managerId,
    supportRequest: serviceChat.id,
    createdBefore: new Date(),
  });
  ok(
    (await employeeService.getUnreadCount(serviceChat.id)) === 0,
    "Сервис сотрудника помечает сообщения клиента прочитанными",
  );
  await employeeService.closeRequest(serviceChat.id);
  const closedModel = (
    await db.query('SELECT "isActive" FROM support_requests WHERE id=$1', [
      serviceChat.id,
    ])
  )[0];
  ok(closedModel.isActive === false, "Сервис сотрудника закрывает обращение");
  const deletedUser = await request("/admin/users/" + internalUser.id, {
    cookie: admin,
    method: "DELETE",
  });
  ok(
    deletedUser.status === 200 && deletedUser.body.success === true,
    "Администратор удаляет пользователя без связанной истории",
  );
  const absentUser = await request("/admin/users/" + internalUser.id, {
    cookie: admin,
    method: "DELETE",
  });
  ok(
    absentUser.status === 404,
    "Повторное удаление пользователя возвращает 404",
  );
  const absentBook = await request("/admin/books/2147483647", {
    cookie: admin,
    method: "DELETE",
  });
  ok(absentBook.status === 404, "Удаление отсутствующей книги возвращает 404");
  const absentLibrary = await request("/admin/libraries/2147483647", {
    cookie: admin,
    method: "PATCH",
    body: { name: "Нет записи", address: "Нет адреса" },
  });
  ok(
    absentLibrary.status === 404,
    "Редактирование отсутствующей библиотеки возвращает 404",
  );
  console.log(`\n${checks} интеграционных проверок пройдено`);
} finally {
  for (const s of sockets) s.disconnect();
  for (const chat of created.chats)
    await db.query("DELETE FROM support_requests WHERE id=$1", [chat]);
  for (const book of created.books) {
    await db.query('DELETE FROM rentals WHERE "bookId"=$1', [book]);
    await db.query("DELETE FROM books WHERE id=$1", [book]);
  }
  for (const library of created.libraries)
    await db.query("DELETE FROM libraries WHERE id=$1", [library]);
  for (const user of created.users)
    await db.query("DELETE FROM users WHERE id=$1", [user]);
  await db.destroy();
}
