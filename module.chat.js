/**
 * Created by PhpStorm
 * Project: Lavanda
 * User:    sfomin
 * Date:    12.12.2022
 */

const ModuleAbstract = require("./module");

/** @var array Список комнат. */
global.rooms = [];

class Chat extends ModuleAbstract {
    constructor(inputId, message) {
        super(inputId, message);
        if (typeof message.text == 'undefined' || !message.text) {
            throw new TypeError('Unknown property text in inputMessage');
        }
        this.text   = message.text;

        this.accessMethods   = [
        ];
        console.log('[Chat] this.inputMessage', this.inputMessage);
    }

    selectRoom(room) {

    }
}
