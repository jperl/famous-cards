define(function (require, exports, module) {
    var Tools = {};

    /**
     * Map the a value to a result.
     * Ex. value = .5, valueRange = [0, 1], resultRange = [0, 100], result = 50
     */
    Tools.map = function (value, valueRange, resultRange, keepWithinRange) {
        var valueRangeStart = valueRange[0], valueRangeEnd = valueRange[1],
            resultRangeStart = resultRange[0], resultRangeEnd = resultRange[1];

        var currentProgress = (value - valueRangeStart) / (valueRangeEnd - valueRangeStart);

        var result = currentProgress * (resultRangeEnd - resultRangeStart) + resultRangeStart;

        if (keepWithinRange) {
            // if the range is increasing (0 -> 100)
            if (resultRangeEnd > resultRangeStart) {
                if (result > resultRangeEnd) {
                    result = resultRangeEnd;
                } else if (result < resultRangeStart) {
                    result = resultRangeStart;
                }
            }
            // if the range is decreasing (100 -> 0)
            else {
                if (result > resultRangeStart) {
                    result = resultRangeStart;
                } else if (result < resultRangeEnd) {
                    result = resultRangeEnd;
                }
            }
        }

        return result;
    };

    /**
     * Position difference to a pageIndex.
     */
    Tools.distanceFromPage = function (scrollview, pageIndex) {
        var currentNodeIndex = scrollview._node.index;

        var pageSize = window.innerWidth;
        var distance = (pageIndex - currentNodeIndex) * pageSize;
        return distance;
    };

    /**
     * Force a scrollview to a position
     */
    Tools.forcePosition = function (scrollview, position, noSpring) {
        if (noSpring) {
            scrollview._springState = 0;
            scrollview._physicsEngine.detachAll();
        }

        scrollview.setVelocity(0);
        scrollview.setPosition(position);
    };

    module.exports = Tools;
});