/**
 * Created by PhpStorm
 * Project: Lavanda
 * User:    sfomin
 * Date:    09.12.2022
 */

const ModuleAbstract = require("./module");
const Redis = require("redis");
const ResponseMessage = require("./response.message");

class Notifier extends ModuleAbstract {
    constructor(inputId, message) {
        //console.log('[Notifier] inputId', inputId);
        //console.log('[Notifier] message', message);
        super(inputId, message);

        this.text            = null;
        this.defaultPriority = 5;
        this.accessMethods   = [
            'getHistory',
            'update',
            'notice',
            'noticeAll'
        ];
        if (this.method === 'notice' || this.method === 'noticeAll') {
            if (typeof message.text == 'undefined' || !message.text) {
                throw new TypeError('Unknown property text in inputMessage');
            }
            this.text = message.text;
        }
        //console.log('[Notifier] this.inputMessage', this.inputMessage);
    }
    exec() {
        try {
            this.checkMethod();
            switch (this.method) {
                case"getHistory":
                    this.getFromRedis(this.userId);
                    break;
                case"update":
                    //console.log('[Notifier::update] this.inputMessage', this.inputMessage);
                    let updateMsg = JSON.parse(this.inputMessage.text);
                    //console.log('[Notifier::update] updateMsg', updateMsg);
                    this.updateIntoRedis(this.userId, updateMsg)
                    break;
                case "notice":
                    this.makeNotice(this.sender.userId);
                    this.saveToRedis(this.userId);
                    let sender = new Sender(this.userId, this.message);
                    sender.send();
                    break;
                case "noticeAll":
                    // if (typeof this.inputMessage.userIds == 'undefined' || this.inputMessage.userIds.length === 0) {
                    //     throw new TypeError('[Notifier::noticeAll] Unknown property userIds in inputMessage');
                    // }
                    //console.log('[Notifier::noticeAll] this.sender.userId', this.sender.userId);
                    //console.log('[Notifier::noticeAll] this.sender.data', this.sender.data);
                    if (typeof this.sender.data.isAdmin == 'undefined' || !this.sender.data.isAdmin) {
                        throw new TypeError('[Notifier::noticeAll] Access denied.');
                    }
                    this.makeNotice(noticeClientId);
                    if (typeof this.inputMessage.userIds == 'undefined' || this.inputMessage.userIds == null || this.inputMessage.userIds.length === 0) {
                        for (var z = 0; z < userClients.length; z++) {
                            let userId = userClients[z].id;
                            this.saveToRedis(userId);
                            let sender = new Sender(userId, this.message);
                            sender.send();
                        }
                    } else {
                        for (var z = 0; z < this.inputMessage.userIds.length; z++) {
                            let userId = this.inputMessage.userIds[z];
                            this.saveToRedis(userId);
                            let sender = new Sender(userId, this.message);
                            sender.send();
                        }
                    }
            }
        } catch (e) {
            console.error(`[Notifier::exec] Exception: ${e}`);
        }
    }
    makeNotice(senderId) {
        let options = {
            type:     'notice',
            format:   'text',
            sender:   senderId,
            message:  this.text,
            priority: (this.inputMessage.hasOwnProperty('priority') && this.inputMessage.priority ? this.inputMessage.priority : this.defaultPriority)
        };
        //this.message = new ResponseMessage('notice', options);
        this.message = new Notice('notice', options);
        this.message.setTimestamp();
        this.message.setIsRead();
    }

    sendHistory(userId, history) {
        let options = {
            type:     'history',
            format:   'json',
            sender:   this.sender.userId,
            message:  JSON.stringify(history)
        };
        this.message = new ResponseMessage('notice', options);
        let sender   = new Sender(this.userId, this.message);
        sender.send();
    }

    getFromRedis(userId) {
        let notifyId = 'LAVANDA:NOTIFY:';
        let rclient  = Redis.createClient(redisPort, redisHost);
        rclient.connect().then(()=>{}).catch((reason)=>{
            console.error('[redisClient.connect] error reason:', reason);
        });
        rclient.select(redisDb);
        let key  = notifyId + userId;
        let self = this;

        rclient.zRange(String(key),0,-1).then((tmp)=>{
            let history = [];
            for (let i = 0; i < tmp.length; i++) {
                history[i] = JSON.parse(tmp[i]);
            }
            history.reverse();
            self.sendHistory(userId, history);
        }).catch((reason)=>{
            console.error('[rclient.zRange] error reason:', reason);
        });
    }

    updateIntoRedis(userId, notice) {
        let notifyId  = 'LAVANDA:NOTIFY:';
        let messageId = 'LAVANDA:MSG:';
        let rclient   = Redis.createClient(redisPort, redisHost);
        rclient.connect().then(()=>{
        }).catch((reason)=>{
            console.error('[redisClient.connect] error reason:', reason);
        });
        rclient.select(redisDb);
        //console.log('[updateIntoRedis] userId', userId);
        //console.log('[updateIntoRedis] notice.options.sender', notice.options.sender);
        //console.log('[updateIntoRedis] this.sender.userId', this.sender.userId);
        let key;
        if (noticeClientId === notice.options.sender) {
            key = notifyId + userId;
        } else {
            key = messageId + userId;
        }
        rclient.zAdd(String(key), {
            score: notice.dt,
            value: JSON.stringify(notice)
        }).then(()=>{}).catch((reason)=>{
            console.error('[rclient.zAdd] error reason:', reason);
        });
    }

    saveToRedis(userId) {
        let notifyId  = 'LAVANDA:NOTIFY:';
        let messageId = 'LAVANDA:MSG:';
        let rclient   = Redis.createClient(redisPort, redisHost);
        rclient.connect().then(()=>{
        }).catch((reason)=>{
            console.error('[redisClient.connect] error reason:', reason);
        });
        rclient.select(redisDb);

        let msg = this.message.toString(); //JSON.stringify
        let key;
        if (noticeClientId === this.message.options.sender) {
            key = notifyId + userId;
            //console.log('[saveToRedis] NOTIFY key', key);
            rclient.zAdd(String(key), {
                score: new Date().getTime(),
                value: String(msg)
            }).then(()=>{}).catch((reason)=>{
                console.error('[rclient.zAdd] error reason:', reason);
            });
        } else {
            key = messageId + this.message.options.sender;
            //console.log('[saveToRedis] MSG key sender', key);
            rclient.zAdd(String(key), {
                score: new Date().getTime(),
                value: String(msg)
            }).then(()=>{}).catch((reason)=>{
                console.error('[rclient.zAdd] error reason:', reason);
            });
            key = messageId + userId;
            //console.log('[saveToRedis] MSG key recipent', key);
            rclient.zAdd(String(key), {
                score: new Date().getTime(),
                value: String(msg)
            }).then(()=>{}).catch((reason)=>{
                console.error('[rclient.zAdd] error reason:', reason);
            });
        }
        rclient.quit().then();
    }
}

class Notice extends ResponseMessage{
    setTimestamp() {
        this.dt = new Date().getTime();
    }
    setIsRead(flag = false) {
        this.isRead = flag;
    }
    toString() {
        let msg = this;
        return JSON.stringify(msg);
    }
}

module.exports = Notifier;
