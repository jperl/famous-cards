define(function (require) {
    var EventHandler = require('famous/core/EventHandler');
    var Transform = require('famous/core/Transform');
    var View = require('famous/core/View');
    var ViewSequence = require('famous/core/ViewSequence');

    var GenericSync = require('famous/inputs/GenericSync');

    var Transitionable = require('famous/transitions/Transitionable');
    var SpringTransition = require('famous/transitions/SpringTransition');
    var Scrollview = require('famous/views/Scrollview');
    var Utility = require('famous/utilities/Utility');

    var Tools = require('./Tools');

    /**
     * Track user scrolling to update the scale of the cards.
     */
    var handleScrolling = function () {
        this.sync.on('update', function (payload) {
            this.direction = Math.abs(payload.velocity[0]) > Math.abs(payload.velocity[1])
                ? GenericSync.DIRECTION_X
                : GenericSync.DIRECTION_Y;

            // Set the scale and translate when we are moving in the y direction.
            if (this.direction === GenericSync.DIRECTION_X) return;

            var topMargin = window.innerHeight - this.options.height;
            var yPos = payload.clientY - topMargin;

            // If this is the initial scroll, set initialX and the scale path.
            if (!this.scrolling) {
                this.initialX = payload.clientX;

                // Set the scale path.

                var cardHeight = this.options.height * this.scale;
                var cardTop = this.options.height - cardHeight;

                // Find the y position relative to the current card.
                var relativeY = Math.abs((yPos - cardTop) / cardHeight);

                // Calculate the y for the card at full scale.
                var relativeFullCardY = relativeY * this.options.height;

                // Calculate the y for the card at small scale.
                var relativeScaledCardY = relativeY * this.options.smallScale * this.options.height;
                var scaledCardY = this.options.height - (this.scaledCardHeight - relativeScaledCardY);

                this.scalePath = [scaledCardY, relativeFullCardY];

                this.scrolling = true;
            }

            this.yPos.set(yPos);
        }.bind(this));

        // When the user is done scrolling slide the cards up or down
        // depending on the current position and velocity.
        this.sync.on('end', function (payload) {
            this.scrolling = false;

            if (!payload.velocity) return;

            // If the user finished scrolling slide the cards up or down.
            var velocity = payload.velocity.length ? payload.velocity[1] : payload.velocity;
            velocity = velocity.toFixed(2);

            // If the y velocity is above the threshold slide the cards up
            // or down based on the direction they are scrolling.
            if (this.direction === GenericSync.DIRECTION_Y && Math.abs(velocity) > this.options.velThreshold) {
                if (velocity < 0) this.slideUp(Math.abs(velocity));
                else this.slideDown(velocity);
            }
            // Otherwise slide the cards up or down
            // based on the card's position.
            else {
                // If cards are half way to the top, slide them up.
                var halfWayScale = 1 - (1 - this.options.smallScale) / 2;
                if (this.scale >= halfWayScale) this.slideUp(Math.abs(velocity));
                else this.slideDown(velocity);
            }
        }.bind(this));
    };

    /**
     * A scrollview for cards that slide up to full scale or down to smallScale.
     */
    function CardScrollview(options) {
        View.apply(this, arguments);

        this.options = Object.create(CardScrollview.DEFAULT_OPTIONS);
        options = options || {};
        for (var i in CardScrollview.DEFAULT_OPTIONS) {
            if (options[i] !== undefined) this.options[i] = options[i];
        }

        this.scaledCardHeight = this.options.height * CardScrollview.DEFAULT_OPTIONS.smallScale;

        // We will scale the card scrollview based on
        // where the yPos is along the scale path.
        this.yPos = new Transitionable(0);
        this.scalePath = [0, 100]; // will get reset after the first scroll

        // Keep track of user scrolling in the y direction.
        this.sync = new GenericSync({
            "mouse": {},
            "touch": {},
            "scroll": {}
        });

        // Instantiate the scrollview.
        this._touchListeners = [];
        this.cards = [];
        this.scrollview = new Scrollview(this.options.scrollviewOptions);
        var viewSequence = new ViewSequence(this.cards, 0, true);
        this.scrollview.sequenceFrom(viewSequence);

        // Pipe the card events to the scrollview and sync.
        this.cardsHandler = new EventHandler;
        this.slidable(true);
        this.scrollable(true);

        handleScrolling.call(this);
    }

    Transitionable.registerMethod('spring', SpringTransition);
    CardScrollview.prototype = Object.create(View.prototype);
    CardScrollview.prototype.constructor = CardScrollview;

    CardScrollview.DEFAULT_OPTIONS = {
        height: window.innerHeight,
        velThreshold: .25,
        spring: {
            method: 'spring',
            period: 200,
            dampingRatio: 1
        },
        curve: {
            duration: 500,
            curve: 'easeOut'
        },
        smallScale: .4
    };

    CardScrollview.DEFAULT_OPTIONS.scrollviewOptions = {
        direction: Utility.Direction.X,
        margin: 3 * window.innerWidth,
        pageSwitchSpeed: .1,
        pagePeriod: 300,
        pageDamp: 1,
        drag: .001
    };

    CardScrollview.prototype.addCard = function (card, atIndex) {
        var cards = this.cards;

        if (atIndex == null || atIndex == undefined) atIndex = cards.length;

        cards.splice(atIndex, 0, card);

        // Pipe the card events to the cards handler.
        card.pipe(this.cardsHandler);

        // Set the target cards when a card is touched.
        var setTarget = function (card) {
            this.target = card;
        }.bind(this, card);
        card.on('touchstart', setTarget);

        // Keep track of the listener so we can dispose of it later.
        this._touchListeners.push(setTarget);

        if (typeof this.progress === 'number') card._progress(this.progress);
    };

    CardScrollview.prototype.removeCard = function (atIndex) {
        var card = this.cards[atIndex];
        card.unpipe(this.cardsHandler);

        var listener = this._touchListeners.splice(atIndex, 1);

        if (card._eventOutput.listeners['touchstart']) {
            card.removeListener('touchstart', listener[0]);
        }

        this.cards.splice(atIndex, 1);
    };

    CardScrollview.prototype.dispose = function () {
        // Remove all the cards
        for (var i = 0; i < this.cards.length; i++) this.removeCard(0);
    };

    /**
     * Return the scrollview's page.
     */
    CardScrollview.prototype.page = function () {
        var pageIndex = this.scrollview._node.getIndex();
        return this.cards[pageIndex];
    };

    CardScrollview.prototype.scrollable = function (enable) {
        if (this._scrollable == enable) return;

        this._scrollable = !!enable;

        enable ? this.cardsHandler.pipe(this.scrollview)
            : this.cardsHandler.unpipe(this.scrollview)
    };

    CardScrollview.prototype.slidable = function (enable) {
        if (this._slidable == enable) return;

        this._slidable = !!enable;

        enable ? this.cardsHandler.pipe(this.sync)
            : this.cardsHandler.unpipe(this.sync);
    };

    CardScrollview.prototype.scrollTo = function (id) {
        var targetIndex = null;
        this.cards.forEach(function (card, index) {
            if (card.options._id === id) targetIndex = index;
            return true;
        });

        if (!targetIndex) return;

        // Center the card.
        var distance = Tools.distanceFromPage(this.scrollview, targetIndex);
        Tools.forcePosition(this.scrollview, distance);
        // Prevent a problem when snapping up the second card
        // would snap back to the first card by setting _onEdge to false.
        this.scrollview._onEdge = false;
    };

    /**
     * Slide the cards to full scale.
     * @param velocity
     */
    CardScrollview.prototype.slideUp = function (velocity) {
        if (!this._slidable) return;

        var spring = this.options.spring;
        spring.velocity = velocity;
        this.yPos.set(this.scalePath[1], spring);

        this.options.scrollviewOptions.paginated = true;
        this.scrollview.setOptions(this.options.scrollviewOptions);

        if (this.target) this.scrollTo(this.target.options._id);

        this._eventOutput.emit('slidingUp', this.target);
    };

    /**
     * Slide the cards down to smallScale.
     * @param velocity
     */
    CardScrollview.prototype.slideDown = function (velocity) {
        if (!this._slidable) return;

        var spring = this.options.spring;
        spring.velocity = velocity;
        this.options.scrollviewOptions.paginated = false;
        this.scrollview.setOptions(this.options.scrollviewOptions);
        this.yPos.set(this.scalePath[0], spring);

        this._eventOutput.emit('slidingDown', this.target);
    };

    /**
     * Set the scale based on the yPos.
     */
    function _setScale() {
        var yPos = this.yPos.get();

        // Scale the card based on the yPos.
        this.scale = Tools.map(yPos, this.scalePath, [this.options.smallScale, 1]);

        // Keep the scale above 50% of the smallScale
        this.scale = Math.max(this.scale, this.options.smallScale * .5);
        // and below 2x the card size.
        this.scale = Math.min(this.scale, 2);
    }

    /**
     * Move the scrollview (the x axis) based on the initial x touch position
     * to counteract scaling displacement.
     */
    function _translateScroll(scaleDelta) {
        if (!this.scrolling || !this._scrollable) return;

        // Calculate the total displacement at the top.
        var totalDisplacement = this.initialX * (1 / this.options.smallScale);

        // Calculate this slice of the displacement.
        var displace = totalDisplacement * scaleDelta;

        // Smooth out the displacement.
        displace = displace * (1 - this.options.smallScale) / this.scale;

        Tools.forcePosition(this.scrollview, this.scrollview.getPosition() + displace, true);
    }

    CardScrollview.prototype.render = function () {
        var previousScale = this.scale || 0;
        _setScale.call(this);
        _translateScroll.call(this, this.scale - previousScale);

        this.scrollview.sync.setOptions({
            direction: GenericSync.DIRECTION_X,
            scale: 1 / this.scale
        });

        var lastProgress = this.progress;
        this.progress = Math.floor(Tools.map(this.scale, [this.options.smallScale, 1], [0, 100], true)) / 100;

        // If the progress changed by at least a percent
        // update the card's progress and emit an event.
        if (typeof lastProgress === 'undefined' || Math.abs(lastProgress - this.progress) >= .01) {
            for (var i = 0; i < this.cards.length; i++) this.cards[i]._progress(this.progress);
            this._eventOutput.emit('progress', this.progress);
        }

        return {
            size: [undefined, this.options.height],
            target: {
                origin: [0, 1],
                transform: Transform.scale(this.scale, this.scale),
                target: this.scrollview.render()
            }
        };
    };

    return CardScrollview;
});