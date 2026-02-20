"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { ChatMessage } from "../app/types/chat";
import {
  BsPlusCircleFill,
  BsServer,
  BsDoorOpen,
  BsHouseAdd,
  BsClipboard,
} from "react-icons/bs";
import toast, { Toaster } from "react-hot-toast";
import Marquee from "react-fast-marquee";
import LOGO from '../public/logo.png';
import Image from "next/image";

export default function ChatPage() {
  const [uiState, setUiState] = useState<"auth" | "lobby" | "chat">("auth");
  const [lobbyMode, setLobbyMode] = useState<"select" | "join" | "create">("select");
  const [roomList, setRoomList] = useState<
    { id: string; name: string; hasPassword: boolean; userCount: number; owner: string }[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [username, setUsername] = useState("");
  const [tempName, setTempName] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const [currentRoom, setCurrentRoom] = useState<{ id: string; name: string } | null>(null);
  const [joinRoomId, setJoinRoomId] = useState("");
  const [joinRoomPass, setJoinRoomPass] = useState("");

  const generateId = () =>
    Math.floor(1000000000 + Math.random() * 9000000000).toString();
  const [newRoomId, setNewRoomId] = useState(generateId());
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomPass, setNewRoomPass] = useState("");

  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [cpuLoad, setCpuLoad] = useState<number>(0);

  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const errorToast = (err: string) => toast.error(err);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    socket.on("connect", () => { socket.emit("get-rooms"); });
    socket.on("room-list-update", (list) => setRoomList(list));
    socket.on("auth-success", (user) => {
      setUsername(user.username);
      setUiState("lobby");
      setPassword("");
      toast.success(`ยินดีต้อนรับคุณ ${user.username}`);
      socket.emit("get-rooms");
    });
    socket.on("auth-error", (err) => errorToast(err));
    socket.on("room-joined", (room) => { setCurrentRoom(room); setUiState("chat"); setChat([]); });
    socket.on("room-error", (err) => errorToast(err));
    socket.on("load-history", (history) => setChat(history));
    socket.on("receive-message", (msg) => setChat((prev) => [...prev, msg]));
    socket.on("cpu-usage", (usage) => setCpuLoad(usage));
    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat, uiState]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName || !password) return errorToast("กรุณากรอกข้อมูลให้ครบ");
    socketRef.current?.emit(authMode, { username: tempName, password });
  };
  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName) return errorToast("กรุณาตั้งชื่อห้อง");
    socketRef.current?.emit("create-room", { roomId: newRoomId, roomName: newRoomName, password: newRoomPass });
  };
  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinRoomId) return errorToast("กรุณาใส่ ID ห้อง");
    socketRef.current?.emit("join-room", { roomId: joinRoomId, password: joinRoomPass });
  };
  const handleLeaveRoom = () => {
    socketRef.current?.emit("leave-room");
    setCurrentRoom(null);
    setUiState("lobby");
  };
  const sendMsg = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      socketRef.current?.emit("send-message", { user: username, text: message });
      setMessage("");
    }
  };
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        socketRef.current?.emit("send-message", { user: username, text: "", image: reader.result as string });
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.readAsDataURL(file);
    }
  };

  /* ─── Shared style tokens ─── */
  const glass =
    "backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl";
  const glassStrong =
    "backdrop-blur-2xl bg-white/8 border border-white/15 shadow-2xl";
  const inputCls =
    "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/60 focus:bg-white/10 transition-all duration-300";
  const btnPrimary =
    "w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]";
  const btnGhost =
    "flex-1 py-2.5 rounded-xl font-medium text-sm border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all duration-200";

  /* ─── Background gradient mesh (inline style, Tailwind can't do arbitrary mesh) ─── */
  const meshBg: React.CSSProperties = {
    background:
      "radial-gradient(ellipse 80% 60% at 20% 10%, #0d1b4b 0%, transparent 60%)," +
      "radial-gradient(ellipse 60% 50% at 80% 80%, #1a0635 0%, transparent 60%)," +
      "radial-gradient(ellipse 50% 40% at 60% 30%, #062030 0%, transparent 50%)," +
      "#050a14",
  };

  return (
    <div
      className="flex flex-col h-screen font-sans text-white overflow-hidden"
      style={meshBg}
    >
      {/* Decorative orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ top: "-8rem", left: "-8rem", background: "radial-gradient(circle, #06b6d4, transparent)" }}
        />
        <div
          className="absolute w-80 h-80 rounded-full opacity-15 blur-3xl"
          style={{ bottom: "-6rem", right: "-6rem", background: "radial-gradient(circle, #8b5cf6, transparent)" }}
        />
        <div
          className="absolute w-64 h-64 rounded-full opacity-10 blur-2xl"
          style={{ top: "40%", left: "50%", background: "radial-gradient(circle, #0ea5e9, transparent)" }}
        />
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "rgba(15,23,42,0.9)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
            borderRadius: "14px",
          },
        }}
      />

      {/* ═══════════════════ AUTH PAGE ═══════════════════ */}
      {uiState === "auth" && (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className={`${glassStrong} w-full max-w-sm rounded-3xl p-8 space-y-7`}>
            {/* Logo row */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-fit h-fit rounded-2xl flex items-center justify-center p-2 shadow-lg"
                style={{ background: "linear-gradient(135deg,#06b6d4,#8b5cf6)" }}
              >
                <Image 
                  src={LOGO}
                  width={100}
                  height={100}
                  alt="Logo"
                />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">
                Loco{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(90deg,#06b6d4,#8b5cf6)" }}
                >
                  Connect
                </span>
              </h1>
              <p className="text-xs text-white/40 tracking-widest uppercase">v1.2</p>
            </div>

            {/* Toggle tabs */}
            <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setAuthMode(m)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                    authMode === m
                      ? "bg-gradient-to-r from-cyan-500/80 to-violet-500/80 text-white shadow"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {m === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
                </button>
              ))}
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-white/50 uppercase tracking-wider">ชื่อผู้ใช้</label>
                <input
                  className={inputCls}
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="username"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/50 uppercase tracking-wider">รหัสผ่าน</label>
                <input
                  type="password"
                  className={inputCls}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <button type="submit" className={btnPrimary}>
                {authMode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
              </button>
            </form>
          </div>

          {/* Scrolling notice */}
          <div className="mt-4 w-full max-w-sm text-[10px] text-white/20">
            <Marquee gradient={false} speed={40}>
              เว็ปไซต์นี้ไม่มีการขอในการเปิดเผยข้อมูลแชท / ข้อมูลผู้ใช้ใดๆ — หากมีผู้ใดขอไอดีของท่านกรุณาตรวจสอบให้รอบคอบ!!! &nbsp;&nbsp;&nbsp;
            </Marquee>
          </div>
        </div>
      )}

      {/* ═══════════════════ LOBBY PAGE ═══════════════════ */}
      {uiState === "lobby" && (
        <div className="flex-1 flex items-center justify-center px-4 py-6">
          <div className={`${glass} w-full max-w-4xl rounded-3xl overflow-hidden`}>
            {/* Header bar */}
            <div
              className="px-6 py-4 flex items-center justify-between border-b border-white/10"
              style={{ background: "linear-gradient(90deg,rgba(6,182,212,0.15),rgba(139,92,246,0.15))" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                  style={{ background: "linear-gradient(135deg,#06b6d4,#8b5cf6)" }}
                >
                  <BsServer size={14} />
                </div>
                <span className="font-semibold text-sm">
                  ห้อง
                </span>
              </div>
            </div>

            <div className="p-6">
              {/* ── Room list ── */}
              {lobbyMode === "select" && (
                <div className="flex flex-col h-[460px]">
                  {/* Toolbar */}
                  <div className="flex gap-3 mb-4">
                    <button
                      onClick={() => setLobbyMode("create")}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-400/20 hover:border-cyan-400/50 text-cyan-300 hover:text-cyan-200 transition-all duration-200"
                    >
                      <BsHouseAdd /> สร้างห้อง
                    </button>
                    <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3">
                      <span className="text-white/30 text-xs">🔍</span>
                      <input
                        className="bg-transparent flex-1 text-xs text-white focus:outline-none placeholder-white/20"
                        placeholder="ค้นหาห้อง..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_auto_auto] text-[10px] uppercase tracking-widest text-white/30 px-4 pb-2 border-b border-white/5">
                    <span>ชื่อห้อง</span>
                    <span className="px-6 text-center">ผู้ใช้</span>
                    <span className="text-center">สถานะ</span>
                  </div>

                  {/* Room list */}
                  <div className="flex-1 overflow-y-auto space-y-1.5 mt-2 pr-1"
                    style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
                    {roomList
                      .filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((room) => (
                        <div
                          key={room.id}
                          onClick={() => { setJoinRoomId(room.id); setLobbyMode("join"); }}
                          className="group flex items-center justify-between px-4 py-3 rounded-xl border border-white/5 bg-white/3 hover:bg-white/8 hover:border-cyan-400/20 cursor-pointer transition-all duration-200"
                        >
                          <div>
                            <p className="text-sm text-white/90 group-hover:text-white">💬 {room.name}</p>
                            <p className="text-[10px] text-white/30 mt-0.5">
                              <span className="bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded text-[9px] mr-1">OWNER</span>
                              {room.owner || "Unknown"}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-white/40">
                            <span>{room.userCount} คน</span>
                            <span>{room.hasPassword ? "🔒" : "🔓"}</span>
                          </div>
                        </div>
                      ))}
                    {roomList.length === 0 && (
                      <div className="flex-1 flex items-center justify-center text-white/20 text-sm pt-16">
                        ยังไม่มีห้อง
                      </div>
                    )}
                  </div>

                  {/* Direct ID */}
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">เข้าร่วมด้วย ID โดยตรง</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        className={`${inputCls} flex-1`}
                        placeholder="ใส่เลขห้อง..."
                        value={joinRoomId}
                        onChange={(e) => setJoinRoomId(e.target.value)}
                      />
                      <button
                        onClick={() => setLobbyMode("join")}
                        disabled={!joinRoomId}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-500 to-violet-500 text-white disabled:opacity-40 hover:opacity-90 transition-all"
                      >
                        ตกลง
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Join room ── */}
              {lobbyMode === "join" && (
                <form onSubmit={handleJoinRoom} className="space-y-5 max-w-sm mx-auto">
                  <h3 className="text-lg font-semibold text-center">เข้าร่วมห้อง</h3>
                  <div className="space-y-1">
                    <label className="text-xs text-white/50 uppercase tracking-wider">ID ห้อง</label>
                    <input
                      type="number"
                      className={inputCls}
                      placeholder="เช่น 1234567890"
                      value={joinRoomId}
                      onChange={(e) => setJoinRoomId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-white/50 uppercase tracking-wider">รหัสห้อง</label>
                    <input
                      type="password"
                      className={inputCls}
                      placeholder="••••••••"
                      value={joinRoomPass}
                      onChange={(e) => setJoinRoomPass(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setLobbyMode("select")} className={btnGhost}>กลับ</button>
                    <button type="submit" className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-violet-500 text-white hover:opacity-90 transition-all">เข้าห้อง</button>
                  </div>
                </form>
              )}

              {/* ── Create room ── */}
              {lobbyMode === "create" && (
                <form onSubmit={handleCreateRoom} className="space-y-5 max-w-sm mx-auto">
                  <h3 className="text-lg font-semibold text-center">สร้างห้องใหม่</h3>
                  <div className="space-y-1">
                    <label className="text-xs text-white/50 uppercase tracking-wider">ชื่อห้อง</label>
                    <input
                      maxLength={30}
                      className={inputCls}
                      placeholder="ตั้งชื่อห้อง..."
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-white/50 uppercase tracking-wider">รหัสห้อง (มีหรือไม่ก็ได้)</label>
                    <input
                      type="password"
                      className={inputCls}
                      placeholder="••••••••"
                      value={newRoomPass}
                      onChange={(e) => setNewRoomPass(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-white/50 uppercase tracking-wider">ID ห้อง</label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-cyan-400 tracking-widest truncate">
                        {newRoomId}
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewRoomId(generateId())}
                        className="px-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-all"
                      >
                        สุ่ม
                      </button>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(newRoomId); toast.success("คัดลอก ID แล้ว"); }}
                        className="px-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-cyan-400 transition-all"
                      >
                        <BsClipboard size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setLobbyMode("select")} className={btnGhost}>ยกเลิก</button>
                    <button type="submit" className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-violet-500 text-white hover:opacity-90 transition-all">สร้างห้อง</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ CHAT PAGE ═══════════════════ */}
      {uiState === "chat" && (
        <div className="flex-1 flex flex-col overflow-hidden p-3">
          <div className={`${glass} flex-1 flex flex-col rounded-3xl overflow-hidden`}>
            {/* Chat header */}
            <div
              className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0"
              style={{ background: "linear-gradient(90deg,rgba(6,182,212,0.12),rgba(139,92,246,0.12))" }}
            >
              <div>
                <p className="font-semibold text-sm text-white">{currentRoom?.name}</p>
                <p className="text-[10px] text-white/30 font-mono mt-0.5">ID: {currentRoom?.id}</p>
              </div>
              <button
                onClick={handleLeaveRoom}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/50 border border-white/10 hover:border-red-400/40 hover:text-red-400 hover:bg-red-400/10 transition-all duration-200"
              >
                <BsDoorOpen size={12} /> ออก
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
              style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}
            >
              {chat.map((m, i) => {
                const isMe = m.user === username;
                return (
                  <div key={i}>
                    {m.user === "System" ? (
                      <div className="text-center text-[10px] text-white/20 py-2">
                        ─── {m.text} ───
                      </div>
                    ) : (
                      <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                        <span className={`text-[10px] mb-1 ${isMe ? "text-cyan-400" : "text-violet-400"}`}>
                          {m.user} · {m.time}
                        </span>
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            isMe
                              ? "rounded-tr-sm text-white"
                              : "rounded-tl-sm bg-white/8 border border-white/10 text-white/90"
                          }`}
                          style={
                            isMe
                              ? { background: "linear-gradient(135deg,rgba(6,182,212,0.4),rgba(139,92,246,0.4))", border: "1px solid rgba(6,182,212,0.2)" }
                              : {}
                          }
                        >
                          {m.image && (
                            <img
                              src={m.image}
                              alt="upload"
                              className="max-h-56 rounded-xl mb-2 w-auto"
                            />
                          )}
                          {m.text && <p className="break-words">{m.text}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Input bar */}
            <form
              onSubmit={sendMsg}
              className="flex items-center gap-3 p-4 border-t border-white/8 flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:border-cyan-400/40 hover:text-cyan-400 text-white/40 transition-all duration-200 flex-shrink-0"
              >
                <BsPlusCircleFill size={16} />
              </button>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
              <input
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-cyan-400/50 focus:bg-white/8 transition-all duration-300"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="พิมพ์ข้อความ..."
              />
              <button
                type="submit"
                disabled={!message.trim()}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-500 to-violet-500 text-white disabled:opacity-30 hover:opacity-90 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] flex-shrink-0"
              >
                ส่ง
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="px-4 pb-2 flex justify-between text-[9px] text-white/15 uppercase tracking-widest">
        <span>state:{uiState} · user:{username || "guest"}</span>
        <span>
          cpu:{" "}
          <span className={cpuLoad > 80 ? "text-red-400/60" : cpuLoad > 50 ? "text-yellow-400/60" : "text-green-400/60"}>
            {cpuLoad}%
          </span>
        </span>
      </div>
    </div>
  );
}