var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var projectSchema = new Schema({
    name:String,
    directoryName: String,
    url:String,
    branch: String,
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
    },
    build: String,
    buildMode: String, // 构建模式，npm, shell
    deployPath: String,
    outputDir: String,
    buildShell: String, // 构建脚本
    eventType: String, // 响应git事件类型，push,tag
    tagPrefixes: String // tag前缀，为空所有tag都响应
}, {
    versionKey: false,
    timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
})

module.exports = mongoose.model('projects', projectSchema);
