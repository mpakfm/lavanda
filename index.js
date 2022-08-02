// Настройки mysql
const setup = {port:8000}
// Подключаем express
const express = require ('express');
// создаем приложение
const app = express ();

var dt = new Date();

console.log(dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds() + "\t" + 'INIT');

const WebSocket = require(`ws`);
const path = require(`path`);
const http = require(`http`);
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
    console.log('[socket::connection] headers:', req.headers);
    console.log('===============');
    if (typeof req.headers.userid === 'undefined' || !req.headers.userid) {
        console.error('[socket::connection] Unknown userid. Socket close');
        socket.close();
        return;
    }
    if (!isIdInArray(req.headers.userid, userClients)) {
        let obj = {
            'id': req.headers.userid,
        };
        userClients.push(obj);
    } else {
        console.log('[socket::connection] reconnect userClient', req.headers.userid);
    }

    if (!isIdInArray(req.headers.softid, softClients)) {
        let obj = {
            'id':        req.headers.softid,
            'userId':    req.headers.userid,
            'inputId':   req.headers.softid + '-' + req.headers.userid,
            'socket':    socket
        };
        socket.inputId = obj.inputId;
        softClients.push(obj);
    } else {
        console.log('[socket::connection] reconnect softClient', req.headers.softid);
    }

    socket.on(`message`, (clientMessage) => {
        console.log(`[socket::message] > ${clientMessage}`);
        let inputMsg;
        try {
            inputMsg = JSON.parse(clientMessage.toLocaleString());
            console.log('[socket::message] inputMsg', inputMsg);
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
            case"admin":
                console.log('[socket::message] admin');
                module = new Admin(socket.inputId, inputMsg);
                break;
            case"notice":
                console.log('[socket::message] notice');
                module = new Notifier(socket.inputId, inputMsg);
                break;
            case"chat":
                console.log('[socket::message] chat');
                break;
            case"private":
                console.log('[socket::message] private');
                break;
        }

        module.exec();
    });

    socket.on(`close`, () => {
        let closeClient;
        console.log('[close] socket.inputId', socket.inputId);
        console.log('count softClients: ', softClients.length);
        for (let i in softClients) {
            console.log('softClients ['+i+']:', softClients[i].inputId);
            if (softClients[i].inputId === socket.inputId) {
                console.log('close inputId', softClients[i].inputId);
                closeClient = softClients.splice(i, 1);
            }
        }
        console.log('splice count softClients: ', softClients.length);
        console.log(`Клиент отключён ip: ${ip}`);
        console.log(`closeClient:`, closeClient);
        console.log(`userClients:`, userClients);
        console.log(`softClients:`, softClients);
    });
});

function isIdInArray(id, itemList) {
    for (var i in itemList) {
        if (id === itemList[i].id) {
            console.log('[isIdInArray] Item was found [' + i + ']. id', id);
            return true;
        }
    }
    console.log('[isIdInArray] Item not found. id', id);
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
                break;
            }
        }
        console.log(`[module::constructor] sender`, this.sender);
        if (typeof message.method == 'undefined' || !message.method) {
            throw new TypeError('Unknown property method in inputMessage');
        }
        this.method       = message.method;
        this.inputMessage = message;

        this.userId = null;
        if (typeof message.userId == 'undefined' || !message.userId) {
            this.userId = message.userId;
        }
    }

    checkMethod() {
        console.log('[module::checkMethod] method', this.method);
        console.log('[module::checkMethod] accessMethods', this.accessMethods);
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

class Admin extends ModuleAbstract{
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
            console.log('[Admin::exec] accessMethods:', this.accessMethods);
            switch (this.method) {
                case "userlist":
                    this.getUserList();
                    break;
                case "countuser":
                    this.getCountUser();
                    break;
            }
            console.log('[Admin::exec] send message:', this.message);
            let sender = new Sender(this.userId, this.message);
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
            message: userClients.length
        };
        console.log('[Admin::getCountUser] options:', options);
        this.message = new ResponseMessage('admin', options);
        console.log('[Admin::getCountUser] message:', this.message);
    }

    getUserList() {
        let options = {
            type:    this.method,
            format:  'json',
            sender:  this.sender.userId,
            message: JSON.stringify(userClients)
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
        this.text = message.text;

        this.defaultPriority = 5;
        this.accessMethods   = [
            'notice'
        ];
        console.log('[Notifier] this.inputMessage', this.inputMessage);
    }
    exec() {
        try {
            this.checkMethod();
            switch (this.method) {
                case "notice":
                    this.sendNotice();
                    break;
            }
            let sender = new Sender(this.userId, this.message);
            sender.send();
        } catch (e) {
            console.error(`[Notifier::exec] Exception: ${e}`);
        }
    }
    sendNotice() {
        console.log('[Notifier::sendNotice] this.inputMessage', this.inputMessage);
        let options = {
            type:     this.method,
            format:   'text',
            sender:   this.sender.userId,
            message:  this.text,
            priority: (this.inputMessage.hasOwnProperty('priority') && this.inputMessage.priority ? this.inputMessage.priority : this.defaultPriority)
        };
        this.message = new ResponseMessage('admin', options);
    }
}

class Sender {
    constructor(userId, message) {
        console.log('[Sender::constructor] userId ', userId);
        console.log('[Sender::constructor] message ', message);
        console.log('[Sender::constructor] softClients.length ', softClients.length);
        if (typeof message == 'undefined' || !message) {
            throw new TypeError('[Sender] The message cannot be empty or undefined');
        }

        this.userId  = userId;
        this.message = JSON.stringify(message);
    }
    send() {
        for (var i in softClients) {
            if (this.userId == softClients[i].userId) {
                console.log('[Sender::send] userId was found [' + i + ']. inputId', softClients[i].inputId);
                console.log('['+i+'] send:', this.message)
                softClients[i].socket.send(this.message);
            }
        }
    }
}

class ResponseMessage {
    constructor(module, options) {
        this.module  = module;
        this.options = options;
        console.log('[ResponseMessage]:', this);
    }
}
