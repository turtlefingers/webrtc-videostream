require('dotenv').config();
const express = require('express');
const { ExpressPeerServer } = require('peer');
const path = require('path');

const app = express();
const server = require('http').Server(app);

// 환경 변수 설정
const PORT = process.env.PORT || 9000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// PeerJS 서버 설정
const peerServer = ExpressPeerServer(server, {
    path: '/peerjs',
    debug: NODE_ENV === 'development'
});

app.use(express.static('public'));
app.use(express.json());
app.use('/', peerServer);

// 방 관리를 위한 메모리 저장소
const rooms = new Map();

// 방 참가 API
app.post('/api/room/:roomId/peers', (req, res) => {
    const { roomId } = req.params;
    const { peerId } = req.body;

    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
    }
    
    const room = rooms.get(roomId);
    room.add(peerId);
    
    res.json(Array.from(room));
});

// 방 나가기 API
app.delete('/api/room/:roomId/peers', (req, res) => {
    const { roomId } = req.params;
    const { peerId } = req.body;

    if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.delete(peerId);
        
        if (room.size === 0) {
            rooms.delete(roomId);
        }
    }
    
    res.sendStatus(200);
});

// 서버 시작
server.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다. (${NODE_ENV} 모드)`);
}); 