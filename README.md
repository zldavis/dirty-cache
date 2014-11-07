# dirty-cache

Basic wrapper around lru-cache that uses pub-sub for notifying of a
dirty entry.  Not all lru-cache functionality is exposed, mainly
get, set, and del.

One difference to be aware of, values in cache are a deep clone of
the inserted value so that any modifications made to the object
before or after being cached don't change modify the object in
cache.

```javascript
var obj = {foo: 'bar'};
cache.set(1, obj);

obj == cache.get(1); // false
obj.foo == cache.get(1).foo; // true
```

[![Build Status](https://travis-ci.org/zldavis/dirty-cache.svg?branch=master)](https://travis-ci.org/zldavis/dirty-cache)

## Usage

```javascript
var dirtyCache = require('dirty-cache');

var cache = dirtyCache({name: 'users', max: 100, maxAge: 60000});

cache.set('0087e434-9dfe-4ac9-99e9-fbdbd9f834f5', {name: 'TJ'});
cache.get('0087e434-9dfe-4ac9-99e9-fbdbd9f834f5'); // {name: 'TJ'}
```

## Options

* `name` The name of this cache. Needed when using same cache on
  distributed system.  Optional or not needed when used as a
  standalone cache.
* `max` The maximum number of objects in the cache, Not setting this
  is kind of silly, since that's the whole purpose of this lib, but
  it defaults to `Infinity`.
* `maxAge` Maximum age in ms.  Items are not pro-actively pruned out
  as they age, but if you try to get an item that is too old, it'll
  drop it and return undefined instead of giving it to you.

## API

### set(key, value, dirty)

Sets the value of `key` in the local cache. If `dirty`, notifies
other caches their value is stale.

### get(key)

Gets the latest `value` of `key`, or `undefined` if was not present
in local cache or has been evicted due to dirtiness or expiration.

### del(key)

Deletes a key out of the local cache and notifies distributed
caches to evict key.

## Events

### "error"

Error event in the case of connection errors to redis.

### "ready"

Client will emit `ready` after the conenction to redis has been successfully established.
