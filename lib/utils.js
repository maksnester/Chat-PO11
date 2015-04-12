/**
 * Ищет в массиве объект, у которого атрибут attr иммет значение value
 * @param array
 * @param attr
 * @param value
 * @returns {number}
 */
module.exports.indexOfObjByAttr = function (array, attr, value) {
    if (array) {
        for(var i = 0; i < array.length; i += 1) {
            if(array[i][attr] === value) {
                return i;
            }
        }
    }

    return -1;
};