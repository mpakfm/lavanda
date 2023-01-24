/**
 * Created by PhpStorm
 * Project: Lavanda
 * User:    sfomin
 * Date:    09.12.2022
 */

const ModuleAbstract = require("./module");

class User extends ModuleAbstract {
    constructor(inputId, message) {
        super(inputId, message);
        this.accessMethods = [
            'setData'
        ];
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
                break;
            }
        }
        let msg = new ResponseMessage('user', {
            type:     'setData',
            format:   'text',
            sender:   this.sender.userId,
            message:  true
        });
        let sender = new Sender(this.sender.userId, msg);
        sender.send();
    }
}

module.exports = User;
