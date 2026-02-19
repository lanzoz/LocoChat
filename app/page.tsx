'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChatMessage } from '../app/types/chat'; 
import { BsPlusCircleFill, BsServer, BsDoorOpen, BsHouseAdd, BsClipboard } from "react-icons/bs";
import toast, { Toaster } from 'react-hot-toast';
import { TbMarquee } from 'react-icons/tb';
import Marquee from 'react-fast-marquee';
export default function ChatPage() {
  const [uiState, setUiState] = useState<'auth' | 'lobby' | 'chat'>('auth');
  const [lobbyMode, setLobbyMode] = useState<'select' | 'join' | 'create'>('select');

  //ข้อมูลผู้ใช้
  const [username, setUsername] = useState("");
  const [tempName, setTempName] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  //ห้องบลาๆ
  const [currentRoom, setCurrentRoom] = useState<{ id: string, name: string } | null>(null);
  const [joinRoomId, setJoinRoomId] = useState("");
  const [joinRoomPass, setJoinRoomPass] = useState("");
  
  const generateId = () => Math.floor(1000000000 + Math.random() * 9000000000).toString();
  const [newRoomId, setNewRoomId] = useState(generateId());
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomPass, setNewRoomPass] = useState("");

  //แชท
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [cpuLoad, setCpuLoad] = useState<number>(0);
  
  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorToast = (err: string) => toast.error(err);

  const win98Panel = "bg-zinc-800 border-t-2 border-l-2 border-t-zinc-600 border-l-zinc-600 border-b-2 border-r-2 border-b-black border-r-black p-1";
  const win98Inset = "bg-zinc-950 border-t-2 border-l-2 border-t-black border-l-black border-b-2 border-r-2 border-b-zinc-600 border-r-zinc-600";

  //st socket
  const initSocket = () => {
    const socket = io(); 
    socketRef.current = socket;
  
    socket.on("cpu-usage", (usage) => setCpuLoad(usage));
    
    socket.on("auth-success", (user) => {
      setUsername(user.username);
      setUiState('lobby');
      setPassword(""); 
    });
    socket.on("auth-error", (err) => errorToast(err));

    socket.on("room-joined", (room) => {
      setCurrentRoom(room);
      setUiState('chat');
      setChat([]);
    });
    socket.on("room-error", (err) => errorToast(err));

    socket.on("load-history", (history) => setChat(history));
    socket.on("receive-message", (msg) => setChat((prev) => [...prev, msg]));
    socket.on("connect_error", () => {
      errorToast('ไม่สามารถเชื่อมต่อเซิฟเวอร์ได้');
      socket.disconnect();
    });
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName || !password) return errorToast('กรุณากรอกข้อมูลให้ครบ');
    if (socketRef.current) socketRef.current.disconnect();
    
    initSocket();
    setTimeout(() => socketRef.current?.emit(authMode, { username: tempName, password }), 500);
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName) return errorToast('กรุณาตั้งชื่อห้อง');
    socketRef.current?.emit('create-room', { roomId: newRoomId, roomName: newRoomName, password: newRoomPass });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinRoomId) return errorToast('กรุณาใส่ ID ห้อง');
    socketRef.current?.emit('join-room', { roomId: joinRoomId, password: joinRoomPass });
  };

  const handleLeaveRoom = () => {
    socketRef.current?.emit('leave-room');
    setCurrentRoom(null);
    setUiState('lobby');
  };

  const sendMsg = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      socketRef.current?.emit('send-message', { user: username, text: message });
      setMessage('');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        socketRef.current?.emit('send-message', { user: username, text: "", image: reader.result as string });
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat, uiState]);

  return (
    <div className="flex flex-col h-screen bg-[#1a1a1a] p-2 font-mono text-zinc-300">
      <Toaster position="top-right" toastOptions={{style: {
      borderRadius: '10px',
      background: '#333',
      color: '#fff',
    }}} />
      
      {/*หน้าลงชื่อเข้าใช้*/}
      {uiState === 'auth' && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className={`${win98Panel} w-full max-w-sm shadow-xl`}>
            
            <div className="bg-blue-900 px-2 py-1 mb-4 flex justify-between items-center">
              <span className="font-bold text-sm flex items-center gap-2"><BsServer/> Loco Connect</span>
            </div>
          
            <div className="p-4 space-y-4">
              <h2 className="text-xl font-bold text-center italic border-b border-zinc-700 pb-2">Loco v1.1</h2>
              <form onSubmit={handleAuth} className="space-y-3">
                <label className="block text-xs">
                  ชื่อผู้ใช้: 
                  <input className={`${win98Inset} w-full px-2 py-1 text-green-400 focus:outline-none`} value={tempName} onChange={e=>setTempName(e.target.value)} />
                </label>
                <label className="block text-xs">
                  รหัสผ่าน: 
                  <input type="password" className={`${win98Inset} w-full px-2 py-1 text-green-400 focus:outline-none`} value={password} onChange={e=>setPassword(e.target.value)} />
                </label>
                <button type="submit" className={`${win98Panel} w-full py-2 font-bold hover:bg-zinc-700 mt-2`}>
                  {authMode === 'login' ? '[ LOGIN ]' : '[ REGISTER ]'}
                </button>
              </form>
              <p className="text-center text-[10px] underline cursor-pointer hover:text-blue-400" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
                {authMode === 'login' ? "สมัครสมาชิกใหม่" : "มีบัญชีอยู่แล้ว"}
              </p>
            </div>
          </div>
          <div className="flex flex-row w-2xl">
            <Marquee>เว็ปไซต์นี้ไม่มีการขอในการเปิดเผยข้อมูลแชท / ข้อมูลผู้ใช้ใดๆหากมีผู้ใด กระทำการขอไอดีของท่านกรุณาตรวจสอบให้รอบคอบ!!!        -</Marquee>
          </div>
        </div>
      )}

      {/*หน้าเลือกเมนู*/}
      {uiState === 'lobby' && (
        <div className="flex-1 flex items-center justify-center">
          <div className={`${win98Panel} w-full max-w-sm shadow-xl`}>
            <div className="bg-blue-900 px-2 py-1 mb-4 flex justify-between items-center text-white text-sm">
              <span className="font-bold">ล็อบบี้ {username}</span>
            </div>
            
            <div className="p-4 min-h-62.5 flex flex-col justify-center">
              {lobbyMode === 'select' && (
                <div className="flex gap-4">
                  <button onClick={() => setLobbyMode('join')} className={`${win98Panel} flex-1 flex flex-col items-center py-6 hover:bg-zinc-700`}>
                    <BsDoorOpen size={32} className="mb-2"/> เข้าร่วมห้อง
                  </button>
                  <button onClick={() => setLobbyMode('create')} className={`${win98Panel} flex-1 flex flex-col items-center py-6 hover:bg-zinc-700`}>
                    <BsHouseAdd size={32} className="mb-2"/> สร้างห้อง
                  </button>
                </div>
              )}

              {lobbyMode === 'join' && (
                <form onSubmit={handleJoinRoom} className="space-y-3">
                  <h3 className="text-center font-bold mb-4 border-b border-zinc-600 pb-1">เข้าร่วมห้อง</h3>
                  <label className="block text-xs">ID ห้อง: <input type="number" className={`${win98Inset} w-full px-2 py-1 text-green-400 focus:outline-none`} placeholder="เช่น 1234567890" value={joinRoomId} onChange={e=>setJoinRoomId(e.target.value)}/></label>
                  <label className="block text-xs">รหัสห้อง (ถ้ามี): <input type="password" className={`${win98Inset} w-full px-2 py-1 text-green-400 focus:outline-none`} value={joinRoomPass} onChange={e=>setJoinRoomPass(e.target.value)}/></label>
                  <div className="flex gap-2 pt-4">
                    <button type="button" onClick={() => setLobbyMode('select')} className={`${win98Panel} flex-1 hover:bg-zinc-700 text-xs py-2`}>กลับ</button>
                    <button type="submit" className={`${win98Panel} flex-1 font-bold hover:bg-zinc-700 text-xs py-2 text-green-400`}>เข้าห้อง</button>
                  </div>
                </form>
              )}

              {lobbyMode === 'create' && (
                <form onSubmit={handleCreateRoom} className="space-y-3">
                  <h3 className="text-center font-bold mb-4 border-b border-zinc-600 pb-1">สร้างห้องใหม่</h3>
                  <label className="block text-xs">ชื่อห้อง: <input maxLength={30} className={`${win98Inset} w-full px-2 py-1 text-green-400 focus:outline-none`} value={newRoomName} onChange={e=>setNewRoomName(e.target.value)}/></label>
                  <label className="block text-xs">รหัสห้อง (เว้นว่างไว้ถ้าไม่มี): <input type="password" className={`${win98Inset} w-full px-2 py-1 text-green-400 focus:outline-none`} value={newRoomPass} onChange={e=>setNewRoomPass(e.target.value)}/></label>
                  <div>
                    <span className="text-xs">ID ห้อง:</span>
                    <div className="flex gap-1 mt-1">
                      <div className={`${win98Inset} flex-1 px-2 py-1 text-yellow-400 text-center font-bold tracking-widest`}>{newRoomId}</div>
                      <button type="button" onClick={() => setNewRoomId(generateId())} className={`${win98Panel} px-2 hover:bg-zinc-700 text-[10px]`}>สุ่มไอดีห้องใหม่</button>
                      <button type="button" onClick={() => {navigator.clipboard.writeText(newRoomId); toast.success('คัดลอก ID แล้ว');}} className={`${win98Panel} px-2 hover:bg-zinc-700`}><BsClipboard/></button>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button type="button" onClick={() => setLobbyMode('select')} className={`${win98Panel} flex-1 hover:bg-zinc-700 text-xs py-2`}>ยกเลิก</button>
                    <button type="submit" className={`${win98Panel} flex-1 font-bold hover:bg-zinc-700 text-xs py-2 text-yellow-400`}>สร้างห้อง</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/*หน้าแชท*/}
      {uiState === 'chat' && (
        <div className={`${win98Panel} flex-1 flex flex-col overflow-hidden`}>
          <div className="bg-blue-900 px-2 py-1 mb-1 flex justify-between items-center shadow-sm">
            <span className="font-bold text-xs text-white">ห้อง [{currentRoom?.name}] - ไอดี: {currentRoom?.id}</span>
            <button className={`${win98Panel} px-2 text-[10px] h-fit bg-zinc-800 hover:bg-red-800 text-white transition-colors`} onClick={handleLeaveRoom}>
              [X]
            </button>
          </div>
          
          <div ref={scrollRef} className={`${win98Inset} flex-1 m-1 overflow-y-auto p-4 custom-scrollbar shadow-inner`}>
             {chat.map((m, i) => (
                <div key={i} className="mb-2 text-sm leading-tight">
                  {m.user === 'System' ? (
                    <div className="text-zinc-500 text-center text-xs py-1 border-y border-zinc-900 my-2">*** {m.text} ***</div>
                  ) : (
                    <div className="flex flex-col">
                      <span className="text-[10px] flex items-center gap-2">
                        <span className={m.user === username ? "text-green-500" : "text-blue-400"}>[{m.time}] &lt;{m.user}&gt;</span>
                      </span>
                      <div className="pl-4 mt-1 border-l border-zinc-800 ml-2">
                        {m.image && <img src={m.image} alt="upload" className={`${win98Panel} max-h-64 mb-2`} />}
                        {m.text && <p className="text-zinc-200 break-all">{m.text}</p>}
                      </div>
                    </div>
                  )}
                </div>
             ))}
          </div>

          <form onSubmit={sendMsg} className="p-2 flex gap-2 items-center">
            <button type="button" onClick={() => fileInputRef.current?.click()} className={`${win98Panel} w-10 h-10 flex items-center justify-center hover:bg-zinc-700`}><BsPlusCircleFill size={20} /></button>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            <div className={`${win98Inset} flex-1 p-2`}>
              <input className="bg-transparent w-full text-green-400 focus:outline-none text-sm placeholder-zinc-700" value={message} onChange={e=>setMessage(e.target.value)} placeholder="พิมพ์ข้อความ..." />
            </div>
            <button type="submit" disabled={!message.trim()} className={`${win98Panel} px-4 py-2 font-bold disabled:opacity-50 hover:bg-zinc-700`}>ส่ง</button>
          </form>
        </div>
      )}

      {/* ทำเล่นเพิ่มเติม */}
      <div className="mt-1 text-[9px] text-zinc-600 flex justify-between px-1 uppercase tracking-widest">
        <span>State: {uiState} | User: {username || "Guest"}</span>
        <span>CPU: {cpuLoad}%</span>
      </div>
    </div>
  );
}