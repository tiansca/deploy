var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var robotSchema = new Schema({
    webhook: String,
    editor: String,
    createTime:{
        type:Date,
        default:Date.now
    },
    updateTime:{
        type:Date,
        default:Date.now
    },
}, {
    versionKey: false,
    timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
})

module.exports = mongoose.model('robot', robotSchema);
