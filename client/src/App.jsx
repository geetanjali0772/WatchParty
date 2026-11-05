import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RoomProvider } from './context/RoomContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import CreateRoom from './pages/CreateRoom';
import JoinRoom from './pages/JoinRoom';
import WatchRoom from './pages/WatchRoom';

export function App() {
  return (
    <RoomProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="min-h-screen bg-[#F8FAF9] text-gray-900 flex flex-col font-sans selection:bg-emerald-600 selection:text-white relative overflow-x-hidden">
          <Navbar />
          <div className="flex-1 relative z-10">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/create" element={<CreateRoom />} />
              <Route path="/join" element={<JoinRoom />} />
              <Route path="/join/:code" element={<JoinRoom />} />
              <Route path="/room/:roomId" element={<WatchRoom />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </RoomProvider>
  );
}

export default App;

