const myVideo = document.getElementById('my-video');
const videosDiv = document.getElementById('videos');
const joinBtn = document.getElementById('join-btn');
const roomInput = document.getElementById('room-id');
const leaveBtn = document.getElementById('leave-btn');

let myStream;
let peer;
let myId;
let connections = {};
let currentRoomId = null;

// 1. 내 미디어 스트림 가져오기
async function getMedia() {
    try {
        myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        myVideo.srcObject = myStream;
    } catch (e) {
        alert('카메라/마이크 권한이 필요합니다.');
    }
}

// 2. PeerJS 연결
function connectPeer(roomId) {
    peer = new Peer(undefined, {
        host: location.hostname,
        port: location.protocol === 'https:' ? 443 : 9000,
        path: '/peerjs',
        secure: location.protocol === 'https:'
    });

    peer.on('open', id => {
        myId = id;
        joinRoom(roomId);
    });

    // 다른 사용자가 나에게 연결할 때
    peer.on('call', call => {
        call.answer(myStream);
        call.on('stream', remoteStream => {
            addRemoteVideo(call.peer, remoteStream);
        });
        call.on('close', () => removeRemoteVideo(call.peer));
        connections[call.peer] = call;
    });
}

// 3. 방에 참가 (간단 브로드캐스트)
function joinRoom(roomId) {
    fetch(`/api/room/${roomId}/peers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId: myId })
    })
    .then(res => res.json())
    .then(peers => {
        peers.forEach(peerId => {
            if (peerId !== myId) {
                const call = peer.call(peerId, myStream);
                call.on('stream', remoteStream => {
                    addRemoteVideo(peerId, remoteStream);
                });
                call.on('close', () => removeRemoteVideo(peerId));
                connections[peerId] = call;
            }
        });
    });
}

// 4. 비디오 추가/제거
function addRemoteVideo(peerId, stream) {
    if (document.getElementById('video-' + peerId)) return;
    const video = document.createElement('video');
    video.id = 'video-' + peerId;
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;
    videosDiv.appendChild(video);
}
function removeRemoteVideo(peerId) {
    const video = document.getElementById('video-' + peerId);
    if (video) video.remove();
}

function cleanup() {
    // 연결 종료
    Object.values(connections).forEach(call => call.close && call.close());
    connections = {};
    if (peer) peer.destroy();
    // 원격 비디오 제거
    document.querySelectorAll('video[id^="video-"]').forEach(v => v.remove());
    joinBtn.disabled = false;
    leaveBtn.style.display = 'none';
    roomInput.disabled = false;
}
async function leaveRoom() {
    if (!currentRoomId || !myId) return;
    await fetch(`/api/room/${currentRoomId}/peers`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId: myId })
    });
    cleanup();
    currentRoomId = null;
}

// 5. 버튼 이벤트
joinBtn.onclick = async () => {
    const roomId = roomInput.value.trim();
    if (!roomId) return alert('회의방 이름을 입력하세요.');
    joinBtn.disabled = true;
    roomInput.disabled = true;
    await getMedia();
    connectPeer(roomId);
    leaveBtn.style.display = 'inline-block';
    currentRoomId = roomId;
};
leaveBtn.onclick = leaveRoom;
window.addEventListener('beforeunload', (e) => {
    if (currentRoomId && myId) {
        navigator.sendBeacon(`/api/room/${currentRoomId}/peers`, JSON.stringify({ peerId: myId }));
    }
}); 