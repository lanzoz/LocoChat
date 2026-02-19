import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import * as mariadb from "mariadb";
import crypto from "crypto";
import os from 'os';
import 'dotenv/config';

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.IP || "0.0.0.0";
const port = Number(process.env.PORT) || 3000;

const pool = mariadb.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '247756',
  database: process.env.DB_NAME || 'project_lpc',
  connectionLimit: 10,
  connectTimeout: 10000
});

const hashString = (text: string) => crypto.createHash("sha256").update(text).digest("hex");

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function getCPUUsage() {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  cpus.forEach(cpu => {
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
  
  const io = new Server(httpServer, { cors: { origin: "*" }, maxHttpBufferSize: 1e8 });

  io.on("connection", (socket) => {
    let currentUser: { id: number, username: string } | null = null;
    let currentRoomId: string | null = null;

    //ระบบสมัคร
    socket.on("register", async ({ username, password }) => {
      try {
        const rows: any = await pool.query("SELECT id FROM users WHERE username = ?", [username]);
        if (rows.length > 0) return socket.emit("auth-error", "ชื่อนี้ถูกใช้ไปแล้ว");
        const result: any = await pool.query("INSERT INTO users (username, password_hash) VALUES (?, ?)", [username, hashString(password)]);
        currentUser = { id: Number(result.insertId), username }; 
        socket.emit("auth-success", currentUser);
      } catch (err) {
        console.error(err);
        socket.emit("auth-error", "เกิดข้อผิดพลาดกับฐานข้อมูล");
      }
    });

    socket.on("login", async ({ username, password }) => {
      try {
        const rows: any = await pool.query("SELECT id, username FROM users WHERE username = ? AND password_hash = ?", [username, hashString(password)]);
        if (rows.length > 0) {
          currentUser = rows[0];
          socket.emit("auth-success", currentUser);
        } else {
          socket.emit("auth-error", "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
        }
      } catch (err) {
        console.error(err);
        socket.emit("auth-error", "ระบบฐานข้อมูลขัดข้อง");
      }
    });

    //ตัวจัดการห้อง
    socket.on("create-room", async ({ roomId, roomName, password }) => {
      if (!currentUser) return;
      try {
        const passHash = password ? hashString(password) : null;
        await pool.query("INSERT INTO rooms (id, name, password_hash, owner_id) VALUES (?, ?, ?, ?)", [roomId, roomName, passHash, currentUser.id]);
        
        socket.join(roomId);
        currentRoomId = roomId;
        socket.emit("room-joined", { id: roomId, name: roomName });
      } catch (err) {
        socket.emit("room-error", "ไม่สามารถสร้างห้องได้ (ID อาจซ้ำ)");
      }
    });

    socket.on("join-room", async ({ roomId, password }) => {
      if (!currentUser) return;
      try {
        const rooms: any = await pool.query("SELECT name, password_hash FROM rooms WHERE id = ?", [roomId]);
        if (rooms.length === 0) return socket.emit("room-error", "ไม่พบห้องนี้");
        
        const room = rooms[0];
        if (room.password_hash && room.password_hash !== hashString(password)) {
          return socket.emit("room-error", "รหัสผ่านห้องไม่ถูกต้อง");
        }

        socket.join(roomId);
        currentRoomId = roomId;
        socket.emit("room-joined", { id: roomId, name: room.name });

        const messages: any = await pool.query("SELECT username as user, text, image_url as image, DATE_FORMAT(created_at, '%H:%i') as time FROM messages WHERE room_id = ? ORDER BY created_at ASC LIMIT 100", [roomId]);
        socket.emit("load-history", messages);

        socket.broadcast.to(roomId).emit("receive-message", {
          user: "System", text: `🟢 ${currentUser.username} เข้าสู่ห้องแล้ว`, time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
        });
      } catch (err) {
        socket.emit("room-error", "เกิดข้อผิดพลาดในการเข้าห้อง");
      }
    });

    socket.on("leave-room", () => {
      if (currentUser && currentRoomId) {
        socket.leave(currentRoomId);
        socket.broadcast.to(currentRoomId).emit("receive-message", {
          user: "System", text: `🔴 ${currentUser.username} ออกจากห้องแล้ว`, time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
        });
        currentRoomId = null;
      }
    });

    // ส่งแชท
    socket.on("send-message", async (data) => {
      if (!currentUser || !currentRoomId) return;
      const time = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
      const msg = { ...data, time };

      try {
        //
        await pool.query("INSERT INTO messages (room_id, user_id, username, text, image_url) VALUES (?, ?, ?, ?, ?)", 
          [currentRoomId, currentUser.id, data.user, data.text || null, data.image || null]);
        
        io.to(currentRoomId).emit("receive-message", msg);
      } catch (err) {
        console.error("Save message error:", err);
      }
    });

    socket.on("disconnect", () => {
      if (currentUser && currentRoomId) {
        socket.broadcast.to(currentRoomId).emit("receive-message", {
          user: "System", text: `🔴 ${currentUser.username} ออกจากห้องแล้ว`, time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
        });
      }
    });
  });

  // ไร้สาระ
  setInterval(() => {
    const endMeasure = getCPUUsage();
    io.emit("cpu-usage", 100 - Math.floor((100 * (endMeasure.idle - startMeasure.idle)) / (endMeasure.total - startMeasure.total)));
    startMeasure = endMeasure;
  }, 3000);

  httpServer.listen(port, () => console.log(`> VRoom Server Ready on port ${port}`));
});