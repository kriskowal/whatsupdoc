
//Copyright 2009 Nicholas C. Zakas. All rights reserved.
//MIT-Licensed, see source file
exports.binarySearch = binarySearch;
function binarySearch(items, value) {

    var startIndex  = 0,
        stopIndex   = items.length - 1,
        middle      = Math.floor((stopIndex + startIndex) / 2);

    while (items[middle] !== value && startIndex < stopIndex) {

        // adjust search area
        if (value < items[middle]) {
            stopIndex = middle - 1;
        } else if (value > items[middle]) {
            startIndex = middle + 1;
        }

        // recalculate middle
        middle = Math.ceil((stopIndex + startIndex) / 2);
    }

    while (items[middle] < value && middle < items.length)
        middle++;

    return middle;
}

