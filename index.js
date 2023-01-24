/**
 * Created by PhpStorm
 * Project: Lavanda
 * User:    sfomin
 * Date:    02.08.2022
 */

require('dotenv').config();

// Подключаем express
const express = require ('express');
// функции
const functions = require("./functions");
// классы
const Sender          = require("./sender");
const ResponseMessage = require("./response.message");
const User            = require("./module.user");
const Admin           = require("./module.admin");
const Notifier        = require("./module.notifier");

// создаем приложение
const app = express ();

var dt = new Date();

console.log(dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds() + "\t" + 'INIT');

var redisPort = process.env.REDIS_PORT;
var redisHost = process.env.REDIS_HOST;
var redisDb   = process.env.REDIS_DB;

var noticeClientId   = process.env.NOTICE_CLIENT_ID;

const Redis = require("redis");

const WebSocket = require(`ws`);
const path  = require(`path`);
const http  = require(`http`);

const PORT = process.env.PORT;
const server = http.createServer(app);
const ws = new WebSocket.Server({ server });

const accessModules = ['admin', 'chat', 'notice', 'private'];

/** @var array Список клиентов-пользователей */
global.userClients = [];
/** @var array Список клиентов-приложений. У одного пользователя может быть несколько приложений. */
global.softClients = [];

global.Redis           = Redis;
global.redisPort       = redisPort;
global.redisHost       = redisHost;
global.redisDb         = redisDb;
global.noticeClientId  = noticeClientId;
global.Sender          = Sender;
global.ResponseMessage = ResponseMessage;

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
    let baseId = 'LAVANDA:CLIENTID:';
    console.log('[socket::connection] sessKey:', sessKey);
    console.log('===============');
    (async () => {
        const redisClient = Redis.createClient(redisPort, redisHost);
        redisClient.connect().then(()=>{
        }).catch((reason)=>{
            console.error('[redisClient.connect] error reason:', reason);
        });
        redisClient.select(redisDb);
        console.log('get userId', userId);
        let redisSession = await redisClient.get(baseId + userId).then((value) => {
            console.log('[redisClient.get] value: ', value);
            return value;
        });
        redisClient.quit().then();
        if (redisSession !== sessKey) {
            console.error('[socket::connection] Wrong sessKey. Socket close');
            socket.close();
            return;
        }
        if (!functions.isIdInArray(userId, userClients)) {
            let obj = {
                'id': userId,
            };
            userClients.push(obj);
        } else {
            console.log('[socket::connection] reconnect userClient', userId);
        }
        console.log('[socket::connection] softId', softId);
        if (!functions.isIdInArray(softId, softClients)) {
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
        sender.send(softClients);
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
