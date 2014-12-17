var util = require('util');
var EventEmitter = require('events').EventEmitter;
var LRU = require('lru-cache');
var redis = require("redis");
var uuid = require('uuid');
var _ = require('lodash');

var Store = function(options) {
    EventEmitter.call(this);

    var self = this;
    self.name = options.name || uuid();
    self.max = options.max || 1000;
    self.maxAge = options.maxAge;
    self.clientId = uuid();

    var lruOptions = {max: self.max};
    if (self.maxAge) {
        lruOptions.maxAge = self.maxAge;
    }

    self.cache = LRU(lruOptions);
    self.hits = 0;
    self.misses = 0;

    if (options.redis) {
        options.redis.port = options.redis.port || 6379;
        options.redis.host = options.redis.host || 'localhost';

        var clientsConnected = 0;
        var redisClientEvents = function(client) {
            client.on('error', function(err) {
                self.emit('error', err);
            });

            client.on('ready', function() {
                if (++clientsConnected == 2) {
                    self.emit('ready');
                }
            });
        };

        self.subscriber = redis.createClient(options.redis.port, options.redis.host);
        redisClientEvents(self.subscriber);

        self.publisher = redis.createClient(options.redis.port, options.redis.host);
        redisClientEvents(self.publisher);

        if (options.redis.password) {
            self.subscriber.auth(options.redis.password);
            self.publisher.auth(options.redis.password);
        }

        self.dirtyChannel = 'dirty-cache:' + self.name;

        self.subscriber.on('message', function(channel, message) {
            if (channel !== self.dirtyChannel) {
                return;
            }

            var json = JSON.parse(message);

            if (json.reset) {
                return self._reset();
            }

            // ignore messages from self
            if (json.clientId === self.clientId) {
                return;
            }

            self.cache.del(json.key);
        });

        self.subscriber.subscribe(self.dirtyChannel);
    } else {
        process.nextTick(function() {
            self.emit('ready');
        });
    }
};

util.inherits(Store, EventEmitter);

Store.prototype.set = function(key, value, dirty) {
    this.cache.set(key, _.cloneDeep(value));
    if (dirty && this.publisher) {
        this.publisher.publish(this.dirtyChannel, JSON.stringify({clientId: this.clientId, key: key}));
    }
};

Store.prototype.get = function(key) {
    var value = this.cache.get(key);

    if (undefined !== value) {
        this.hits++;
        return _.cloneDeep(value);
    }

    this.misses++;
    return undefined;
};

Store.prototype.del = function(key) {
    this.cache.del(key);
    if (this.publisher) {
        this.publisher.publish(this.dirtyChannel, JSON.stringify({clientId: this.clientId, key: key}));
    }
};

Object.defineProperty(Store.prototype, 'length', {
    get: function () { return this.cache.length; }, enumerable : true
});

Store.prototype._reset = function() {
    this.cache.reset();
    this.hits = 0;
    this.misses = 0;
};

Store.prototype.reset = function() {
    if (this.publisher) {
        this.publisher.publish(this.dirtyChannel, JSON.stringify({reset: true}));
    }
    this._reset();
};

Store.prototype.stats = function() {
    return {hits: this.hits, misses: this.misses};
};

module.exports = Store;
