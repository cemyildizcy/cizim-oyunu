const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Statik dosyaları servis et
app.use(express.static(path.join(__dirname)));

// Oda durumu saklama
const rooms = {}; // roomId -> { sockets: [], edgesSet:Set, edgesList:[], squares: [][..], N, turn }

function keyForEdge(a,b){
	const s1 = `${a.x},${a.y}`, s2 = `${b.x},${b.y}`;
	return s1 < s2 ? `${s1}-${s2}` : `${s2}-${s1}`;
}

io.on('connection', (socket) => {
	console.log('socket connected', socket.id);

	socket.on('join_room', ({ room, name }) => {
		socket.join(room);
		if (!rooms[room]) {
			rooms[room] = { sockets: [], edgesSet: new Set(), edgesList: [], squares: null, N:5, turn:1 };
		}
		const r = rooms[room];
		r.sockets.push({ id: socket.id, name: name || 'Oyuncu' });
		const playerNumber = r.sockets.length; // 1 veya 2 (basit)
		socket.emit('joined', { playerNumber, state: {
			edges: Array.from(r.edgesSet),
			edgesList: r.edgesList,
			squares: r.squares,
			turn: r.turn
		}, otherName: (r.sockets[1] && r.sockets[1].name) || null });

		// Broadcast to room
		socket.to(room).emit('player_joined', { id: socket.id, name });
	});

	socket.on('make_move', ({ room, a, b }) => {
		const r = rooms[room];
		if (!r) {
			socket.emit('error_msg', 'Oda bulunamadı');
			return;
		}
		const k = keyForEdge(a,b);
		if (r.edgesSet.has(k)) {
			socket.emit('error_msg', 'Bu kenar zaten çizilmiş');
			return;
		}
		// Kayıtla ve yayınla (basit uygulama: sunucu doğrulaması minimal)
		r.edgesSet.add(k);
		r.edgesList.push({ a, b, player: null });
		// Turn toggle basit: burada sadece toggle yapıyoruz; client kendi mantığıyla skor/sıra hesaplayacak
		r.turn = r.turn === 1 ? 2 : 1;

		io.to(room).emit('move_made', { a, b, player: null });
	});

	socket.on('disconnect', () => {
		// remove from any room lists
		for (const roomId of Object.keys(rooms)) {
			const r = rooms[roomId];
			const idx = r.sockets.findIndex(s => s.id === socket.id);
			if (idx !== -1) {
				r.sockets.splice(idx,1);
				io.to(roomId).emit('player_left');
				if (r.sockets.length === 0) delete rooms[roomId];
			}
		}
	});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu çalışıyor: http://localhost:${PORT}`));
