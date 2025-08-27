var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var userSchema = new Schema({
    username: String,
    password: String,
    role: {
        type: String,
        default: 'user'
    },
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

module.exports = mongoose.model('user', userSchema);
