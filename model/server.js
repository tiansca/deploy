var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var serverSchema = new Schema({
    name:String,
    ip:String,
    username: String,
    password: String,
    rootPath: String,
    createTime:{
        type:Date,
        default:Date.now
    },
    updateTime:{
        type:Date,
        default:Date.now
    },
    status:{
        type:Boolean,
        default:true
    }
}, {
    versionKey: false,
    timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
})

module.exports = mongoose.model('server', serverSchema);
