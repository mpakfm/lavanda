/**
 * Created by PhpStorm
 * Project: Lavanda
 * User:    sfomin
 * Date:    08.12.2022
 */

module.exports.isIdInArray = function isIdInArray(id, itemList) {
    for (var i in itemList) {
        if (id === itemList[i].id) {
            //console.log('[isIdInArray] Item was found [' + i + ']. id', id);
            return true;
        }
    }
    //console.log('[isIdInArray] Item not found. id', id);
    return false;
}
