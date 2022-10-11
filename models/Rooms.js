const mongoose=require('mongoose');

const RoomsSchema=new mongoose.Schema({
    name:{
        unique: true,
        type:String,
    },
    isPrivate: Boolean,
    groupAdmin: Object,
    members:[{
        type: Object,
    }],
});

const Rooms=mongoose.model('Rooms',RoomsSchema);
module.exports=Rooms;