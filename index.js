// Подключаем express
const express = require ('express');
// создаем приложение
const app = express ();

var dt = new Date();

console.log(dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds() + "\t" + 'INIT');

var redisPort = 6379;
var redisHost = '127.0.0.1';

const Redis = require("redis");

const WebSocket = require(`ws`);
const path  = require(`path`);
const http  = require(`http`);

const PORT = 3000;
const server = http.createServer(app);
const ws = new WebSocket.Server({ server });

const accessModules = ['admin', 'chat', 'notice', 'private'];

/** @var array Список клиентов-пользователей */
var userClients = [];
/** @var array Список клиентов-приложений. У одного пользователя может быть несколько приложений. */
var softClients = [];

server.listen(PORT, (hostname) => {
    console.log(`[server::listen] Ожидаю подключений на хост ${hostname}:${PORT}`);
});
ws.on(`connection`, (socket, req) => {
    const {remoteAddress: ip} = req.socket;
    console.log('===============');
    let sessKey = null;
    let userId  = null;
    let softId  = null;
    if (req.url === '') {
        console.error('[socket::connection] Unknown userId. Socket close');
        socket.close();
        return;
    }
    let n = req.url.indexOf('?');
    if (n < 0) {
        console.error('[socket::connection] Query string is not found. Socket close');
        socket.close();
        return;
    }
    let query = req.url.slice((n+1)).split('&');
    if (!query.length) {
        console.error('[socket::connection] Params not found. Socket close');
        socket.close();
        return;
    }
    for (let i in query) {
        let part = query[i].split('=');
        if (part[0] === 'userId') {
            userId = part[1];
        }
        if (part[0] === 'softId') {
            softId = part[1];
        }
    }
    console.log('[socket::connection] userId:', userId);
    console.log('[socket::connection] softId:', softId);
    console.log('===============');
    if (!userId || !softId) {
        console.error('[socket::connection] Unknown userId. Socket close');
        socket.close();
        return;
    }

    if (typeof req.headers.sessid === 'undefined' || !req.headers.sessid) {
        if (typeof req.headers['sec-websocket-protocol'] === 'undefined' || req.headers['sec-websocket-protocol'] === '') {
            console.error('[socket::connection] Unknown sessKey. Socket close');
            socket.close();
            return;
        } else {
            sessKey = req.headers['sec-websocket-protocol'];
        }
    } else {
        sessKey = req.headers.sessid;
    }
    console.log('[socket::connection] sessKey:', sessKey);
    console.log('===============');
    (async () => {
        const redisClient = Redis.createClient(redisPort, redisHost);
        redisClient.connect().then(()=>{
        }).catch((reason)=>{
            console.error('[redisClient.connect] error reason:', reason);
        });
        let redisSession = await redisClient.get(userId).then((value) => {
            console.log('[redisClient.get] value: ', value);
            return value;
        });
        redisClient.quit().then();
        if (redisSession !== sessKey) {
            console.error('[socket::connection] Wrong sessKey. Socket close');
            socket.close();
            return;
        }
        if (!isIdInArray(userId, userClients)) {
            let obj = {
                'id': userId,
            };
            userClients.push(obj);
        } else {
            console.log('[socket::connection] reconnect userClient', userId);
        }
        console.log('[socket::connection] softId', softId);
        if (!isIdInArray(softId, softClients)) {
            let obj = {
                'id':        softId,
                'userId':    userId,
                'inputId':   userId + '-' + softId,
                'socket':    socket
            };
            socket.inputId = obj.inputId;
            softClients.push(obj);
        } else {
            console.log('[socket::connection] reconnect softClient', softId);
        }
        let msg = new ResponseMessage('connect', {
            type:     'auth',
            format:   'text',
            sender:   userId,
            message:  true
        });
        let sender = new Sender(userId, msg);
        sender.send();
    })();

    socket.on(`message`, (clientMessage) => {
        //console.log(`[socket::message] > ${clientMessage}`);
        let inputMsg;
        try {
            inputMsg = JSON.parse(clientMessage.toLocaleString());
            //console.log('[socket::message] inputMsg', inputMsg);
        } catch (errors) {
            console.log('[socket::message] JSON.parse errors', errors);
            console.log('[socket::message] JSON.parse clientMessage.toLocaleString()', clientMessage.toLocaleString());
        }

        if (typeof inputMsg.module == 'undefined') {
            console.error('[socket::message] unknown module');
            return;
        }

        let module;

        switch (inputMsg.module) {
            case"user":
                module = new User(socket.inputId, inputMsg);
                break;
            case"admin":
                module = new Admin(socket.inputId, inputMsg);
                break;
            case"notice":
                module = new Notifier(socket.inputId, inputMsg);
                break;
            case"chat":
                break;
            case"private":
                break;
        }
        module.exec();
    });

    socket.on(`close`, () => {
        let closeClient;
        for (let i in softClients) {
            if (softClients[i].inputId === socket.inputId) {
                closeClient = softClients.splice(i, 1);
                for (let x = 0; x < userClients.length; x++) {
                    if (String(userClients[x].id) === String(closeClient[0].userId)) {
                        closeUser = userClients.splice(x, 1);
                    }
                }
            }
        }
    });
});

function isIdInArray(id, itemList) {
    for (var i in itemList) {
        if (id === itemList[i].id) {
            //console.log('[isIdInArray] Item was found [' + i + ']. id', id);
            return true;
        }
    }
    //console.log('[isIdInArray] Item not found. id', id);
    return false;
}

class ModuleAbstract {
    constructor(inputId, message) {
        this.sender        = null;
        this.accessMethods = [];
        for (var i in softClients) {
            if (inputId === softClients[i].inputId) {
                this.sender = {
                    id:     softClients[i].id,
                    userId: softClients[i].userId
                };
                for (var z in userClients) {
                    if (softClients[i].userId === userClients[z].id) {
                        this.sender.data = userClients[z];
                    }
                }
                break;
            }
        }
        // console.log(`[module::constructor] sender`, this.sender);
        if (typeof message.method == 'undefined' || !message.method) {
            throw new TypeError('Unknown property method in inputMessage');
        }
        this.method       = message.method;
        this.inputMessage = message;

        this.userId = null;
        if (typeof message.userId !== 'undefined' && message.userId) {
            this.userId = message.userId;
        }
        console.log(`[module::constructor] this.userId`, this.userId);
    }

    checkMethod() {
        if (this.accessMethods.length && this.accessMethods.indexOf(this.method) < 0) {
            throw new TypeError('[module::checkMethod] Unknown method: ' +  this.method);
        }
    }

    exec() {
        try {
            let methodName = this.method;
            console.log('[module::exec] methodName:', methodName);
            this[methodName]();
        } catch (e) {
            console.error(`[module::exec] Exception: ${e}`);
        }
    }
}

class User extends ModuleAbstract {
    constructor(inputId, message) {
        super(inputId, message);
        this.accessMethods = [
            'setData'
        ];
        console.log('[User] this.sender:', this.sender);
    }
    setData() {
        let data    = {};
        let isAdmin = false;
        for (var i in this.inputMessage) {
            if (i === 'module' || i === 'method' || i === 'id') {
                continue;
            }
            if (i === 'isAdmin') {
                isAdmin = this.inputMessage[i];
                continue;
            }
            data[i] = this.inputMessage[i];
        }
        for (var i in userClients) {
            if (this.sender.userId === userClients[i].id) {
                userClients[i].isAdmin = isAdmin;
                userClients[i].data    = data;
                console.log('[User::setData] userClients', userClients[i]);
                break;
            }
        }
        let msg = new ResponseMessage('user', {
            type:     'setData',
            format:   'text',
            sender:   this.sender.userId,
            message:  true
        });
        console.log('[User::setData] ResponseMessage', msg);
        let sender = new Sender(this.sender.userId, msg);
        sender.send();
    }
}

class Admin extends ModuleAbstract {
    constructor(inputId, message) {
        super(inputId, message);
        this.accessMethods = [
            'userlist',
            'countuser'
        ];
    }
    exec() {
        try {
            this.checkMethod();
            if (!this.sender.data.isAdmin) {
                throw new Error('[Admin::exec] This user is not admin' +  this.sender);
            }
            switch (this.method) {
                case "userlist":
                    this.getUserList();
                    break;
                case "countuser":
                    this.getCountUser();
                    break;
            }
            let sender = new Sender(this.sender.userId, this.message);
            sender.send();
        } catch (e) {
            console.error(`[Admin::exec] Exception: ${e}`);
        }
    }

    getCountUser() {
        let options = {
            type:    this.method,
            format:  'text',
            sender:  this.sender.userId,
            message: userClients.length,
            softClients: softClients.length
        };
        this.message = new ResponseMessage('admin', options);
    }

    getUserList() {
        let options = {
            type:    this.method,
            format:  'json',
            sender:  this.sender.userId,
            message: JSON.stringify(userClients),
            softClients: JSON.stringify(softClients)
        };
        this.message = new ResponseMessage('admin', options);
    }
}

class Notifier extends ModuleAbstract {
    constructor(inputId, message) {
        super(inputId, message);
        if (typeof message.text == 'undefined' || !message.text) {
            throw new TypeError('Unknown property text in inputMessage');
        }
        this.text   = message.text;

        this.defaultPriority = 5;
        this.accessMethods   = [
            'notice',
            'noticeAll'
        ];
        console.log('[Notifier] this.inputMessage', this.inputMessage);
    }
    exec() {
        try {
            this.checkMethod();
            switch (this.method) {
                case "notice":
                    //this.userId = message.userId;
                    console.log('[Notifier::exec] notice this.userId', this.userId);
                    this.makeNotice();
                    let sender = new Sender(this.userId, this.message);
                    sender.send();
                    break;
                case "noticeAll":
                    if (typeof this.inputMessage.userIds == 'undefined' || this.inputMessage.userIds.length === 0) {
                        throw new TypeError('[Notifier::noticeAll] Unknown property userIds in inputMessage');
                    }
                    this.makeNotice();
                    for (var z = 0; z < this.inputMessage.userIds.length; z++) {
                        let userId = this.inputMessage.userIds[z];
                        let sender = new Sender(userId, this.message);
                        sender.send();
                    }
            }
        } catch (e) {
            console.error(`[Notifier::exec] Exception: ${e}`);
        }
    }
    makeNotice() {
        let options = {
            type:     'notice',
            format:   'text',
            sender:   this.sender.userId,
            message:  this.text,
            priority: (this.inputMessage.hasOwnProperty('priority') && this.inputMessage.priority ? this.inputMessage.priority : this.defaultPriority)
        };
        this.message = new ResponseMessage('notice', options);
    }
}

class Sender {
    constructor(userId, message) {
        if (typeof message == 'undefined' || !message) {
            throw new TypeError('[Sender] The message cannot be empty or undefined');
        }

        this.userId  = userId;
        this.message = JSON.stringify(message);
    }
    send() {
        for (var i in softClients) {
            if (this.userId == softClients[i].userId) {
                // console.log('[Sender::send] userId was found [' + i + ']. inputId', softClients[i].inputId);
                console.log(this.userId + '['+i+'] send:', this.message)
                softClients[i].socket.send(this.message);
            }
        }
    }
}

class ResponseMessage {
    constructor(module, options) {
        this.module  = module;
        this.options = options;
    }
}
