/**
 * A doubly linked list-based Least Recently Used (LRU) cache. Will keep most
 * recently used items while discarding least recently used items when its limit
 * is reached.
 *
 * Licensed under MIT. Copyright (c) 2010 Rasmus Andersson <http://hunch.se/>
 * Typescript-ified by Oleksandr Nikitin <https://tvori.info>
 *
 * Illustration of the design:
 *
 *       entry             entry             entry             entry
 *       ______            ______            ______            ______
 *      | head |.newer => |      |.newer => |      |.newer => | tail |
 *      |  A   |          |  B   |          |  C   |          |  D   |
 *      |______| <= older.|______| <= older.|______| <= older.|______|
 *
 *  removed  <--  <--  <--  <--  <--  <--  <--  <--  <--  <--  <--  added
 */

// TODO ? Pourquoi ne pas ajouter une dépendances?

export interface Entry {
  newer?: Entry;
  older?: Entry;
  key: string;
  value: any;
}

interface KeyMap {
  [key: string]: Entry;
}

export class LRUCache {

  limit: number;
  size: number;
  private keymap: KeyMap;
  private head?: Entry;
  private tail?: Entry;

  constructor(limit: number) {
    this.limit = limit;
    this.size = 0;
    this.keymap = {};
  }

  /**
   * Put <value> into the cache associated with <key>. Returns the entry which was
   * removed to make room for the new entry. Otherwise undefined is returned
   * (i.e. if there was enough room already).
   */
  put(key: string, value: any) {
    var entry: Entry = { key, value };
    // Note: No protection agains replacing, and thus orphan entries. By design.
    this.keymap[key] = entry;
    if (this.tail) {
      // link previous tail to the new tail (entry)
      this.tail.newer = entry;
      entry.older = this.tail;
    } else {
      // we're first in -- yay
      this.head = entry;
    }
    // add new entry to the end of the linked list -- it's now the freshest entry.
    this.tail = entry;
    if (this.size === this.limit) {
      // we hit the limit -- remove the head
      return this.shift();
    } else {
      // increase the size counter
      this.size++;
    }
  }

  /**
   * Purge the least recently used (oldest) entry from the cache. Returns the
   * removed entry or undefined if the cache was empty.
   *
   * If you need to perform any form of finalization of purged items, this is a
   * good place to do it. Simply override/replace this function:
   *
   *   var c = new LRUCache(123);
   *   c.shift = function() {
   *     var entry = LRUCache.prototype.shift.call(this);
   *     doSomethingWith(entry);
   *     return entry;
   *   }
   */
  shift() {
    // todo: handle special case when limit == 1
    var entry = this.head;
    if (entry) {
      if (this.head && this.head.newer) {
        this.head = this.head.newer;
        this.head.older = undefined;
      } else {
        this.head = undefined;
      }
      // Remove last strong reference to <entry> and remove links from the purged
      // entry being returned:
      entry.newer = entry.older = undefined;
      // delete is slow, but we need to do this to avoid uncontrollable growth:
      delete this.keymap[entry.key];
    }
    return entry;
  }

  /**
   * Get and register recent use of <key>. Returns the value associated with <key>
   * or undefined if not in cache.
   */
  get(key: string, returnEntry: boolean): any {
    // First, find our cache entry
    var entry = this.keymap[key];
    if (entry === undefined) return; // Not cached. Sorry.
    // As <key> was found in the cache, register it as being requested recently
    if (entry === this.tail) {
      // Already the most recently used entry, so no need to update the list
      return returnEntry ? entry : entry.value;
    }
    // HEAD--------------TAIL
    //   <.older   .newer>
    //  <--- add direction --
    //   A  B  C  <D>  E
    if (entry.newer) {
      if (entry === this.head)
        this.head = entry.newer;
      entry.newer.older = entry.older; // C <-- E.
    }
    if (entry.older)
      entry.older.newer = entry.newer; // C. --> E
    entry.newer = undefined; // D --x
    entry.older = this.tail; // D. --> E
    if (this.tail)
      this.tail.newer = entry; // E. <-- D
    this.tail = entry;
    return returnEntry ? entry : entry.value;
  }

  // ----------------------------------------------------------------------------
  // Following code is optional and can be removed without breaking the core
  // functionality.

  /**
   * Check if <key> is in the cache without registering recent use. Feasible if
   * you do not want to chage the state of the cache, but only "peek" at it.
   * Returns the entry associated with <key> if found, or undefined if not found.
   */
  find(key: string) {
    return this.keymap[key];
  }

  /**
   * Update the value of entry with <key>. Returns the old value, or undefined if
   * entry was not in the cache.
   */
  set(key: string, value: any) {
    var oldvalue: any;
    var entry = this.get(key, true);
    if (entry) {
      oldvalue = entry.value;
      entry.value = value;
    } else {
      oldvalue = this.put(key, value);
      if (oldvalue) oldvalue = oldvalue.value;
    }
    return oldvalue;
  }

  /**
   * Remove entry <key> from cache and return its value. Returns undefined if not
   * found.
   */
  remove(key: string) {
    var entry = this.keymap[key];
    if (!entry) return;
    delete this.keymap[entry.key]; // need to do delete unfortunately
    if (entry.newer && entry.older) {
      // relink the older entry with the newer entry
      entry.older.newer = entry.newer;
      entry.newer.older = entry.older;
    } else if (entry.newer) {
      // remove the link to us
      entry.newer.older = undefined;
      // link the newer entry to head
      this.head = entry.newer;
    } else if (entry.older) {
      // remove the link to us
      entry.older.newer = undefined;
      // link the newer entry to head
      this.tail = entry.older;
    } else {// if(entry.older === undefined && entry.newer === undefined) {
      this.head = this.tail = undefined;
    }

    this.size--;
    return entry.value;
  }

  /** Removes all entries */
  removeAll() {
    this.head = this.tail = undefined;
    this.size = 0;
    this.keymap = {};
  }

  /**
   * Return an array containing all keys of entries stored in the cache object, in
   * arbitrary order.
   */
  keys() {
    return Object.keys(this.keymap);
  }

  /**
   * Call `fun` for each entry. Starting with the newest entry if `desc` is a true
   * value, otherwise starts with the oldest (head) enrty and moves towards the
   * tail.
   *
   * `fun` is called with 3 arguments in the context `context`:
   *   `fun.call(context, Object key, Object value, LRUCache self)`
   */
  forEach(fun: Function, context: any, desc: boolean) {
    var entry: Entry | undefined;
    if (context === true) { desc = true; context = undefined; }
    else if (typeof context !== 'object') context = this;
    if (desc) {
      entry = this.tail;
      while (entry) {
        fun.call(context, entry.key, entry.value, this);
        entry = entry.older;
      }
    } else {
      entry = this.head;
      while (entry) {
        fun.call(context, entry.key, entry.value, this);
        entry = entry.newer;
      }
    }
  }

  /** Returns a String representation */
  toString() {
    var s = '', entry = this.head;
    while (entry) {
      s += String(entry.key) + ':' + entry.value;
      entry = entry.newer;
      if (entry)
        s += ' < ';
    }
    return s;
  }
}
