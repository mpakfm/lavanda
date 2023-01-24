/**
 * Created by PhpStorm
 * Project: Lavanda
 * User:    sfomin
 * Date:    09.12.2022
 */

const ModuleAbstract = require("./module");

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

module.exports = Admin;
