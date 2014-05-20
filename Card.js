define(function (require) {
    var RenderNode = require('famous/core/RenderNode');
    var Surface = require('famous/core/Surface');
    var View = require('famous/core/View');

    function Card(options) {
        View.apply(this, arguments);
    }

    Card.prototype = Object.create(View.prototype);
    Card.prototype.constructor = Card;

    /**
     * Called when the card is transitioning from small to large or large to small.
     * @param progress Scale of the card between [0, 100] (approximately).
     */
    Card.prototype._progress = function (progress) {
    };

    /**
     * Dispose the card.
     */
    Card.prototype.dispose = function () {
    };

    return Card;
});