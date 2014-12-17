var assert = require('assert');

var dirtyCache = require('../lib/dirty-cache');

describe('dirty-cache', function() {

    describe('basic', function() {

        var cache;
        beforeEach(function() {
            cache = dirtyCache({name: 'users', max: 5, maxAge: 10});
        });

        it('should be initialized correctly', function() {
            assert.equal(cache.name, 'users');
            assert.equal(cache.max, 5);
            assert.equal(cache.maxAge, 10);
            assert.equal(cache.length, 0);
            assert.equal(cache.hits, 0);
            assert.equal(cache.misses, 0);
        });

        it('should cache correctly', function() {
            cache.set('key', 'value');
            assert.equal(cache.get('key'), 'value');
            assert.equal(cache.get('nada'), undefined);
            assert.equal(cache.length, 1);
        });

        it('should be a deep clone', function() {
            var value = {a: 1, b: 2};
            cache.set('key', value);
            assert.notEqual(cache.get('key'), value);
            assert.deepEqual(cache.get('key'), value);
        });

        it('should not be modified in cache', function() {
            var value = {a: 1, b: 2};
            cache.set('key', value);

            value.a = 2;
            assert.notDeepEqual(cache.get('key'), value);
        });

        it('should evict item after max age', function(done) {
            cache.set('key', 'value');
            setTimeout(function() {
                assert.equal(cache.get('key'), 'value');
                assert.equal(cache.length, 1);
            }, 5);
            setTimeout(function() {
                assert.equal(cache.get('key'), undefined);
                assert.equal(cache.length, 0);
                done();
            }, 11);
        });

        it('should evict the least recently used', function() {
            for (var i=0; i<5; i++) {
                cache.set(i, i);
            }

            for (var i=0; i<5; i++) {
                assert.equal(cache.get(i), i);
            }

            cache.set(5, 5);
            assert.equal(cache.get(0), undefined);
            assert.equal(cache.length, 5);

            for (var i=1; i<6; i++) {
                assert.equal(cache.get(i), i);
            }
        });

        it('should have correct stats', function() {
            cache.set('key', 'value');
            assert.deepEqual(cache.stats(), {hits: 0, misses: 0});

            cache.get('key');
            cache.get('key');
            assert.deepEqual(cache.stats(), {hits: 2, misses: 0});

            cache.get('nada');
            assert.deepEqual(cache.stats(), {hits: 2, misses: 1});
        });

        it('should evict all if reset', function() {
            cache.set('key', 'value');
            cache.set('another', 'value');
            assert.equal(cache.length, 2);
            cache.reset();
            assert.equal(cache.length, 0);
        });
    });

    describe('cluster', function() {

        var cache1;
        var cache2;
        beforeEach(function(done) {
            var readyCount = 0;

            cache1 = dirtyCache({
                name: 'users',
                max: 5,
                maxAge: 50,
                redis: {
                    host: 'localhost',
                    port: 6379
                }
            });
            cache1.on('error', function(err) {
                throw err;
            });
            cache1.on('ready', function() {
                if (++readyCount == 2) {
                    done();
                }
            });

            cache2 = dirtyCache({
                name: 'users',
                max: 5,
                maxAge: 100,
                redis: {
                    host: 'localhost',
                    port: 6379
                }
            });
            cache2.on('error', function(err) {
                throw err;
            });
            cache2.on('ready', function() {
                if (++readyCount == 2) {
                    done();
                }
            });

            setTimeout(function() {
                if (readyCount < 2) {
                    throw new Error('unable to connect to redis at localhost:6379 after 5 seconds');
                }
            }, 5000);
        });

        it('should evict the dirty cache on other clients if set dirty', function(done) {
            cache1.set('key', 'value');
            cache2.set('key', 'value');

            assert.equal(cache1.get('key'), 'value');
            assert.equal(cache2.get('key'), 'value');

            cache1.set('key', 'value dirty', true);

            setTimeout(function() {
                assert.equal(cache1.get('key'), 'value dirty');
                assert.equal(cache2.get('key'), undefined);
                done();
            }, 10);
        });

        it('should evict the dirty cache on other clients if deleted', function(done) {
            cache1.set('key', 'value');
            cache2.set('key', 'value');

            assert.equal(cache1.get('key'), 'value');
            assert.equal(cache2.get('key'), 'value');

            cache1.del('key');

            setTimeout(function() {
                assert.equal(cache1.get('key'), undefined);
                assert.equal(cache2.get('key'), undefined);
                done();
            }, 10);
        });

        it('should evict all if evicted on other client', function(done) {
            cache1.set('key', 'value');
            cache2.set('key', 'value');

            cache1.reset();

            setTimeout(function() {
                assert.equal(cache2.length, 0);
                done();
            }, 10);
        });
    });
});