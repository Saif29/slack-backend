const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    content: String,
    from: Object,
    socketid: String,
    time: String,
    date: String,
    to: String,
    isFile: Boolean,
    fileName: String
});

const Message = mongoose.model("Message", MessageSchema);

module.exports = Message;
