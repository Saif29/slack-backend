const express = require("express");
const app = express();
const userRoutes = require("./routes/userRoutes");
const cors = require("cors");
const Message = require("./models/Message");
const User = require("./models/User");
const Rooms = require("./models/Rooms");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

app.use("/users", userRoutes);

require("./connection");

const server = require("http").createServer(app);

const PORT = 3001;

const io = require("socket.io")(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
    },
});

async function getLastMessagesFromRoom(room) {
    let roomMessages = await Message.aggregate([
        { $match: { to: room } },
        { $group: { _id: "$date", messagesByDate: { $push: "$$ROOT" } } },
    ]);
    return roomMessages;
}

function sortByDate(messages) {
    return messages.sort(function (a, b) {
        let date1 = a._id.split("/");
        let date2 = b._id.split("/");

        date1 = date1[2] + date1[0] + date1[1];
        date2 = date2[2] + date2[0] + date2[1];

        return date1 < date2 ? -1 : 1;
    });
}

io.on("connection", (socket) => {
    socket.emit("myId", socket.id);

    socket.on("new-user", async () => {
        const members = await User.find();
        io.emit("new-user", members);
    });
    socket.on("join-room", async (room) => {
        socket.join(room.name);
        let roomMessages = await getLastMessagesFromRoom(room.name);
        roomMessages = sortByDate(roomMessages);
        socket.emit("room-messages", roomMessages);
    });

    socket.on("message-room", async (room, content, sender, time, date) => {
        const newMessage = await Message.create({
            content,
            from: sender,
            time,
            date,
            to: room.name,
        });
        let roomMessages = await getLastMessagesFromRoom(room.name);
        roomMessages = await sortByDate(roomMessages);
        io.to(room.name).emit("room-messages", roomMessages);

        //socket.broadcast.emit("notification", room);
    });

    socket.on(
        "file-room",
        async (room, content, sender, time, date, isFile, fileName) => {
            const newMessage = await Message.create({
                content,
                from: sender,
                time,
                date,
                to: room,
                isFile,
                fileName,
            });
            let roomMessages = await getLastMessagesFromRoom(room);
            roomMessages = await sortByDate(roomMessages);

            io.to(room).emit("room-messages", roomMessages);

            //socket.broadcast.emit("notification", room);
        }
    );

    socket.on("add-group", async (name, groupAdmin, private) => {
        if (!private) {
            await Rooms.create({
                name: name,
                private: private,
            });
        } else {
            await Rooms.create({
                name: name,
                isPrivate: private,
                groupAdmin: groupAdmin,
                members: [groupAdmin],
            });
        }
        const roomsObject = await Rooms.find();
        io.sockets.emit("get-rooms", roomsObject);
    });

    socket.on("rooms-api", async () => {
        const roomsObject = await Rooms.find();
        io.sockets.emit("get-rooms", roomsObject);
    });

    socket.on("is-typing", (typing, user, roomId) => {
        socket.to(roomId).emit("show-typing", typing, user, roomId);
    });

    socket.on("add-member", async (roomId, newMem) => {
        const room = await Rooms.findOne({ name: roomId });
        room.members = [...room.members, newMem];
        await room.save();
        socket.emit("updated-room", room);
        const roomsObject = await Rooms.find();
        io.sockets.emit("get-rooms", roomsObject);
        //socket.to(roomId).emit("show-typing", typing, user, roomId);
    });

    socket.on("disconnect", () => {
		socket.broadcast.emit("call-ended")
	})

    socket.on("get-socket", (room) => {
        socket.to(room).emit("get-socket");
    })

    socket.on("send-socket", (socketToSend, room) => {
        socket.to(room).emit("other-socket", socketToSend)
    })

	socket.on("call-user", (data) => {
        io.to(data.socketToCall).emit("call-user", { signal: data.signalData, from: data.from })
	})

	socket.on("answer-call", (data) => {
		io.to(data.to).emit("call-accepted", data.signal)
	})

    socket.on("end-call", (room) => {
        io.to(room.name).emit("ended-call")
	})

    app.delete("/logout", async (req, res) => {
        try {
            const { _id, newMessages } = req.body;
            const user = await User.findById(_id);
            user.status = "offline";
            user.newMessages = newMessages;
            await user.save();
            const members = await User.find();
            socket.broadcast.emit("new-user", members);
            res.status(200).send();
        } catch (error) {
            console.log(error);
            res.status(400).send();
        }
    });

    app.get("/rooms", async (req, res) => {
        const roomsObject = await Rooms.find();
        // console.log("roomsObject", roomsObject)
        // let rooms = [];
        // for (let i = 0; i < roomsObject.length; i++) {
        //     rooms[i] = roomsObject[i];
        // }
        // console.log("rooms", rooms)
        res.json(roomsObject);
    });
});

server.listen(PORT, () => {
    console.log("RUNNING ON PORT", PORT);
});
