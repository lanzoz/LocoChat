import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import * as mariadb from "mariadb";
import crypto from "crypto";
import os from "os";
import "dotenv/config";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.IP || "0.0.0.0";
const port = Number(process.env.PORT) || 3000;

const pool = mariadb.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "247756",
  database: process.env.DB_NAME || "project_lpc",
  connectionLimit: 10,
  connectTimeout: 10000,
});

const hashString = (text: string) =>
  crypto.createHash("sha256").update(text).digest("hex");

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function getCPUUsage() {
  const cpus = os.cpus();
  let totalIdle = 0,
    totalTick = 0;
  cpus.forEach((cpu) => {
    for (let type in cpu.times) totalTick += (cpu.times as any)[type];
    totalIdle += cpu.times.idle;
  });
  return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
}

let startMeasure = getCPUUsage();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res, parse(req.url!, true));
  });

  const io = new Server(httpServer, {
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8,
  });

  // ย้ายฟังก์ชัน broadcastRooms มาไว้นอก io.on เพื่อให้เรียกใช้ได้ทุกที่
  const broadcastRooms = async () => {
    try {
      const activeRooms: any = await pool.query(`SELECT 
        r.id, 
        r.name, 
        r.password_hash, 
        u.username as owner_name 
      FROM rooms r 
      LEFT JOIN users u ON r.owner_id = u.id`);
      const roomList = activeRooms.map((r: any) => {
        const usersInRoom =
          io.sockets.adapter.rooms.get(r.id.toString())?.size || 0;
        return {
          id: r.id.toString(),
          name: r.name,
          hasPassword: !!r.password_hash,
          userCount: usersInRoom,
          owner: r.owner_name
        };
      });
      io.emit("room-list-update", roomList);
    } catch (err) {
      console.error("Broadcast rooms error:", err);
    }
  };

  io.on("connection", (socket) => {
    let currentUser: { id: number; username: string } | null = null;
    let currentRoomId: string | null = null;

    console.log(`Connected: ${socket.id}`);
    broadcastRooms();

    socket.on("get-rooms", () => broadcastRooms());

    socket.on("register", async ({ username, password }) => {
      try {
        const rows: any = await pool.query(
          "SELECT id FROM users WHERE username = ?",
          [username],
        );
        if (rows.length > 0)
          return socket.emit("auth-error", "ชื่อนี้ถูกใช้ไปแล้ว");

        const result: any = await pool.query(
          "INSERT INTO users (username, password_hash) VALUES (?, ?)",
          [username, hashString(password)],
        );
        currentUser = { id: Number(result.insertId), username };
        socket.emit("auth-success", currentUser);
        broadcastRooms();
      } catch (err) {
        socket.emit("auth-error", "เกิดข้อผิดพลาดกับฐานข้อมูล");
      }
    });

    socket.on("login", async ({ username, password }) => {
      try {
        const rows: any = await pool.query(
          "SELECT id, username FROM users WHERE username = ? AND password_hash = ?",
          [username, hashString(password)],
        );
        if (rows.length > 0) {
          currentUser = rows[0];
          socket.emit("auth-success", currentUser);
          broadcastRooms();
        } else {
          socket.emit("auth-error", "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
        }
      } catch (err) {
        socket.emit("auth-error", "ระบบฐานข้อมูลขัดข้อง");
      }
    });

    socket.on("create-room", async ({ roomId, roomName, password }) => {
      if (!currentUser) return;
      try {
        const passHash = password ? hashString(password) : null;
        await pool.query(
          "INSERT INTO rooms (id, name, password_hash, owner_id) VALUES (?, ?, ?, ?)",
          [roomId, roomName, passHash, currentUser.id],
        );
        socket.join(roomId);
        currentRoomId = roomId;
        socket.emit("room-joined", { id: roomId, name: roomName });
        broadcastRooms();
      } catch (err) {
        socket.emit("room-error", "ไม่สามารถสร้างห้องได้");
      }
    });

    socket.on("join-room", async ({ roomId, password }) => {
      if (!currentUser) return;
      try {
        const rooms: any = await pool.query(
          "SELECT name, password_hash FROM rooms WHERE id = ?",
          [roomId],
        );
        if (rooms.length === 0)
          return socket.emit("room-error", "ไม่พบห้องนี้");

        const room = rooms[0];
        if (room.password_hash && room.password_hash !== hashString(password)) {
          return socket.emit("room-error", "รหัสผ่านห้องไม่ถูกต้อง");
        }

        socket.join(roomId);
        currentRoomId = roomId;
        socket.emit("room-joined", { id: roomId, name: room.name });

        const messages: any = await pool.query(
          "SELECT username as user, text, image_url as image, DATE_FORMAT(created_at, '%H:%i') as time FROM messages WHERE room_id = ? ORDER BY created_at ASC LIMIT 100",
          [roomId],
        );
        socket.emit("load-history", messages);

        io.to(roomId).emit("receive-message", {
          user: "System",
          text: `🟢 ${currentUser.username} เข้าร่วมการสนทนา`,
          time: new Date().toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
        broadcastRooms();
      } catch (err) {
        socket.emit("room-error", "เกิดข้อผิดพลาด");
      }
    });

    socket.on("send-message", async (data) => {
      if (!currentUser || !currentRoomId) return;
      const time = new Date().toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      });
      try {
        await pool.query(
          "INSERT INTO messages (room_id, user_id, username, text, image_url) VALUES (?, ?, ?, ?, ?)",
          [
            currentRoomId,
            currentUser.id,
            currentUser.username,
            data.text || null,
            data.image || null,
          ],
        );
        io.to(currentRoomId).emit("receive-message", { ...data, time });
      } catch (err) {
        console.error(err);
      }
    });

    socket.on("disconnect", () => {
      if (currentUser && currentRoomId) {
        io.to(currentRoomId).emit("receive-message", {
          user: "System",
          text: `🔴 ${currentUser.username} ออกจากห้องแล้ว`,
          time: new Date().toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
      }
      setTimeout(() => broadcastRooms(), 500);
    });
  });

  // อัปเดต CPU ทุก 3 วินาที
  setInterval(() => {
    const endMeasure = getCPUUsage();
    const idleDiff = endMeasure.idle - startMeasure.idle;
    const totalDiff = endMeasure.total - startMeasure.total;
    const percentage = 100 - Math.floor((100 * idleDiff) / totalDiff);
    io.emit("cpu-usage", percentage);
    startMeasure = endMeasure;
  }, 3000);

  httpServer.listen(port, () =>
    console.log(`> Loco Server Ready on http://${hostname}:${port}`),
  );
});
