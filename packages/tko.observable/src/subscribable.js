/* eslint no-cond-assign: 0 */
import {
    setPrototypeOfOrExtend, arrayRemoveItem, objectForEach,
    canSetPrototype, setPrototypeOf, options
} from 'tko.utils'

import { applyExtenders } from './extenders.js'
import * as dependencyDetection from './dependencyDetection.js'

export function subscription (target, callback, disposeCallback) {
  this._target = target
  this.callback = callback
  this.disposeCallback = disposeCallback
  this.isDisposed = false
}

subscription.prototype.dispose = function () {
  this.isDisposed = true
  this.disposeCallback()
}

export function subscribable () {
  setPrototypeOfOrExtend(this, ko_subscribable_fn)
  ko_subscribable_fn.init(this)
}

export var defaultEvent = 'change'

var ko_subscribable_fn = {
  init (instance) {
    instance._subscriptions = {}
    instance._versionNumber = 1
  },

  subscribe (callback, callbackTarget, event) {
    var self = this

    event = event || defaultEvent
    var boundCallback = callbackTarget ? callback.bind(callbackTarget) : callback

    var subscriptionInstance = new subscription(self, boundCallback, function () {
      arrayRemoveItem(self._subscriptions[event], subscriptionInstance)
      if (self.afterSubscriptionRemove) {
        self.afterSubscriptionRemove(event)
      }
    })

    if (self.beforeSubscriptionAdd) {
      self.beforeSubscriptionAdd(event)
    }

    if (!self._subscriptions[event]) {
      self._subscriptions[event] = []
    }
    self._subscriptions[event].push(subscriptionInstance)

    return subscriptionInstance
  },

  notifySubscribers (valueToNotify, event) {
    event = event || defaultEvent
    if (event === defaultEvent) {
      this.updateVersion()
    }
    if (this.hasSubscriptionsForEvent(event)) {
      try {
        dependencyDetection.begin() // Begin suppressing dependency detection (by setting the top frame to undefined)
        for (var a = this._subscriptions[event].slice(0), i = 0, subscriptionInstance; subscriptionInstance = a[i]; ++i) {
                    // In case a subscription was disposed during the arrayForEach cycle, check
                    // for isDisposed on each subscription before invoking its callback
          if (!subscriptionInstance.isDisposed) {
            subscriptionInstance.callback(valueToNotify)
          }
        }
      } finally {
        dependencyDetection.end() // End suppressing dependency detection
      }
    }
  },

  getVersion () {
    return this._versionNumber
  },

  hasChanged (versionToCheck) {
    return this.getVersion() !== versionToCheck
  },

  updateVersion () {
    ++this._versionNumber
  },

  hasSubscriptionsForEvent (event) {
    return this._subscriptions[event] && this._subscriptions[event].length
  },

  getSubscriptionsCount (event) {
    if (event) {
      return this._subscriptions[event] && this._subscriptions[event].length || 0
    } else {
      var total = 0
      objectForEach(this._subscriptions, function (eventName, subscriptions) {
        if (eventName !== 'dirty') {
          total += subscriptions.length
        }
      })
      return total
    }
  },

  isDifferent (oldValue, newValue) {
    return !this.equalityComparer ||
               !this.equalityComparer(oldValue, newValue)
  },

  once (cb) {
    const subs = this.subscribe((nv) => {
      subs.dispose()
      cb(nv)
    })
  },

  when (test, returnValue) {
    const current = this.peek()
    const givenRv = arguments.length > 1
    const testFn = typeof test === 'function' ? test : v => v === test
    if (testFn(current)) {
      return options.Promise.resolve(givenRv ? returnValue : current)
    }
    return new options.Promise((resolve, reject) => {
      const subs = this.subscribe(newValue => {
        if (testFn(newValue)) {
          subs.dispose()
          resolve(givenRv ? returnValue : newValue)
        }
      })
    })
  },

  yet (test, ...args) {
    const testFn = typeof test === 'function' ? test : v => v === test
    const negated = v => !testFn(v)
    return this.when(negated, ...args)
  },

  next () { return new Promise(resolve => this.once(resolve)) },

  extend: applyExtenders
}

// For browsers that support proto assignment, we overwrite the prototype of each
// observable instance. Since observables are functions, we need Function.prototype
// to still be in the prototype chain.
if (canSetPrototype) {
  setPrototypeOf(ko_subscribable_fn, Function.prototype)
}

subscribable.fn = ko_subscribable_fn

export function isSubscribable (instance) {
  return instance != null && typeof instance.subscribe === 'function' && typeof instance.notifySubscribers === 'function'
}
