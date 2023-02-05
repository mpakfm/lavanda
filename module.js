/**
 * Created by PhpStorm
 * Project: Lavanda
 * User:    sfomin
 * Date:    09.12.2022
 */

class ModuleAbstract {
    constructor(inputId, message) {
        //console.log(`[module::constructor] inputId`, inputId);

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
                        break;
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
        //console.log(`[module::constructor] this.userId`, this.userId);
        //console.log(`[module::constructor] this.sender`, this.sender);
    }

    checkMethod() {
        if (this.accessMethods.length && this.accessMethods.indexOf(this.method) < 0) {
            throw new TypeError('[module::checkMethod] Unknown method: ' +  this.method);
        }
    }

    exec() {
        try {
            let methodName = this.method;
            //console.log('[module::exec] methodName:', methodName);
            this[methodName]();
        } catch (e) {
            console.error(`!!! [module::exec] Exception: ${e}`);
        }
    }
}

module.exports = ModuleAbstract;
