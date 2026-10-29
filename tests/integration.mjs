// Run only against the local diploma server. Creates uniquely named fixtures and removes only those fixtures.
import assert from "node:assert/strict";
import { DataSource } from "typeorm";
import { io } from "socket.io-client";
const base = process.env.TEST_URL || "http://127.0.0.1:3000";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))
  throw new Error("Tests are restricted to localhost");
const db = new DataSource({
  type: "postgres",
  host: "127.0.0.1",
  port: 5438,
  username: "library",
  password: "library_local",
  database: "library",
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
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    body: await r.json().catch(() => null),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
async function login(email) {
  const r = await request("/auth/login", {
    method: "POST",
    body: { email, password: "Library123!" },
  });
  assert.equal(r.status, 201 === r.status ? 201 : 200);
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
  ok(activate.status === 200, "Консультант может выдать книгу");
  const complete = await request("/manager/rentals/" + again.body.id, {
    cookie: manager,
    method: "PATCH",
    body: { status: "completed" },
  });
  ok(complete.status === 200, "Консультант может принять возврат");
  const chat = await request("/client/support-requests", {
    cookie: client,
    method: "POST",
    body: { text: "Тестовое обращение" },
  });
  assert.equal(chat.status, 201);
  created.chats.push(chat.body.id);
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
  await request("/auth/logout", { cookie: client, method: "POST" });
  await disconnected;
  ok(!socket.connected, "Выход отключает WebSocket той же сессии");
  const after = await request("/client/rentals", { cookie: client });
  ok(after.status === 401, "Выход уничтожает серверную сессию");
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
