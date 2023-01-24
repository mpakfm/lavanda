/**
 * Created by PhpStorm
 * Project: Lavanda
 * User:    sfomin
 * Date:    09.12.2022
 */

class Sender {
    constructor(userId, message) {
        if (typeof message == 'undefined' || !message) {
            throw new TypeError('[Sender] The message cannot be empty or undefined');
        }

        this.userId  = userId;
        this.message = JSON.stringify(message);
    }
    send() {
        //console.log('[Sender::send] this.userId', this.userId);
        //console.log('[Sender::send] this.message', this.message);
        for (var i in softClients) {
            //console.log('[Sender::send] softClients['+i+'].userId', softClients[i].userId);
            if (this.userId == softClients[i].userId) {
                //console.log('[Sender::send] userId was found [' + i + ']. inputId', softClients[i].inputId);
                //console.log(this.userId + '['+i+'] send:', this.message)
                softClients[i].socket.send(this.message);
            }
        }
    }
}

module.exports = Sender;
