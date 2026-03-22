"use strict";
exports.id = 816;
exports.ids = [816];
exports.modules = {

/***/ 50585:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const HttpAgent = __webpack_require__(80092);
module.exports = HttpAgent;
module.exports.HttpAgent = HttpAgent;
module.exports.HttpsAgent = __webpack_require__(36086);
module.exports.constants = __webpack_require__(98664);


/***/ }),

/***/ 80092:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const OriginalAgent = (__webpack_require__(58611).Agent);
const ms = __webpack_require__(49897);
const debug = (__webpack_require__(39023).debuglog)('agentkeepalive');
const {
  INIT_SOCKET,
  CURRENT_ID,
  CREATE_ID,
  SOCKET_CREATED_TIME,
  SOCKET_NAME,
  SOCKET_REQUEST_COUNT,
  SOCKET_REQUEST_FINISHED_COUNT,
} = __webpack_require__(98664);

// OriginalAgent come from
// - https://github.com/nodejs/node/blob/v8.12.0/lib/_http_agent.js
// - https://github.com/nodejs/node/blob/v10.12.0/lib/_http_agent.js

// node <= 10
let defaultTimeoutListenerCount = 1;
const majorVersion = parseInt(process.version.split('.', 1)[0].substring(1));
if (majorVersion >= 11 && majorVersion <= 12) {
  defaultTimeoutListenerCount = 2;
} else if (majorVersion >= 13) {
  defaultTimeoutListenerCount = 3;
}

function deprecate(message) {
  console.log('[agentkeepalive:deprecated] %s', message);
}

class Agent extends OriginalAgent {
  constructor(options) {
    options = options || {};
    options.keepAlive = options.keepAlive !== false;
    // default is keep-alive and 4s free socket timeout
    // see https://medium.com/ssense-tech/reduce-networking-errors-in-nodejs-23b4eb9f2d83
    if (options.freeSocketTimeout === undefined) {
      options.freeSocketTimeout = 4000;
    }
    // Legacy API: keepAliveTimeout should be rename to `freeSocketTimeout`
    if (options.keepAliveTimeout) {
      deprecate('options.keepAliveTimeout is deprecated, please use options.freeSocketTimeout instead');
      options.freeSocketTimeout = options.keepAliveTimeout;
      delete options.keepAliveTimeout;
    }
    // Legacy API: freeSocketKeepAliveTimeout should be rename to `freeSocketTimeout`
    if (options.freeSocketKeepAliveTimeout) {
      deprecate('options.freeSocketKeepAliveTimeout is deprecated, please use options.freeSocketTimeout instead');
      options.freeSocketTimeout = options.freeSocketKeepAliveTimeout;
      delete options.freeSocketKeepAliveTimeout;
    }

    // Sets the socket to timeout after timeout milliseconds of inactivity on the socket.
    // By default is double free socket timeout.
    if (options.timeout === undefined) {
      // make sure socket default inactivity timeout >= 8s
      options.timeout = Math.max(options.freeSocketTimeout * 2, 8000);
    }

    // support humanize format
    options.timeout = ms(options.timeout);
    options.freeSocketTimeout = ms(options.freeSocketTimeout);
    options.socketActiveTTL = options.socketActiveTTL ? ms(options.socketActiveTTL) : 0;

    super(options);

    this[CURRENT_ID] = 0;

    // create socket success counter
    this.createSocketCount = 0;
    this.createSocketCountLastCheck = 0;

    this.createSocketErrorCount = 0;
    this.createSocketErrorCountLastCheck = 0;

    this.closeSocketCount = 0;
    this.closeSocketCountLastCheck = 0;

    // socket error event count
    this.errorSocketCount = 0;
    this.errorSocketCountLastCheck = 0;

    // request finished counter
    this.requestCount = 0;
    this.requestCountLastCheck = 0;

    // including free socket timeout counter
    this.timeoutSocketCount = 0;
    this.timeoutSocketCountLastCheck = 0;

    this.on('free', socket => {
      // https://github.com/nodejs/node/pull/32000
      // Node.js native agent will check socket timeout eqs agent.options.timeout.
      // Use the ttl or freeSocketTimeout to overwrite.
      const timeout = this.calcSocketTimeout(socket);
      if (timeout > 0 && socket.timeout !== timeout) {
        socket.setTimeout(timeout);
      }
    });
  }

  get freeSocketKeepAliveTimeout() {
    deprecate('agent.freeSocketKeepAliveTimeout is deprecated, please use agent.options.freeSocketTimeout instead');
    return this.options.freeSocketTimeout;
  }

  get timeout() {
    deprecate('agent.timeout is deprecated, please use agent.options.timeout instead');
    return this.options.timeout;
  }

  get socketActiveTTL() {
    deprecate('agent.socketActiveTTL is deprecated, please use agent.options.socketActiveTTL instead');
    return this.options.socketActiveTTL;
  }

  calcSocketTimeout(socket) {
    /**
     * return <= 0: should free socket
     * return > 0: should update socket timeout
     * return undefined: not find custom timeout
     */
    let freeSocketTimeout = this.options.freeSocketTimeout;
    const socketActiveTTL = this.options.socketActiveTTL;
    if (socketActiveTTL) {
      // check socketActiveTTL
      const aliveTime = Date.now() - socket[SOCKET_CREATED_TIME];
      const diff = socketActiveTTL - aliveTime;
      if (diff <= 0) {
        return diff;
      }
      if (freeSocketTimeout && diff < freeSocketTimeout) {
        freeSocketTimeout = diff;
      }
    }
    // set freeSocketTimeout
    if (freeSocketTimeout) {
      // set free keepalive timer
      // try to use socket custom freeSocketTimeout first, support headers['keep-alive']
      // https://github.com/node-modules/urllib/blob/b76053020923f4d99a1c93cf2e16e0c5ba10bacf/lib/urllib.js#L498
      const customFreeSocketTimeout = socket.freeSocketTimeout || socket.freeSocketKeepAliveTimeout;
      return customFreeSocketTimeout || freeSocketTimeout;
    }
  }

  keepSocketAlive(socket) {
    const result = super.keepSocketAlive(socket);
    // should not keepAlive, do nothing
    if (!result) return result;

    const customTimeout = this.calcSocketTimeout(socket);
    if (typeof customTimeout === 'undefined') {
      return true;
    }
    if (customTimeout <= 0) {
      debug('%s(requests: %s, finished: %s) free but need to destroy by TTL, request count %s, diff is %s',
        socket[SOCKET_NAME], socket[SOCKET_REQUEST_COUNT], socket[SOCKET_REQUEST_FINISHED_COUNT], customTimeout);
      return false;
    }
    if (socket.timeout !== customTimeout) {
      socket.setTimeout(customTimeout);
    }
    return true;
  }

  // only call on addRequest
  reuseSocket(...args) {
    // reuseSocket(socket, req)
    super.reuseSocket(...args);
    const socket = args[0];
    const req = args[1];
    req.reusedSocket = true;
    const agentTimeout = this.options.timeout;
    if (getSocketTimeout(socket) !== agentTimeout) {
      // reset timeout before use
      socket.setTimeout(agentTimeout);
      debug('%s reset timeout to %sms', socket[SOCKET_NAME], agentTimeout);
    }
    socket[SOCKET_REQUEST_COUNT]++;
    debug('%s(requests: %s, finished: %s) reuse on addRequest, timeout %sms',
      socket[SOCKET_NAME], socket[SOCKET_REQUEST_COUNT], socket[SOCKET_REQUEST_FINISHED_COUNT],
      getSocketTimeout(socket));
  }

  [CREATE_ID]() {
    const id = this[CURRENT_ID]++;
    if (this[CURRENT_ID] === Number.MAX_SAFE_INTEGER) this[CURRENT_ID] = 0;
    return id;
  }

  [INIT_SOCKET](socket, options) {
    // bugfix here.
    // https on node 8, 10 won't set agent.options.timeout by default
    // TODO: need to fix on node itself
    if (options.timeout) {
      const timeout = getSocketTimeout(socket);
      if (!timeout) {
        socket.setTimeout(options.timeout);
      }
    }

    if (this.options.keepAlive) {
      // Disable Nagle's algorithm: http://blog.caustik.com/2012/04/08/scaling-node-js-to-100k-concurrent-connections/
      // https://fengmk2.com/benchmark/nagle-algorithm-delayed-ack-mock.html
      socket.setNoDelay(true);
    }
    this.createSocketCount++;
    if (this.options.socketActiveTTL) {
      socket[SOCKET_CREATED_TIME] = Date.now();
    }
    // don't show the hole '-----BEGIN CERTIFICATE----' key string
    socket[SOCKET_NAME] = `sock[${this[CREATE_ID]()}#${options._agentKey}]`.split('-----BEGIN', 1)[0];
    socket[SOCKET_REQUEST_COUNT] = 1;
    socket[SOCKET_REQUEST_FINISHED_COUNT] = 0;
    installListeners(this, socket, options);
  }

  createConnection(options, oncreate) {
    let called = false;
    const onNewCreate = (err, socket) => {
      if (called) return;
      called = true;

      if (err) {
        this.createSocketErrorCount++;
        return oncreate(err);
      }
      this[INIT_SOCKET](socket, options);
      oncreate(err, socket);
    };

    const newSocket = super.createConnection(options, onNewCreate);
    if (newSocket) onNewCreate(null, newSocket);
    return newSocket;
  }

  get statusChanged() {
    const changed = this.createSocketCount !== this.createSocketCountLastCheck ||
      this.createSocketErrorCount !== this.createSocketErrorCountLastCheck ||
      this.closeSocketCount !== this.closeSocketCountLastCheck ||
      this.errorSocketCount !== this.errorSocketCountLastCheck ||
      this.timeoutSocketCount !== this.timeoutSocketCountLastCheck ||
      this.requestCount !== this.requestCountLastCheck;
    if (changed) {
      this.createSocketCountLastCheck = this.createSocketCount;
      this.createSocketErrorCountLastCheck = this.createSocketErrorCount;
      this.closeSocketCountLastCheck = this.closeSocketCount;
      this.errorSocketCountLastCheck = this.errorSocketCount;
      this.timeoutSocketCountLastCheck = this.timeoutSocketCount;
      this.requestCountLastCheck = this.requestCount;
    }
    return changed;
  }

  getCurrentStatus() {
    return {
      createSocketCount: this.createSocketCount,
      createSocketErrorCount: this.createSocketErrorCount,
      closeSocketCount: this.closeSocketCount,
      errorSocketCount: this.errorSocketCount,
      timeoutSocketCount: this.timeoutSocketCount,
      requestCount: this.requestCount,
      freeSockets: inspect(this.freeSockets),
      sockets: inspect(this.sockets),
      requests: inspect(this.requests),
    };
  }
}

// node 8 don't has timeout attribute on socket
// https://github.com/nodejs/node/pull/21204/files#diff-e6ef024c3775d787c38487a6309e491dR408
function getSocketTimeout(socket) {
  return socket.timeout || socket._idleTimeout;
}

function installListeners(agent, socket, options) {
  debug('%s create, timeout %sms', socket[SOCKET_NAME], getSocketTimeout(socket));

  // listener socket events: close, timeout, error, free
  function onFree() {
    // create and socket.emit('free') logic
    // https://github.com/nodejs/node/blob/master/lib/_http_agent.js#L311
    // no req on the socket, it should be the new socket
    if (!socket._httpMessage && socket[SOCKET_REQUEST_COUNT] === 1) return;

    socket[SOCKET_REQUEST_FINISHED_COUNT]++;
    agent.requestCount++;
    debug('%s(requests: %s, finished: %s) free',
      socket[SOCKET_NAME], socket[SOCKET_REQUEST_COUNT], socket[SOCKET_REQUEST_FINISHED_COUNT]);

    // should reuse on pedding requests?
    const name = agent.getName(options);
    if (socket.writable && agent.requests[name] && agent.requests[name].length) {
      // will be reuse on agent free listener
      socket[SOCKET_REQUEST_COUNT]++;
      debug('%s(requests: %s, finished: %s) will be reuse on agent free event',
        socket[SOCKET_NAME], socket[SOCKET_REQUEST_COUNT], socket[SOCKET_REQUEST_FINISHED_COUNT]);
    }
  }
  socket.on('free', onFree);

  function onClose(isError) {
    debug('%s(requests: %s, finished: %s) close, isError: %s',
      socket[SOCKET_NAME], socket[SOCKET_REQUEST_COUNT], socket[SOCKET_REQUEST_FINISHED_COUNT], isError);
    agent.closeSocketCount++;
  }
  socket.on('close', onClose);

  // start socket timeout handler
  function onTimeout() {
    // onTimeout and emitRequestTimeout(_http_client.js)
    // https://github.com/nodejs/node/blob/v12.x/lib/_http_client.js#L711
    const listenerCount = socket.listeners('timeout').length;
    // node <= 10, default listenerCount is 1, onTimeout
    // 11 < node <= 12, default listenerCount is 2, onTimeout and emitRequestTimeout
    // node >= 13, default listenerCount is 3, onTimeout,
    //   onTimeout(https://github.com/nodejs/node/pull/32000/files#diff-5f7fb0850412c6be189faeddea6c5359R333)
    //   and emitRequestTimeout
    const timeout = getSocketTimeout(socket);
    const req = socket._httpMessage;
    const reqTimeoutListenerCount = req && req.listeners('timeout').length || 0;
    debug('%s(requests: %s, finished: %s) timeout after %sms, listeners %s, defaultTimeoutListenerCount %s, hasHttpRequest %s, HttpRequest timeoutListenerCount %s',
      socket[SOCKET_NAME], socket[SOCKET_REQUEST_COUNT], socket[SOCKET_REQUEST_FINISHED_COUNT],
      timeout, listenerCount, defaultTimeoutListenerCount, !!req, reqTimeoutListenerCount);
    if (debug.enabled) {
      debug('timeout listeners: %s', socket.listeners('timeout').map(f => f.name).join(', '));
    }
    agent.timeoutSocketCount++;
    const name = agent.getName(options);
    if (agent.freeSockets[name] && agent.freeSockets[name].indexOf(socket) !== -1) {
      // free socket timeout, destroy quietly
      socket.destroy();
      // Remove it from freeSockets list immediately to prevent new requests
      // from being sent through this socket.
      agent.removeSocket(socket, options);
      debug('%s is free, destroy quietly', socket[SOCKET_NAME]);
    } else {
      // if there is no any request socket timeout handler,
      // agent need to handle socket timeout itself.
      //
      // custom request socket timeout handle logic must follow these rules:
      //  1. Destroy socket first
      //  2. Must emit socket 'agentRemove' event tell agent remove socket
      //     from freeSockets list immediately.
      //     Otherise you may be get 'socket hang up' error when reuse
      //     free socket and timeout happen in the same time.
      if (reqTimeoutListenerCount === 0) {
        const error = new Error('Socket timeout');
        error.code = 'ERR_SOCKET_TIMEOUT';
        error.timeout = timeout;
        // must manually call socket.end() or socket.destroy() to end the connection.
        // https://nodejs.org/dist/latest-v10.x/docs/api/net.html#net_socket_settimeout_timeout_callback
        socket.destroy(error);
        agent.removeSocket(socket, options);
        debug('%s destroy with timeout error', socket[SOCKET_NAME]);
      }
    }
  }
  socket.on('timeout', onTimeout);

  function onError(err) {
    const listenerCount = socket.listeners('error').length;
    debug('%s(requests: %s, finished: %s) error: %s, listenerCount: %s',
      socket[SOCKET_NAME], socket[SOCKET_REQUEST_COUNT], socket[SOCKET_REQUEST_FINISHED_COUNT],
      err, listenerCount);
    agent.errorSocketCount++;
    if (listenerCount === 1) {
      // if socket don't contain error event handler, don't catch it, emit it again
      debug('%s emit uncaught error event', socket[SOCKET_NAME]);
      socket.removeListener('error', onError);
      socket.emit('error', err);
    }
  }
  socket.on('error', onError);

  function onRemove() {
    debug('%s(requests: %s, finished: %s) agentRemove',
      socket[SOCKET_NAME],
      socket[SOCKET_REQUEST_COUNT], socket[SOCKET_REQUEST_FINISHED_COUNT]);
    // We need this function for cases like HTTP 'upgrade'
    // (defined by WebSockets) where we need to remove a socket from the
    // pool because it'll be locked up indefinitely
    socket.removeListener('close', onClose);
    socket.removeListener('error', onError);
    socket.removeListener('free', onFree);
    socket.removeListener('timeout', onTimeout);
    socket.removeListener('agentRemove', onRemove);
  }
  socket.on('agentRemove', onRemove);
}

module.exports = Agent;

function inspect(obj) {
  const res = {};
  for (const key in obj) {
    res[key] = obj[key].length;
  }
  return res;
}


/***/ }),

/***/ 98664:
/***/ ((module) => {



module.exports = {
  // agent
  CURRENT_ID: Symbol('agentkeepalive#currentId'),
  CREATE_ID: Symbol('agentkeepalive#createId'),
  INIT_SOCKET: Symbol('agentkeepalive#initSocket'),
  CREATE_HTTPS_CONNECTION: Symbol('agentkeepalive#createHttpsConnection'),
  // socket
  SOCKET_CREATED_TIME: Symbol('agentkeepalive#socketCreatedTime'),
  SOCKET_NAME: Symbol('agentkeepalive#socketName'),
  SOCKET_REQUEST_COUNT: Symbol('agentkeepalive#socketRequestCount'),
  SOCKET_REQUEST_FINISHED_COUNT: Symbol('agentkeepalive#socketRequestFinishedCount'),
};


/***/ }),

/***/ 36086:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const OriginalHttpsAgent = (__webpack_require__(65692).Agent);
const HttpAgent = __webpack_require__(80092);
const {
  INIT_SOCKET,
  CREATE_HTTPS_CONNECTION,
} = __webpack_require__(98664);

class HttpsAgent extends HttpAgent {
  constructor(options) {
    super(options);

    this.defaultPort = 443;
    this.protocol = 'https:';
    this.maxCachedSessions = this.options.maxCachedSessions;
    /* istanbul ignore next */
    if (this.maxCachedSessions === undefined) {
      this.maxCachedSessions = 100;
    }

    this._sessionCache = {
      map: {},
      list: [],
    };
  }

  createConnection(options, oncreate) {
    const socket = this[CREATE_HTTPS_CONNECTION](options, oncreate);
    this[INIT_SOCKET](socket, options);
    return socket;
  }
}

// https://github.com/nodejs/node/blob/master/lib/https.js#L89
HttpsAgent.prototype[CREATE_HTTPS_CONNECTION] = OriginalHttpsAgent.prototype.createConnection;

[
  'getName',
  '_getSession',
  '_cacheSession',
  // https://github.com/nodejs/node/pull/4982
  '_evictSession',
].forEach(function(method) {
  /* istanbul ignore next */
  if (typeof OriginalHttpsAgent.prototype[method] === 'function') {
    HttpsAgent.prototype[method] = OriginalHttpsAgent.prototype[method];
  }
});

module.exports = HttpsAgent;


/***/ }),

/***/ 49897:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*!
 * humanize-ms - index.js
 * Copyright(c) 2014 dead_horse <dead_horse@qq.com>
 * MIT Licensed
 */



/**
 * Module dependencies.
 */

var util = __webpack_require__(39023);
var ms = __webpack_require__(96987);

module.exports = function (t) {
  if (typeof t === 'number') return t;
  var r = ms(t);
  if (r === undefined) {
    var err = new Error(util.format('humanize-ms(%j) result undefined', t));
    console.warn(err.stack);
  }
  return r;
};


/***/ }),

/***/ 32287:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  Vi: () => (/* reexport */ FormDataEncoder)
});

// UNUSED EXPORTS: Encoder, isFileLike, isFormData, isFormDataLike

;// CONCATENATED MODULE: ../../node_modules/.pnpm/form-data-encoder@1.7.2/node_modules/form-data-encoder/lib/esm/util/createBoundary.js
const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
function createBoundary() {
    let size = 16;
    let res = "";
    while (size--) {
        res += alphabet[(Math.random() * alphabet.length) << 0];
    }
    return res;
}
/* harmony default export */ const util_createBoundary = (createBoundary);

;// CONCATENATED MODULE: ../../node_modules/.pnpm/form-data-encoder@1.7.2/node_modules/form-data-encoder/lib/esm/util/isPlainObject.js
const getType = (value) => (Object.prototype.toString.call(value).slice(8, -1).toLowerCase());
function isPlainObject(value) {
    if (getType(value) !== "object") {
        return false;
    }
    const pp = Object.getPrototypeOf(value);
    if (pp === null || pp === undefined) {
        return true;
    }
    const Ctor = pp.constructor && pp.constructor.toString();
    return Ctor === Object.toString();
}
/* harmony default export */ const util_isPlainObject = (isPlainObject);

;// CONCATENATED MODULE: ../../node_modules/.pnpm/form-data-encoder@1.7.2/node_modules/form-data-encoder/lib/esm/util/normalizeValue.js
const normalizeValue = (value) => String(value)
    .replace(/\r|\n/g, (match, i, str) => {
    if ((match === "\r" && str[i + 1] !== "\n")
        || (match === "\n" && str[i - 1] !== "\r")) {
        return "\r\n";
    }
    return match;
});
/* harmony default export */ const util_normalizeValue = (normalizeValue);

;// CONCATENATED MODULE: ../../node_modules/.pnpm/form-data-encoder@1.7.2/node_modules/form-data-encoder/lib/esm/util/escapeName.js
const escapeName = (name) => String(name)
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A")
    .replace(/"/g, "%22");
/* harmony default export */ const util_escapeName = (escapeName);

;// CONCATENATED MODULE: ../../node_modules/.pnpm/form-data-encoder@1.7.2/node_modules/form-data-encoder/lib/esm/util/isFunction.js
const isFunction = (value) => (typeof value === "function");
/* harmony default export */ const util_isFunction = (isFunction);

;// CONCATENATED MODULE: ../../node_modules/.pnpm/form-data-encoder@1.7.2/node_modules/form-data-encoder/lib/esm/util/isFileLike.js

const isFileLike = (value) => Boolean(value
    && typeof value === "object"
    && util_isFunction(value.constructor)
    && value[Symbol.toStringTag] === "File"
    && util_isFunction(value.stream)
    && value.name != null
    && value.size != null
    && value.lastModified != null);

;// CONCATENATED MODULE: ../../node_modules/.pnpm/form-data-encoder@1.7.2/node_modules/form-data-encoder/lib/esm/util/isFormData.js

const isFormData = (value) => Boolean(value
    && util_isFunction(value.constructor)
    && value[Symbol.toStringTag] === "FormData"
    && util_isFunction(value.append)
    && util_isFunction(value.getAll)
    && util_isFunction(value.entries)
    && util_isFunction(value[Symbol.iterator]));
const isFormDataLike = (/* unused pure expression or super */ null && (isFormData));

;// CONCATENATED MODULE: ../../node_modules/.pnpm/form-data-encoder@1.7.2/node_modules/form-data-encoder/lib/esm/FormDataEncoder.js
var __classPrivateFieldSet = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _FormDataEncoder_instances, _FormDataEncoder_CRLF, _FormDataEncoder_CRLF_BYTES, _FormDataEncoder_CRLF_BYTES_LENGTH, _FormDataEncoder_DASHES, _FormDataEncoder_encoder, _FormDataEncoder_footer, _FormDataEncoder_form, _FormDataEncoder_options, _FormDataEncoder_getFieldHeader;






const defaultOptions = {
    enableAdditionalHeaders: false
};
class FormDataEncoder {
    constructor(form, boundaryOrOptions, options) {
        _FormDataEncoder_instances.add(this);
        _FormDataEncoder_CRLF.set(this, "\r\n");
        _FormDataEncoder_CRLF_BYTES.set(this, void 0);
        _FormDataEncoder_CRLF_BYTES_LENGTH.set(this, void 0);
        _FormDataEncoder_DASHES.set(this, "-".repeat(2));
        _FormDataEncoder_encoder.set(this, new TextEncoder());
        _FormDataEncoder_footer.set(this, void 0);
        _FormDataEncoder_form.set(this, void 0);
        _FormDataEncoder_options.set(this, void 0);
        if (!isFormData(form)) {
            throw new TypeError("Expected first argument to be a FormData instance.");
        }
        let boundary;
        if (util_isPlainObject(boundaryOrOptions)) {
            options = boundaryOrOptions;
        }
        else {
            boundary = boundaryOrOptions;
        }
        if (!boundary) {
            boundary = util_createBoundary();
        }
        if (typeof boundary !== "string") {
            throw new TypeError("Expected boundary argument to be a string.");
        }
        if (options && !util_isPlainObject(options)) {
            throw new TypeError("Expected options argument to be an object.");
        }
        __classPrivateFieldSet(this, _FormDataEncoder_form, form, "f");
        __classPrivateFieldSet(this, _FormDataEncoder_options, { ...defaultOptions, ...options }, "f");
        __classPrivateFieldSet(this, _FormDataEncoder_CRLF_BYTES, __classPrivateFieldGet(this, _FormDataEncoder_encoder, "f").encode(__classPrivateFieldGet(this, _FormDataEncoder_CRLF, "f")), "f");
        __classPrivateFieldSet(this, _FormDataEncoder_CRLF_BYTES_LENGTH, __classPrivateFieldGet(this, _FormDataEncoder_CRLF_BYTES, "f").byteLength, "f");
        this.boundary = `form-data-boundary-${boundary}`;
        this.contentType = `multipart/form-data; boundary=${this.boundary}`;
        __classPrivateFieldSet(this, _FormDataEncoder_footer, __classPrivateFieldGet(this, _FormDataEncoder_encoder, "f").encode(`${__classPrivateFieldGet(this, _FormDataEncoder_DASHES, "f")}${this.boundary}${__classPrivateFieldGet(this, _FormDataEncoder_DASHES, "f")}${__classPrivateFieldGet(this, _FormDataEncoder_CRLF, "f").repeat(2)}`), "f");
        this.contentLength = String(this.getContentLength());
        this.headers = Object.freeze({
            "Content-Type": this.contentType,
            "Content-Length": this.contentLength
        });
        Object.defineProperties(this, {
            boundary: { writable: false, configurable: false },
            contentType: { writable: false, configurable: false },
            contentLength: { writable: false, configurable: false },
            headers: { writable: false, configurable: false }
        });
    }
    getContentLength() {
        let length = 0;
        for (const [name, raw] of __classPrivateFieldGet(this, _FormDataEncoder_form, "f")) {
            const value = isFileLike(raw) ? raw : __classPrivateFieldGet(this, _FormDataEncoder_encoder, "f").encode(util_normalizeValue(raw));
            length += __classPrivateFieldGet(this, _FormDataEncoder_instances, "m", _FormDataEncoder_getFieldHeader).call(this, name, value).byteLength;
            length += isFileLike(value) ? value.size : value.byteLength;
            length += __classPrivateFieldGet(this, _FormDataEncoder_CRLF_BYTES_LENGTH, "f");
        }
        return length + __classPrivateFieldGet(this, _FormDataEncoder_footer, "f").byteLength;
    }
    *values() {
        for (const [name, raw] of __classPrivateFieldGet(this, _FormDataEncoder_form, "f").entries()) {
            const value = isFileLike(raw) ? raw : __classPrivateFieldGet(this, _FormDataEncoder_encoder, "f").encode(util_normalizeValue(raw));
            yield __classPrivateFieldGet(this, _FormDataEncoder_instances, "m", _FormDataEncoder_getFieldHeader).call(this, name, value);
            yield value;
            yield __classPrivateFieldGet(this, _FormDataEncoder_CRLF_BYTES, "f");
        }
        yield __classPrivateFieldGet(this, _FormDataEncoder_footer, "f");
    }
    async *encode() {
        for (const part of this.values()) {
            if (isFileLike(part)) {
                yield* part.stream();
            }
            else {
                yield part;
            }
        }
    }
    [(_FormDataEncoder_CRLF = new WeakMap(), _FormDataEncoder_CRLF_BYTES = new WeakMap(), _FormDataEncoder_CRLF_BYTES_LENGTH = new WeakMap(), _FormDataEncoder_DASHES = new WeakMap(), _FormDataEncoder_encoder = new WeakMap(), _FormDataEncoder_footer = new WeakMap(), _FormDataEncoder_form = new WeakMap(), _FormDataEncoder_options = new WeakMap(), _FormDataEncoder_instances = new WeakSet(), _FormDataEncoder_getFieldHeader = function _FormDataEncoder_getFieldHeader(name, value) {
        let header = "";
        header += `${__classPrivateFieldGet(this, _FormDataEncoder_DASHES, "f")}${this.boundary}${__classPrivateFieldGet(this, _FormDataEncoder_CRLF, "f")}`;
        header += `Content-Disposition: form-data; name="${util_escapeName(name)}"`;
        if (isFileLike(value)) {
            header += `; filename="${util_escapeName(value.name)}"${__classPrivateFieldGet(this, _FormDataEncoder_CRLF, "f")}`;
            header += `Content-Type: ${value.type || "application/octet-stream"}`;
        }
        if (__classPrivateFieldGet(this, _FormDataEncoder_options, "f").enableAdditionalHeaders === true) {
            header += `${__classPrivateFieldGet(this, _FormDataEncoder_CRLF, "f")}Content-Length: ${isFileLike(value) ? value.size : value.byteLength}`;
        }
        return __classPrivateFieldGet(this, _FormDataEncoder_encoder, "f").encode(`${header}${__classPrivateFieldGet(this, _FormDataEncoder_CRLF, "f").repeat(2)}`);
    }, Symbol.iterator)]() {
        return this.values();
    }
    [Symbol.asyncIterator]() {
        return this.encode();
    }
}
const Encoder = (/* unused pure expression or super */ null && (FormDataEncoder));

;// CONCATENATED MODULE: ../../node_modules/.pnpm/form-data-encoder@1.7.2/node_modules/form-data-encoder/lib/esm/index.js







/***/ }),

/***/ 31183:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  Y: () => (/* binding */ Blob)
});

;// CONCATENATED MODULE: ../../node_modules/.pnpm/web-streams-polyfill@4.0.0-beta.3/node_modules/web-streams-polyfill/dist/ponyfill.mjs
/**
 * @license
 * web-streams-polyfill v4.0.0-beta.3
 * Copyright 2021 Mattias Buelens, Diwank Singh Tomer and other contributors.
 * This code is released under the MIT license.
 * SPDX-License-Identifier: MIT
 */
const e="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?Symbol:e=>`Symbol(${e})`;function t(){}function r(e){return"object"==typeof e&&null!==e||"function"==typeof e}const o=t;function n(e,t){try{Object.defineProperty(e,"name",{value:t,configurable:!0})}catch(e){}}const a=Promise,i=Promise.prototype.then,l=Promise.resolve.bind(a),s=Promise.reject.bind(a);function u(e){return new a(e)}function c(e){return l(e)}function d(e){return s(e)}function f(e,t,r){return i.call(e,t,r)}function b(e,t,r){f(f(e,t,r),void 0,o)}function h(e,t){b(e,t)}function _(e,t){b(e,void 0,t)}function p(e,t,r){return f(e,t,r)}function m(e){f(e,void 0,o)}let y=e=>{if("function"==typeof queueMicrotask)y=queueMicrotask;else{const e=c(void 0);y=t=>f(e,t)}return y(e)};function g(e,t,r){if("function"!=typeof e)throw new TypeError("Argument is not a function");return Function.prototype.apply.call(e,t,r)}function w(e,t,r){try{return c(g(e,t,r))}catch(e){return d(e)}}class S{constructor(){this._cursor=0,this._size=0,this._front={_elements:[],_next:void 0},this._back=this._front,this._cursor=0,this._size=0}get length(){return this._size}push(e){const t=this._back;let r=t;16383===t._elements.length&&(r={_elements:[],_next:void 0}),t._elements.push(e),r!==t&&(this._back=r,t._next=r),++this._size}shift(){const e=this._front;let t=e;const r=this._cursor;let o=r+1;const n=e._elements,a=n[r];return 16384===o&&(t=e._next,o=0),--this._size,this._cursor=o,e!==t&&(this._front=t),n[r]=void 0,a}forEach(e){let t=this._cursor,r=this._front,o=r._elements;for(;!(t===o.length&&void 0===r._next||t===o.length&&(r=r._next,o=r._elements,t=0,0===o.length));)e(o[t]),++t}peek(){const e=this._front,t=this._cursor;return e._elements[t]}}const v=e("[[AbortSteps]]"),R=e("[[ErrorSteps]]"),T=e("[[CancelSteps]]"),q=e("[[PullSteps]]"),C=e("[[ReleaseSteps]]");function E(e,t){e._ownerReadableStream=t,t._reader=e,"readable"===t._state?O(e):"closed"===t._state?function(e){O(e),j(e)}(e):B(e,t._storedError)}function P(e,t){return Gt(e._ownerReadableStream,t)}function W(e){const t=e._ownerReadableStream;"readable"===t._state?A(e,new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")):function(e,t){B(e,t)}(e,new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")),t._readableStreamController[C](),t._reader=void 0,e._ownerReadableStream=void 0}function k(e){return new TypeError("Cannot "+e+" a stream using a released reader")}function O(e){e._closedPromise=u(((t,r)=>{e._closedPromise_resolve=t,e._closedPromise_reject=r}))}function B(e,t){O(e),A(e,t)}function A(e,t){void 0!==e._closedPromise_reject&&(m(e._closedPromise),e._closedPromise_reject(t),e._closedPromise_resolve=void 0,e._closedPromise_reject=void 0)}function j(e){void 0!==e._closedPromise_resolve&&(e._closedPromise_resolve(void 0),e._closedPromise_resolve=void 0,e._closedPromise_reject=void 0)}const z=Number.isFinite||function(e){return"number"==typeof e&&isFinite(e)},L=Math.trunc||function(e){return e<0?Math.ceil(e):Math.floor(e)};function F(e,t){if(void 0!==e&&("object"!=typeof(r=e)&&"function"!=typeof r))throw new TypeError(`${t} is not an object.`);var r}function I(e,t){if("function"!=typeof e)throw new TypeError(`${t} is not a function.`)}function D(e,t){if(!function(e){return"object"==typeof e&&null!==e||"function"==typeof e}(e))throw new TypeError(`${t} is not an object.`)}function $(e,t,r){if(void 0===e)throw new TypeError(`Parameter ${t} is required in '${r}'.`)}function M(e,t,r){if(void 0===e)throw new TypeError(`${t} is required in '${r}'.`)}function Y(e){return Number(e)}function Q(e){return 0===e?0:e}function N(e,t){const r=Number.MAX_SAFE_INTEGER;let o=Number(e);if(o=Q(o),!z(o))throw new TypeError(`${t} is not a finite number`);if(o=function(e){return Q(L(e))}(o),o<0||o>r)throw new TypeError(`${t} is outside the accepted range of 0 to ${r}, inclusive`);return z(o)&&0!==o?o:0}function H(e){if(!r(e))return!1;if("function"!=typeof e.getReader)return!1;try{return"boolean"==typeof e.locked}catch(e){return!1}}function x(e){if(!r(e))return!1;if("function"!=typeof e.getWriter)return!1;try{return"boolean"==typeof e.locked}catch(e){return!1}}function V(e,t){if(!Vt(e))throw new TypeError(`${t} is not a ReadableStream.`)}function U(e,t){e._reader._readRequests.push(t)}function G(e,t,r){const o=e._reader._readRequests.shift();r?o._closeSteps():o._chunkSteps(t)}function X(e){return e._reader._readRequests.length}function J(e){const t=e._reader;return void 0!==t&&!!K(t)}class ReadableStreamDefaultReader{constructor(e){if($(e,1,"ReadableStreamDefaultReader"),V(e,"First parameter"),Ut(e))throw new TypeError("This stream has already been locked for exclusive reading by another reader");E(this,e),this._readRequests=new S}get closed(){return K(this)?this._closedPromise:d(ee("closed"))}cancel(e){return K(this)?void 0===this._ownerReadableStream?d(k("cancel")):P(this,e):d(ee("cancel"))}read(){if(!K(this))return d(ee("read"));if(void 0===this._ownerReadableStream)return d(k("read from"));let e,t;const r=u(((r,o)=>{e=r,t=o}));return function(e,t){const r=e._ownerReadableStream;r._disturbed=!0,"closed"===r._state?t._closeSteps():"errored"===r._state?t._errorSteps(r._storedError):r._readableStreamController[q](t)}(this,{_chunkSteps:t=>e({value:t,done:!1}),_closeSteps:()=>e({value:void 0,done:!0}),_errorSteps:e=>t(e)}),r}releaseLock(){if(!K(this))throw ee("releaseLock");void 0!==this._ownerReadableStream&&function(e){W(e);const t=new TypeError("Reader was released");Z(e,t)}(this)}}function K(e){return!!r(e)&&(!!Object.prototype.hasOwnProperty.call(e,"_readRequests")&&e instanceof ReadableStreamDefaultReader)}function Z(e,t){const r=e._readRequests;e._readRequests=new S,r.forEach((e=>{e._errorSteps(t)}))}function ee(e){return new TypeError(`ReadableStreamDefaultReader.prototype.${e} can only be used on a ReadableStreamDefaultReader`)}Object.defineProperties(ReadableStreamDefaultReader.prototype,{cancel:{enumerable:!0},read:{enumerable:!0},releaseLock:{enumerable:!0},closed:{enumerable:!0}}),n(ReadableStreamDefaultReader.prototype.cancel,"cancel"),n(ReadableStreamDefaultReader.prototype.read,"read"),n(ReadableStreamDefaultReader.prototype.releaseLock,"releaseLock"),"symbol"==typeof e.toStringTag&&Object.defineProperty(ReadableStreamDefaultReader.prototype,e.toStringTag,{value:"ReadableStreamDefaultReader",configurable:!0});class te{constructor(e,t){this._ongoingPromise=void 0,this._isFinished=!1,this._reader=e,this._preventCancel=t}next(){const e=()=>this._nextSteps();return this._ongoingPromise=this._ongoingPromise?p(this._ongoingPromise,e,e):e(),this._ongoingPromise}return(e){const t=()=>this._returnSteps(e);return this._ongoingPromise?p(this._ongoingPromise,t,t):t()}_nextSteps(){if(this._isFinished)return Promise.resolve({value:void 0,done:!0});const e=this._reader;return void 0===e?d(k("iterate")):f(e.read(),(e=>{var t;return this._ongoingPromise=void 0,e.done&&(this._isFinished=!0,null===(t=this._reader)||void 0===t||t.releaseLock(),this._reader=void 0),e}),(e=>{var t;throw this._ongoingPromise=void 0,this._isFinished=!0,null===(t=this._reader)||void 0===t||t.releaseLock(),this._reader=void 0,e}))}_returnSteps(e){if(this._isFinished)return Promise.resolve({value:e,done:!0});this._isFinished=!0;const t=this._reader;if(void 0===t)return d(k("finish iterating"));if(this._reader=void 0,!this._preventCancel){const r=t.cancel(e);return t.releaseLock(),p(r,(()=>({value:e,done:!0})))}return t.releaseLock(),c({value:e,done:!0})}}const re={next(){return oe(this)?this._asyncIteratorImpl.next():d(ne("next"))},return(e){return oe(this)?this._asyncIteratorImpl.return(e):d(ne("return"))}};function oe(e){if(!r(e))return!1;if(!Object.prototype.hasOwnProperty.call(e,"_asyncIteratorImpl"))return!1;try{return e._asyncIteratorImpl instanceof te}catch(e){return!1}}function ne(e){return new TypeError(`ReadableStreamAsyncIterator.${e} can only be used on a ReadableSteamAsyncIterator`)}"symbol"==typeof e.asyncIterator&&Object.defineProperty(re,e.asyncIterator,{value(){return this},writable:!0,configurable:!0});const ae=Number.isNaN||function(e){return e!=e};function ie(e,t,r,o,n){new Uint8Array(e).set(new Uint8Array(r,o,n),t)}function le(e){const t=function(e,t,r){if(e.slice)return e.slice(t,r);const o=r-t,n=new ArrayBuffer(o);return ie(n,0,e,t,o),n}(e.buffer,e.byteOffset,e.byteOffset+e.byteLength);return new Uint8Array(t)}function se(e){const t=e._queue.shift();return e._queueTotalSize-=t.size,e._queueTotalSize<0&&(e._queueTotalSize=0),t.value}function ue(e,t,r){if("number"!=typeof(o=r)||ae(o)||o<0||r===1/0)throw new RangeError("Size must be a finite, non-NaN, non-negative number.");var o;e._queue.push({value:t,size:r}),e._queueTotalSize+=r}function ce(e){e._queue=new S,e._queueTotalSize=0}class ReadableStreamBYOBRequest{constructor(){throw new TypeError("Illegal constructor")}get view(){if(!fe(this))throw Be("view");return this._view}respond(e){if(!fe(this))throw Be("respond");if($(e,1,"respond"),e=N(e,"First parameter"),void 0===this._associatedReadableByteStreamController)throw new TypeError("This BYOB request has been invalidated");this._view.buffer,function(e,t){const r=e._pendingPullIntos.peek();if("closed"===e._controlledReadableByteStream._state){if(0!==t)throw new TypeError("bytesWritten must be 0 when calling respond() on a closed stream")}else{if(0===t)throw new TypeError("bytesWritten must be greater than 0 when calling respond() on a readable stream");if(r.bytesFilled+t>r.byteLength)throw new RangeError("bytesWritten out of range")}r.buffer=r.buffer,qe(e,t)}(this._associatedReadableByteStreamController,e)}respondWithNewView(e){if(!fe(this))throw Be("respondWithNewView");if($(e,1,"respondWithNewView"),!ArrayBuffer.isView(e))throw new TypeError("You can only respond with array buffer views");if(void 0===this._associatedReadableByteStreamController)throw new TypeError("This BYOB request has been invalidated");e.buffer,function(e,t){const r=e._pendingPullIntos.peek();if("closed"===e._controlledReadableByteStream._state){if(0!==t.byteLength)throw new TypeError("The view's length must be 0 when calling respondWithNewView() on a closed stream")}else if(0===t.byteLength)throw new TypeError("The view's length must be greater than 0 when calling respondWithNewView() on a readable stream");if(r.byteOffset+r.bytesFilled!==t.byteOffset)throw new RangeError("The region specified by view does not match byobRequest");if(r.bufferByteLength!==t.buffer.byteLength)throw new RangeError("The buffer of view has different capacity than byobRequest");if(r.bytesFilled+t.byteLength>r.byteLength)throw new RangeError("The region specified by view is larger than byobRequest");const o=t.byteLength;r.buffer=t.buffer,qe(e,o)}(this._associatedReadableByteStreamController,e)}}Object.defineProperties(ReadableStreamBYOBRequest.prototype,{respond:{enumerable:!0},respondWithNewView:{enumerable:!0},view:{enumerable:!0}}),n(ReadableStreamBYOBRequest.prototype.respond,"respond"),n(ReadableStreamBYOBRequest.prototype.respondWithNewView,"respondWithNewView"),"symbol"==typeof e.toStringTag&&Object.defineProperty(ReadableStreamBYOBRequest.prototype,e.toStringTag,{value:"ReadableStreamBYOBRequest",configurable:!0});class ReadableByteStreamController{constructor(){throw new TypeError("Illegal constructor")}get byobRequest(){if(!de(this))throw Ae("byobRequest");return function(e){if(null===e._byobRequest&&e._pendingPullIntos.length>0){const t=e._pendingPullIntos.peek(),r=new Uint8Array(t.buffer,t.byteOffset+t.bytesFilled,t.byteLength-t.bytesFilled),o=Object.create(ReadableStreamBYOBRequest.prototype);!function(e,t,r){e._associatedReadableByteStreamController=t,e._view=r}(o,e,r),e._byobRequest=o}return e._byobRequest}(this)}get desiredSize(){if(!de(this))throw Ae("desiredSize");return ke(this)}close(){if(!de(this))throw Ae("close");if(this._closeRequested)throw new TypeError("The stream has already been closed; do not close it again!");const e=this._controlledReadableByteStream._state;if("readable"!==e)throw new TypeError(`The stream (in ${e} state) is not in the readable state and cannot be closed`);!function(e){const t=e._controlledReadableByteStream;if(e._closeRequested||"readable"!==t._state)return;if(e._queueTotalSize>0)return void(e._closeRequested=!0);if(e._pendingPullIntos.length>0){if(e._pendingPullIntos.peek().bytesFilled>0){const t=new TypeError("Insufficient bytes to fill elements in the given buffer");throw Pe(e,t),t}}Ee(e),Xt(t)}(this)}enqueue(e){if(!de(this))throw Ae("enqueue");if($(e,1,"enqueue"),!ArrayBuffer.isView(e))throw new TypeError("chunk must be an array buffer view");if(0===e.byteLength)throw new TypeError("chunk must have non-zero byteLength");if(0===e.buffer.byteLength)throw new TypeError("chunk's buffer must have non-zero byteLength");if(this._closeRequested)throw new TypeError("stream is closed or draining");const t=this._controlledReadableByteStream._state;if("readable"!==t)throw new TypeError(`The stream (in ${t} state) is not in the readable state and cannot be enqueued to`);!function(e,t){const r=e._controlledReadableByteStream;if(e._closeRequested||"readable"!==r._state)return;const o=t.buffer,n=t.byteOffset,a=t.byteLength,i=o;if(e._pendingPullIntos.length>0){const t=e._pendingPullIntos.peek();t.buffer,0,Re(e),t.buffer=t.buffer,"none"===t.readerType&&ge(e,t)}if(J(r))if(function(e){const t=e._controlledReadableByteStream._reader;for(;t._readRequests.length>0;){if(0===e._queueTotalSize)return;We(e,t._readRequests.shift())}}(e),0===X(r))me(e,i,n,a);else{e._pendingPullIntos.length>0&&Ce(e);G(r,new Uint8Array(i,n,a),!1)}else Le(r)?(me(e,i,n,a),Te(e)):me(e,i,n,a);be(e)}(this,e)}error(e){if(!de(this))throw Ae("error");Pe(this,e)}[T](e){he(this),ce(this);const t=this._cancelAlgorithm(e);return Ee(this),t}[q](e){const t=this._controlledReadableByteStream;if(this._queueTotalSize>0)return void We(this,e);const r=this._autoAllocateChunkSize;if(void 0!==r){let t;try{t=new ArrayBuffer(r)}catch(t){return void e._errorSteps(t)}const o={buffer:t,bufferByteLength:r,byteOffset:0,byteLength:r,bytesFilled:0,elementSize:1,viewConstructor:Uint8Array,readerType:"default"};this._pendingPullIntos.push(o)}U(t,e),be(this)}[C](){if(this._pendingPullIntos.length>0){const e=this._pendingPullIntos.peek();e.readerType="none",this._pendingPullIntos=new S,this._pendingPullIntos.push(e)}}}function de(e){return!!r(e)&&(!!Object.prototype.hasOwnProperty.call(e,"_controlledReadableByteStream")&&e instanceof ReadableByteStreamController)}function fe(e){return!!r(e)&&(!!Object.prototype.hasOwnProperty.call(e,"_associatedReadableByteStreamController")&&e instanceof ReadableStreamBYOBRequest)}function be(e){const t=function(e){const t=e._controlledReadableByteStream;if("readable"!==t._state)return!1;if(e._closeRequested)return!1;if(!e._started)return!1;if(J(t)&&X(t)>0)return!0;if(Le(t)&&ze(t)>0)return!0;if(ke(e)>0)return!0;return!1}(e);if(!t)return;if(e._pulling)return void(e._pullAgain=!0);e._pulling=!0;b(e._pullAlgorithm(),(()=>(e._pulling=!1,e._pullAgain&&(e._pullAgain=!1,be(e)),null)),(t=>(Pe(e,t),null)))}function he(e){Re(e),e._pendingPullIntos=new S}function _e(e,t){let r=!1;"closed"===e._state&&(r=!0);const o=pe(t);"default"===t.readerType?G(e,o,r):function(e,t,r){const o=e._reader._readIntoRequests.shift();r?o._closeSteps(t):o._chunkSteps(t)}(e,o,r)}function pe(e){const t=e.bytesFilled,r=e.elementSize;return new e.viewConstructor(e.buffer,e.byteOffset,t/r)}function me(e,t,r,o){e._queue.push({buffer:t,byteOffset:r,byteLength:o}),e._queueTotalSize+=o}function ye(e,t,r,o){let n;try{n=t.slice(r,r+o)}catch(t){throw Pe(e,t),t}me(e,n,0,o)}function ge(e,t){t.bytesFilled>0&&ye(e,t.buffer,t.byteOffset,t.bytesFilled),Ce(e)}function we(e,t){const r=t.elementSize,o=t.bytesFilled-t.bytesFilled%r,n=Math.min(e._queueTotalSize,t.byteLength-t.bytesFilled),a=t.bytesFilled+n,i=a-a%r;let l=n,s=!1;i>o&&(l=i-t.bytesFilled,s=!0);const u=e._queue;for(;l>0;){const r=u.peek(),o=Math.min(l,r.byteLength),n=t.byteOffset+t.bytesFilled;ie(t.buffer,n,r.buffer,r.byteOffset,o),r.byteLength===o?u.shift():(r.byteOffset+=o,r.byteLength-=o),e._queueTotalSize-=o,Se(e,o,t),l-=o}return s}function Se(e,t,r){r.bytesFilled+=t}function ve(e){0===e._queueTotalSize&&e._closeRequested?(Ee(e),Xt(e._controlledReadableByteStream)):be(e)}function Re(e){null!==e._byobRequest&&(e._byobRequest._associatedReadableByteStreamController=void 0,e._byobRequest._view=null,e._byobRequest=null)}function Te(e){for(;e._pendingPullIntos.length>0;){if(0===e._queueTotalSize)return;const t=e._pendingPullIntos.peek();we(e,t)&&(Ce(e),_e(e._controlledReadableByteStream,t))}}function qe(e,t){const r=e._pendingPullIntos.peek();Re(e);"closed"===e._controlledReadableByteStream._state?function(e,t){"none"===t.readerType&&Ce(e);const r=e._controlledReadableByteStream;if(Le(r))for(;ze(r)>0;)_e(r,Ce(e))}(e,r):function(e,t,r){if(Se(0,t,r),"none"===r.readerType)return ge(e,r),void Te(e);if(r.bytesFilled<r.elementSize)return;Ce(e);const o=r.bytesFilled%r.elementSize;if(o>0){const t=r.byteOffset+r.bytesFilled;ye(e,r.buffer,t-o,o)}r.bytesFilled-=o,_e(e._controlledReadableByteStream,r),Te(e)}(e,t,r),be(e)}function Ce(e){return e._pendingPullIntos.shift()}function Ee(e){e._pullAlgorithm=void 0,e._cancelAlgorithm=void 0}function Pe(e,t){const r=e._controlledReadableByteStream;"readable"===r._state&&(he(e),ce(e),Ee(e),Jt(r,t))}function We(e,t){const r=e._queue.shift();e._queueTotalSize-=r.byteLength,ve(e);const o=new Uint8Array(r.buffer,r.byteOffset,r.byteLength);t._chunkSteps(o)}function ke(e){const t=e._controlledReadableByteStream._state;return"errored"===t?null:"closed"===t?0:e._strategyHWM-e._queueTotalSize}function Oe(e,t,r){const o=Object.create(ReadableByteStreamController.prototype);let n,a,i;n=void 0!==t.start?()=>t.start(o):()=>{},a=void 0!==t.pull?()=>t.pull(o):()=>c(void 0),i=void 0!==t.cancel?e=>t.cancel(e):()=>c(void 0);const l=t.autoAllocateChunkSize;if(0===l)throw new TypeError("autoAllocateChunkSize must be greater than 0");!function(e,t,r,o,n,a,i){t._controlledReadableByteStream=e,t._pullAgain=!1,t._pulling=!1,t._byobRequest=null,t._queue=t._queueTotalSize=void 0,ce(t),t._closeRequested=!1,t._started=!1,t._strategyHWM=a,t._pullAlgorithm=o,t._cancelAlgorithm=n,t._autoAllocateChunkSize=i,t._pendingPullIntos=new S,e._readableStreamController=t,b(c(r()),(()=>(t._started=!0,be(t),null)),(e=>(Pe(t,e),null)))}(e,o,n,a,i,r,l)}function Be(e){return new TypeError(`ReadableStreamBYOBRequest.prototype.${e} can only be used on a ReadableStreamBYOBRequest`)}function Ae(e){return new TypeError(`ReadableByteStreamController.prototype.${e} can only be used on a ReadableByteStreamController`)}function je(e,t){e._reader._readIntoRequests.push(t)}function ze(e){return e._reader._readIntoRequests.length}function Le(e){const t=e._reader;return void 0!==t&&!!Fe(t)}Object.defineProperties(ReadableByteStreamController.prototype,{close:{enumerable:!0},enqueue:{enumerable:!0},error:{enumerable:!0},byobRequest:{enumerable:!0},desiredSize:{enumerable:!0}}),n(ReadableByteStreamController.prototype.close,"close"),n(ReadableByteStreamController.prototype.enqueue,"enqueue"),n(ReadableByteStreamController.prototype.error,"error"),"symbol"==typeof e.toStringTag&&Object.defineProperty(ReadableByteStreamController.prototype,e.toStringTag,{value:"ReadableByteStreamController",configurable:!0});class ReadableStreamBYOBReader{constructor(e){if($(e,1,"ReadableStreamBYOBReader"),V(e,"First parameter"),Ut(e))throw new TypeError("This stream has already been locked for exclusive reading by another reader");if(!de(e._readableStreamController))throw new TypeError("Cannot construct a ReadableStreamBYOBReader for a stream not constructed with a byte source");E(this,e),this._readIntoRequests=new S}get closed(){return Fe(this)?this._closedPromise:d(De("closed"))}cancel(e){return Fe(this)?void 0===this._ownerReadableStream?d(k("cancel")):P(this,e):d(De("cancel"))}read(e){if(!Fe(this))return d(De("read"));if(!ArrayBuffer.isView(e))return d(new TypeError("view must be an array buffer view"));if(0===e.byteLength)return d(new TypeError("view must have non-zero byteLength"));if(0===e.buffer.byteLength)return d(new TypeError("view's buffer must have non-zero byteLength"));if(e.buffer,void 0===this._ownerReadableStream)return d(k("read from"));let t,r;const o=u(((e,o)=>{t=e,r=o}));return function(e,t,r){const o=e._ownerReadableStream;o._disturbed=!0,"errored"===o._state?r._errorSteps(o._storedError):function(e,t,r){const o=e._controlledReadableByteStream;let n=1;t.constructor!==DataView&&(n=t.constructor.BYTES_PER_ELEMENT);const a=t.constructor,i=t.buffer,l={buffer:i,bufferByteLength:i.byteLength,byteOffset:t.byteOffset,byteLength:t.byteLength,bytesFilled:0,elementSize:n,viewConstructor:a,readerType:"byob"};if(e._pendingPullIntos.length>0)return e._pendingPullIntos.push(l),void je(o,r);if("closed"!==o._state){if(e._queueTotalSize>0){if(we(e,l)){const t=pe(l);return ve(e),void r._chunkSteps(t)}if(e._closeRequested){const t=new TypeError("Insufficient bytes to fill elements in the given buffer");return Pe(e,t),void r._errorSteps(t)}}e._pendingPullIntos.push(l),je(o,r),be(e)}else{const e=new a(l.buffer,l.byteOffset,0);r._closeSteps(e)}}(o._readableStreamController,t,r)}(this,e,{_chunkSteps:e=>t({value:e,done:!1}),_closeSteps:e=>t({value:e,done:!0}),_errorSteps:e=>r(e)}),o}releaseLock(){if(!Fe(this))throw De("releaseLock");void 0!==this._ownerReadableStream&&function(e){W(e);const t=new TypeError("Reader was released");Ie(e,t)}(this)}}function Fe(e){return!!r(e)&&(!!Object.prototype.hasOwnProperty.call(e,"_readIntoRequests")&&e instanceof ReadableStreamBYOBReader)}function Ie(e,t){const r=e._readIntoRequests;e._readIntoRequests=new S,r.forEach((e=>{e._errorSteps(t)}))}function De(e){return new TypeError(`ReadableStreamBYOBReader.prototype.${e} can only be used on a ReadableStreamBYOBReader`)}function $e(e,t){const{highWaterMark:r}=e;if(void 0===r)return t;if(ae(r)||r<0)throw new RangeError("Invalid highWaterMark");return r}function Me(e){const{size:t}=e;return t||(()=>1)}function Ye(e,t){F(e,t);const r=null==e?void 0:e.highWaterMark,o=null==e?void 0:e.size;return{highWaterMark:void 0===r?void 0:Y(r),size:void 0===o?void 0:Qe(o,`${t} has member 'size' that`)}}function Qe(e,t){return I(e,t),t=>Y(e(t))}function Ne(e,t,r){return I(e,r),r=>w(e,t,[r])}function He(e,t,r){return I(e,r),()=>w(e,t,[])}function xe(e,t,r){return I(e,r),r=>g(e,t,[r])}function Ve(e,t,r){return I(e,r),(r,o)=>w(e,t,[r,o])}Object.defineProperties(ReadableStreamBYOBReader.prototype,{cancel:{enumerable:!0},read:{enumerable:!0},releaseLock:{enumerable:!0},closed:{enumerable:!0}}),n(ReadableStreamBYOBReader.prototype.cancel,"cancel"),n(ReadableStreamBYOBReader.prototype.read,"read"),n(ReadableStreamBYOBReader.prototype.releaseLock,"releaseLock"),"symbol"==typeof e.toStringTag&&Object.defineProperty(ReadableStreamBYOBReader.prototype,e.toStringTag,{value:"ReadableStreamBYOBReader",configurable:!0});const Ue="function"==typeof AbortController;class WritableStream{constructor(e={},t={}){void 0===e?e=null:D(e,"First parameter");const r=Ye(t,"Second parameter"),o=function(e,t){F(e,t);const r=null==e?void 0:e.abort,o=null==e?void 0:e.close,n=null==e?void 0:e.start,a=null==e?void 0:e.type,i=null==e?void 0:e.write;return{abort:void 0===r?void 0:Ne(r,e,`${t} has member 'abort' that`),close:void 0===o?void 0:He(o,e,`${t} has member 'close' that`),start:void 0===n?void 0:xe(n,e,`${t} has member 'start' that`),write:void 0===i?void 0:Ve(i,e,`${t} has member 'write' that`),type:a}}(e,"First parameter");var n;(n=this)._state="writable",n._storedError=void 0,n._writer=void 0,n._writableStreamController=void 0,n._writeRequests=new S,n._inFlightWriteRequest=void 0,n._closeRequest=void 0,n._inFlightCloseRequest=void 0,n._pendingAbortRequest=void 0,n._backpressure=!1;if(void 0!==o.type)throw new RangeError("Invalid type is specified");const a=Me(r);!function(e,t,r,o){const n=Object.create(WritableStreamDefaultController.prototype);let a,i,l,s;a=void 0!==t.start?()=>t.start(n):()=>{};i=void 0!==t.write?e=>t.write(e,n):()=>c(void 0);l=void 0!==t.close?()=>t.close():()=>c(void 0);s=void 0!==t.abort?e=>t.abort(e):()=>c(void 0);!function(e,t,r,o,n,a,i,l){t._controlledWritableStream=e,e._writableStreamController=t,t._queue=void 0,t._queueTotalSize=void 0,ce(t),t._abortReason=void 0,t._abortController=function(){if(Ue)return new AbortController}(),t._started=!1,t._strategySizeAlgorithm=l,t._strategyHWM=i,t._writeAlgorithm=o,t._closeAlgorithm=n,t._abortAlgorithm=a;const s=bt(t);nt(e,s);const u=r();b(c(u),(()=>(t._started=!0,dt(t),null)),(r=>(t._started=!0,Ze(e,r),null)))}(e,n,a,i,l,s,r,o)}(this,o,$e(r,1),a)}get locked(){if(!Ge(this))throw _t("locked");return Xe(this)}abort(e){return Ge(this)?Xe(this)?d(new TypeError("Cannot abort a stream that already has a writer")):Je(this,e):d(_t("abort"))}close(){return Ge(this)?Xe(this)?d(new TypeError("Cannot close a stream that already has a writer")):rt(this)?d(new TypeError("Cannot close an already-closing stream")):Ke(this):d(_t("close"))}getWriter(){if(!Ge(this))throw _t("getWriter");return new WritableStreamDefaultWriter(this)}}function Ge(e){return!!r(e)&&(!!Object.prototype.hasOwnProperty.call(e,"_writableStreamController")&&e instanceof WritableStream)}function Xe(e){return void 0!==e._writer}function Je(e,t){var r;if("closed"===e._state||"errored"===e._state)return c(void 0);e._writableStreamController._abortReason=t,null===(r=e._writableStreamController._abortController)||void 0===r||r.abort(t);const o=e._state;if("closed"===o||"errored"===o)return c(void 0);if(void 0!==e._pendingAbortRequest)return e._pendingAbortRequest._promise;let n=!1;"erroring"===o&&(n=!0,t=void 0);const a=u(((r,o)=>{e._pendingAbortRequest={_promise:void 0,_resolve:r,_reject:o,_reason:t,_wasAlreadyErroring:n}}));return e._pendingAbortRequest._promise=a,n||et(e,t),a}function Ke(e){const t=e._state;if("closed"===t||"errored"===t)return d(new TypeError(`The stream (in ${t} state) is not in the writable state and cannot be closed`));const r=u(((t,r)=>{const o={_resolve:t,_reject:r};e._closeRequest=o})),o=e._writer;var n;return void 0!==o&&e._backpressure&&"writable"===t&&Et(o),ue(n=e._writableStreamController,lt,0),dt(n),r}function Ze(e,t){"writable"!==e._state?tt(e):et(e,t)}function et(e,t){const r=e._writableStreamController;e._state="erroring",e._storedError=t;const o=e._writer;void 0!==o&&it(o,t),!function(e){if(void 0===e._inFlightWriteRequest&&void 0===e._inFlightCloseRequest)return!1;return!0}(e)&&r._started&&tt(e)}function tt(e){e._state="errored",e._writableStreamController[R]();const t=e._storedError;if(e._writeRequests.forEach((e=>{e._reject(t)})),e._writeRequests=new S,void 0===e._pendingAbortRequest)return void ot(e);const r=e._pendingAbortRequest;if(e._pendingAbortRequest=void 0,r._wasAlreadyErroring)return r._reject(t),void ot(e);b(e._writableStreamController[v](r._reason),(()=>(r._resolve(),ot(e),null)),(t=>(r._reject(t),ot(e),null)))}function rt(e){return void 0!==e._closeRequest||void 0!==e._inFlightCloseRequest}function ot(e){void 0!==e._closeRequest&&(e._closeRequest._reject(e._storedError),e._closeRequest=void 0);const t=e._writer;void 0!==t&&St(t,e._storedError)}function nt(e,t){const r=e._writer;void 0!==r&&t!==e._backpressure&&(t?function(e){Rt(e)}(r):Et(r)),e._backpressure=t}Object.defineProperties(WritableStream.prototype,{abort:{enumerable:!0},close:{enumerable:!0},getWriter:{enumerable:!0},locked:{enumerable:!0}}),n(WritableStream.prototype.abort,"abort"),n(WritableStream.prototype.close,"close"),n(WritableStream.prototype.getWriter,"getWriter"),"symbol"==typeof e.toStringTag&&Object.defineProperty(WritableStream.prototype,e.toStringTag,{value:"WritableStream",configurable:!0});class WritableStreamDefaultWriter{constructor(e){if($(e,1,"WritableStreamDefaultWriter"),function(e,t){if(!Ge(e))throw new TypeError(`${t} is not a WritableStream.`)}(e,"First parameter"),Xe(e))throw new TypeError("This stream has already been locked for exclusive writing by another writer");this._ownerWritableStream=e,e._writer=this;const t=e._state;if("writable"===t)!rt(e)&&e._backpressure?Rt(this):qt(this),gt(this);else if("erroring"===t)Tt(this,e._storedError),gt(this);else if("closed"===t)qt(this),gt(r=this),vt(r);else{const t=e._storedError;Tt(this,t),wt(this,t)}var r}get closed(){return at(this)?this._closedPromise:d(mt("closed"))}get desiredSize(){if(!at(this))throw mt("desiredSize");if(void 0===this._ownerWritableStream)throw yt("desiredSize");return function(e){const t=e._ownerWritableStream,r=t._state;if("errored"===r||"erroring"===r)return null;if("closed"===r)return 0;return ct(t._writableStreamController)}(this)}get ready(){return at(this)?this._readyPromise:d(mt("ready"))}abort(e){return at(this)?void 0===this._ownerWritableStream?d(yt("abort")):function(e,t){return Je(e._ownerWritableStream,t)}(this,e):d(mt("abort"))}close(){if(!at(this))return d(mt("close"));const e=this._ownerWritableStream;return void 0===e?d(yt("close")):rt(e)?d(new TypeError("Cannot close an already-closing stream")):Ke(this._ownerWritableStream)}releaseLock(){if(!at(this))throw mt("releaseLock");void 0!==this._ownerWritableStream&&function(e){const t=e._ownerWritableStream,r=new TypeError("Writer was released and can no longer be used to monitor the stream's closedness");it(e,r),function(e,t){"pending"===e._closedPromiseState?St(e,t):function(e,t){wt(e,t)}(e,t)}(e,r),t._writer=void 0,e._ownerWritableStream=void 0}(this)}write(e){return at(this)?void 0===this._ownerWritableStream?d(yt("write to")):function(e,t){const r=e._ownerWritableStream,o=r._writableStreamController,n=function(e,t){try{return e._strategySizeAlgorithm(t)}catch(t){return ft(e,t),1}}(o,t);if(r!==e._ownerWritableStream)return d(yt("write to"));const a=r._state;if("errored"===a)return d(r._storedError);if(rt(r)||"closed"===a)return d(new TypeError("The stream is closing or closed and cannot be written to"));if("erroring"===a)return d(r._storedError);const i=function(e){return u(((t,r)=>{const o={_resolve:t,_reject:r};e._writeRequests.push(o)}))}(r);return function(e,t,r){try{ue(e,t,r)}catch(t){return void ft(e,t)}const o=e._controlledWritableStream;if(!rt(o)&&"writable"===o._state){nt(o,bt(e))}dt(e)}(o,t,n),i}(this,e):d(mt("write"))}}function at(e){return!!r(e)&&(!!Object.prototype.hasOwnProperty.call(e,"_ownerWritableStream")&&e instanceof WritableStreamDefaultWriter)}function it(e,t){"pending"===e._readyPromiseState?Ct(e,t):function(e,t){Tt(e,t)}(e,t)}Object.defineProperties(WritableStreamDefaultWriter.prototype,{abort:{enumerable:!0},close:{enumerable:!0},releaseLock:{enumerable:!0},write:{enumerable:!0},closed:{enumerable:!0},desiredSize:{enumerable:!0},ready:{enumerable:!0}}),n(WritableStreamDefaultWriter.prototype.abort,"abort"),n(WritableStreamDefaultWriter.prototype.close,"close"),n(WritableStreamDefaultWriter.prototype.releaseLock,"releaseLock"),n(WritableStreamDefaultWriter.prototype.write,"write"),"symbol"==typeof e.toStringTag&&Object.defineProperty(WritableStreamDefaultWriter.prototype,e.toStringTag,{value:"WritableStreamDefaultWriter",configurable:!0});const lt={};class WritableStreamDefaultController{constructor(){throw new TypeError("Illegal constructor")}get abortReason(){if(!st(this))throw pt("abortReason");return this._abortReason}get signal(){if(!st(this))throw pt("signal");if(void 0===this._abortController)throw new TypeError("WritableStreamDefaultController.prototype.signal is not supported");return this._abortController.signal}error(e){if(!st(this))throw pt("error");"writable"===this._controlledWritableStream._state&&ht(this,e)}[v](e){const t=this._abortAlgorithm(e);return ut(this),t}[R](){ce(this)}}function st(e){return!!r(e)&&(!!Object.prototype.hasOwnProperty.call(e,"_controlledWritableStream")&&e instanceof WritableStreamDefaultController)}function ut(e){e._writeAlgorithm=void 0,e._closeAlgorithm=void 0,e._abortAlgorithm=void 0,e._strategySizeAlgorithm=void 0}function ct(e){return e._strategyHWM-e._queueTotalSize}function dt(e){const t=e._controlledWritableStream;if(!e._started)return;if(void 0!==t._inFlightWriteRequest)return;if("erroring"===t._state)return void tt(t);if(0===e._queue.length)return;const r=e._queue.peek().value;r===lt?function(e){const t=e._controlledWritableStream;(function(e){e._inFlightCloseRequest=e._closeRequest,e._closeRequest=void 0})(t),se(e);const r=e._closeAlgorithm();ut(e),b(r,(()=>(function(e){e._inFlightCloseRequest._resolve(void 0),e._inFlightCloseRequest=void 0,"erroring"===e._state&&(e._storedError=void 0,void 0!==e._pendingAbortRequest&&(e._pendingAbortRequest._resolve(),e._pendingAbortRequest=void 0)),e._state="closed";const t=e._writer;void 0!==t&&vt(t)}(t),null)),(e=>(function(e,t){e._inFlightCloseRequest._reject(t),e._inFlightCloseRequest=void 0,void 0!==e._pendingAbortRequest&&(e._pendingAbortRequest._reject(t),e._pendingAbortRequest=void 0),Ze(e,t)}(t,e),null)))}(e):function(e,t){const r=e._controlledWritableStream;!function(e){e._inFlightWriteRequest=e._writeRequests.shift()}(r);b(e._writeAlgorithm(t),(()=>{!function(e){e._inFlightWriteRequest._resolve(void 0),e._inFlightWriteRequest=void 0}(r);const t=r._state;if(se(e),!rt(r)&&"writable"===t){const t=bt(e);nt(r,t)}return dt(e),null}),(t=>("writable"===r._state&&ut(e),function(e,t){e._inFlightWriteRequest._reject(t),e._inFlightWriteRequest=void 0,Ze(e,t)}(r,t),null)))}(e,r)}function ft(e,t){"writable"===e._controlledWritableStream._state&&ht(e,t)}function bt(e){return ct(e)<=0}function ht(e,t){const r=e._controlledWritableStream;ut(e),et(r,t)}function _t(e){return new TypeError(`WritableStream.prototype.${e} can only be used on a WritableStream`)}function pt(e){return new TypeError(`WritableStreamDefaultController.prototype.${e} can only be used on a WritableStreamDefaultController`)}function mt(e){return new TypeError(`WritableStreamDefaultWriter.prototype.${e} can only be used on a WritableStreamDefaultWriter`)}function yt(e){return new TypeError("Cannot "+e+" a stream using a released writer")}function gt(e){e._closedPromise=u(((t,r)=>{e._closedPromise_resolve=t,e._closedPromise_reject=r,e._closedPromiseState="pending"}))}function wt(e,t){gt(e),St(e,t)}function St(e,t){void 0!==e._closedPromise_reject&&(m(e._closedPromise),e._closedPromise_reject(t),e._closedPromise_resolve=void 0,e._closedPromise_reject=void 0,e._closedPromiseState="rejected")}function vt(e){void 0!==e._closedPromise_resolve&&(e._closedPromise_resolve(void 0),e._closedPromise_resolve=void 0,e._closedPromise_reject=void 0,e._closedPromiseState="resolved")}function Rt(e){e._readyPromise=u(((t,r)=>{e._readyPromise_resolve=t,e._readyPromise_reject=r})),e._readyPromiseState="pending"}function Tt(e,t){Rt(e),Ct(e,t)}function qt(e){Rt(e),Et(e)}function Ct(e,t){void 0!==e._readyPromise_reject&&(m(e._readyPromise),e._readyPromise_reject(t),e._readyPromise_resolve=void 0,e._readyPromise_reject=void 0,e._readyPromiseState="rejected")}function Et(e){void 0!==e._readyPromise_resolve&&(e._readyPromise_resolve(void 0),e._readyPromise_resolve=void 0,e._readyPromise_reject=void 0,e._readyPromiseState="fulfilled")}Object.defineProperties(WritableStreamDefaultController.prototype,{abortReason:{enumerable:!0},signal:{enumerable:!0},error:{enumerable:!0}}),"symbol"==typeof e.toStringTag&&Object.defineProperty(WritableStreamDefaultController.prototype,e.toStringTag,{value:"WritableStreamDefaultController",configurable:!0});const Pt="undefined"!=typeof DOMException?DOMException:void 0;const Wt=function(e){if("function"!=typeof e&&"object"!=typeof e)return!1;try{return new e,!0}catch(e){return!1}}(Pt)?Pt:function(){const e=function(e,t){this.message=e||"",this.name=t||"Error",Error.captureStackTrace&&Error.captureStackTrace(this,this.constructor)};return e.prototype=Object.create(Error.prototype),Object.defineProperty(e.prototype,"constructor",{value:e,writable:!0,configurable:!0}),e}();function kt(e,t,r,o,n,a){const i=e.getReader(),l=t.getWriter();Vt(e)&&(e._disturbed=!0);let s,_,g,w=!1,S=!1,v="readable",R="writable",T=!1,q=!1;const C=u((e=>{g=e}));let E=Promise.resolve(void 0);return u(((P,W)=>{let k;function O(){if(w)return;const e=u(((e,t)=>{!function r(o){o?e():f(function(){if(w)return c(!0);return f(l.ready,(()=>f(i.read(),(e=>!!e.done||(E=l.write(e.value),m(E),!1)))))}(),r,t)}(!1)}));m(e)}function B(){return v="closed",r?L():z((()=>(Ge(t)&&(T=rt(t),R=t._state),T||"closed"===R?c(void 0):"erroring"===R||"errored"===R?d(_):(T=!0,l.close()))),!1,void 0),null}function A(e){return w||(v="errored",s=e,o?L(!0,e):z((()=>l.abort(e)),!0,e)),null}function j(e){return S||(R="errored",_=e,n?L(!0,e):z((()=>i.cancel(e)),!0,e)),null}if(void 0!==a&&(k=()=>{const e=void 0!==a.reason?a.reason:new Wt("Aborted","AbortError"),t=[];o||t.push((()=>"writable"===R?l.abort(e):c(void 0))),n||t.push((()=>"readable"===v?i.cancel(e):c(void 0))),z((()=>Promise.all(t.map((e=>e())))),!0,e)},a.aborted?k():a.addEventListener("abort",k)),Vt(e)&&(v=e._state,s=e._storedError),Ge(t)&&(R=t._state,_=t._storedError,T=rt(t)),Vt(e)&&Ge(t)&&(q=!0,g()),"errored"===v)A(s);else if("erroring"===R||"errored"===R)j(_);else if("closed"===v)B();else if(T||"closed"===R){const e=new TypeError("the destination writable stream closed before all data could be piped to it");n?L(!0,e):z((()=>i.cancel(e)),!0,e)}function z(e,t,r){function o(){return"writable"!==R||T?n():h(function(){let e;return c(function t(){if(e!==E)return e=E,p(E,t,t)}())}(),n),null}function n(){return e?b(e(),(()=>F(t,r)),(e=>F(!0,e))):F(t,r),null}w||(w=!0,q?o():h(C,o))}function L(e,t){z(void 0,e,t)}function F(e,t){return S=!0,l.releaseLock(),i.releaseLock(),void 0!==a&&a.removeEventListener("abort",k),e?W(t):P(void 0),null}w||(b(i.closed,B,A),b(l.closed,(function(){return S||(R="closed"),null}),j)),q?O():y((()=>{q=!0,g(),O()}))}))}function Ot(e,t){return function(e){try{return e.getReader({mode:"byob"}).releaseLock(),!0}catch(e){return!1}}(e)?function(e){let t,r,o,n,a,i=e.getReader(),l=!1,s=!1,d=!1,f=!1,h=!1,p=!1;const m=u((e=>{a=e}));function y(e){_(e.closed,(t=>(e!==i||(o.error(t),n.error(t),h&&p||a(void 0)),null)))}function g(){l&&(i.releaseLock(),i=e.getReader(),y(i),l=!1),b(i.read(),(e=>{var t,r;if(d=!1,f=!1,e.done)return h||o.close(),p||n.close(),null===(t=o.byobRequest)||void 0===t||t.respond(0),null===(r=n.byobRequest)||void 0===r||r.respond(0),h&&p||a(void 0),null;const l=e.value,u=l;let c=l;if(!h&&!p)try{c=le(l)}catch(e){return o.error(e),n.error(e),a(i.cancel(e)),null}return h||o.enqueue(u),p||n.enqueue(c),s=!1,d?S():f&&v(),null}),(()=>(s=!1,null)))}function w(t,r){l||(i.releaseLock(),i=e.getReader({mode:"byob"}),y(i),l=!0);const u=r?n:o,c=r?o:n;b(i.read(t),(e=>{var t;d=!1,f=!1;const o=r?p:h,n=r?h:p;if(e.done){o||u.close(),n||c.close();const r=e.value;return void 0!==r&&(o||u.byobRequest.respondWithNewView(r),n||null===(t=c.byobRequest)||void 0===t||t.respond(0)),o&&n||a(void 0),null}const l=e.value;if(n)o||u.byobRequest.respondWithNewView(l);else{let e;try{e=le(l)}catch(e){return u.error(e),c.error(e),a(i.cancel(e)),null}o||u.byobRequest.respondWithNewView(l),c.enqueue(e)}return s=!1,d?S():f&&v(),null}),(()=>(s=!1,null)))}function S(){if(s)return d=!0,c(void 0);s=!0;const e=o.byobRequest;return null===e?g():w(e.view,!1),c(void 0)}function v(){if(s)return f=!0,c(void 0);s=!0;const e=n.byobRequest;return null===e?g():w(e.view,!0),c(void 0)}function R(e){if(h=!0,t=e,p){const e=[t,r],o=i.cancel(e);a(o)}return m}function T(e){if(p=!0,r=e,h){const e=[t,r],o=i.cancel(e);a(o)}return m}const q=new ReadableStream({type:"bytes",start(e){o=e},pull:S,cancel:R}),C=new ReadableStream({type:"bytes",start(e){n=e},pull:v,cancel:T});return y(i),[q,C]}(e):function(e,t){const r=e.getReader();let o,n,a,i,l,s=!1,d=!1,f=!1,h=!1;const p=u((e=>{l=e}));function m(){return s?(d=!0,c(void 0)):(s=!0,b(r.read(),(e=>{if(d=!1,e.done)return f||a.close(),h||i.close(),f&&h||l(void 0),null;const t=e.value,r=t,o=t;return f||a.enqueue(r),h||i.enqueue(o),s=!1,d&&m(),null}),(()=>(s=!1,null))),c(void 0))}function y(e){if(f=!0,o=e,h){const e=[o,n],t=r.cancel(e);l(t)}return p}function g(e){if(h=!0,n=e,f){const e=[o,n],t=r.cancel(e);l(t)}return p}const w=new ReadableStream({start(e){a=e},pull:m,cancel:y}),S=new ReadableStream({start(e){i=e},pull:m,cancel:g});return _(r.closed,(e=>(a.error(e),i.error(e),f&&h||l(void 0),null))),[w,S]}(e)}class ReadableStreamDefaultController{constructor(){throw new TypeError("Illegal constructor")}get desiredSize(){if(!Bt(this))throw Dt("desiredSize");return Lt(this)}close(){if(!Bt(this))throw Dt("close");if(!Ft(this))throw new TypeError("The stream is not in a state that permits close");!function(e){if(!Ft(e))return;const t=e._controlledReadableStream;e._closeRequested=!0,0===e._queue.length&&(jt(e),Xt(t))}(this)}enqueue(e){if(!Bt(this))throw Dt("enqueue");if(!Ft(this))throw new TypeError("The stream is not in a state that permits enqueue");return function(e,t){if(!Ft(e))return;const r=e._controlledReadableStream;if(Ut(r)&&X(r)>0)G(r,t,!1);else{let r;try{r=e._strategySizeAlgorithm(t)}catch(t){throw zt(e,t),t}try{ue(e,t,r)}catch(t){throw zt(e,t),t}}At(e)}(this,e)}error(e){if(!Bt(this))throw Dt("error");zt(this,e)}[T](e){ce(this);const t=this._cancelAlgorithm(e);return jt(this),t}[q](e){const t=this._controlledReadableStream;if(this._queue.length>0){const r=se(this);this._closeRequested&&0===this._queue.length?(jt(this),Xt(t)):At(this),e._chunkSteps(r)}else U(t,e),At(this)}[C](){}}function Bt(e){return!!r(e)&&(!!Object.prototype.hasOwnProperty.call(e,"_controlledReadableStream")&&e instanceof ReadableStreamDefaultController)}function At(e){const t=function(e){const t=e._controlledReadableStream;if(!Ft(e))return!1;if(!e._started)return!1;if(Ut(t)&&X(t)>0)return!0;if(Lt(e)>0)return!0;return!1}(e);if(!t)return;if(e._pulling)return void(e._pullAgain=!0);e._pulling=!0;b(e._pullAlgorithm(),(()=>(e._pulling=!1,e._pullAgain&&(e._pullAgain=!1,At(e)),null)),(t=>(zt(e,t),null)))}function jt(e){e._pullAlgorithm=void 0,e._cancelAlgorithm=void 0,e._strategySizeAlgorithm=void 0}function zt(e,t){const r=e._controlledReadableStream;"readable"===r._state&&(ce(e),jt(e),Jt(r,t))}function Lt(e){const t=e._controlledReadableStream._state;return"errored"===t?null:"closed"===t?0:e._strategyHWM-e._queueTotalSize}function Ft(e){return!e._closeRequested&&"readable"===e._controlledReadableStream._state}function It(e,t,r,o){const n=Object.create(ReadableStreamDefaultController.prototype);let a,i,l;a=void 0!==t.start?()=>t.start(n):()=>{},i=void 0!==t.pull?()=>t.pull(n):()=>c(void 0),l=void 0!==t.cancel?e=>t.cancel(e):()=>c(void 0),function(e,t,r,o,n,a,i){t._controlledReadableStream=e,t._queue=void 0,t._queueTotalSize=void 0,ce(t),t._started=!1,t._closeRequested=!1,t._pullAgain=!1,t._pulling=!1,t._strategySizeAlgorithm=i,t._strategyHWM=a,t._pullAlgorithm=o,t._cancelAlgorithm=n,e._readableStreamController=t,b(c(r()),(()=>(t._started=!0,At(t),null)),(e=>(zt(t,e),null)))}(e,n,a,i,l,r,o)}function Dt(e){return new TypeError(`ReadableStreamDefaultController.prototype.${e} can only be used on a ReadableStreamDefaultController`)}function $t(e,t,r){return I(e,r),r=>w(e,t,[r])}function Mt(e,t,r){return I(e,r),r=>w(e,t,[r])}function Yt(e,t,r){return I(e,r),r=>g(e,t,[r])}function Qt(e,t){if("bytes"!==(e=`${e}`))throw new TypeError(`${t} '${e}' is not a valid enumeration value for ReadableStreamType`);return e}function Nt(e,t){if("byob"!==(e=`${e}`))throw new TypeError(`${t} '${e}' is not a valid enumeration value for ReadableStreamReaderMode`);return e}function Ht(e,t){F(e,t);const r=null==e?void 0:e.preventAbort,o=null==e?void 0:e.preventCancel,n=null==e?void 0:e.preventClose,a=null==e?void 0:e.signal;return void 0!==a&&function(e,t){if(!function(e){if("object"!=typeof e||null===e)return!1;try{return"boolean"==typeof e.aborted}catch(e){return!1}}(e))throw new TypeError(`${t} is not an AbortSignal.`)}(a,`${t} has member 'signal' that`),{preventAbort:Boolean(r),preventCancel:Boolean(o),preventClose:Boolean(n),signal:a}}function xt(e,t){F(e,t);const r=null==e?void 0:e.readable;M(r,"readable","ReadableWritablePair"),function(e,t){if(!H(e))throw new TypeError(`${t} is not a ReadableStream.`)}(r,`${t} has member 'readable' that`);const o=null==e?void 0:e.writable;return M(o,"writable","ReadableWritablePair"),function(e,t){if(!x(e))throw new TypeError(`${t} is not a WritableStream.`)}(o,`${t} has member 'writable' that`),{readable:r,writable:o}}Object.defineProperties(ReadableStreamDefaultController.prototype,{close:{enumerable:!0},enqueue:{enumerable:!0},error:{enumerable:!0},desiredSize:{enumerable:!0}}),n(ReadableStreamDefaultController.prototype.close,"close"),n(ReadableStreamDefaultController.prototype.enqueue,"enqueue"),n(ReadableStreamDefaultController.prototype.error,"error"),"symbol"==typeof e.toStringTag&&Object.defineProperty(ReadableStreamDefaultController.prototype,e.toStringTag,{value:"ReadableStreamDefaultController",configurable:!0});class ReadableStream{constructor(e={},t={}){void 0===e?e=null:D(e,"First parameter");const r=Ye(t,"Second parameter"),o=function(e,t){F(e,t);const r=e,o=null==r?void 0:r.autoAllocateChunkSize,n=null==r?void 0:r.cancel,a=null==r?void 0:r.pull,i=null==r?void 0:r.start,l=null==r?void 0:r.type;return{autoAllocateChunkSize:void 0===o?void 0:N(o,`${t} has member 'autoAllocateChunkSize' that`),cancel:void 0===n?void 0:$t(n,r,`${t} has member 'cancel' that`),pull:void 0===a?void 0:Mt(a,r,`${t} has member 'pull' that`),start:void 0===i?void 0:Yt(i,r,`${t} has member 'start' that`),type:void 0===l?void 0:Qt(l,`${t} has member 'type' that`)}}(e,"First parameter");var n;if((n=this)._state="readable",n._reader=void 0,n._storedError=void 0,n._disturbed=!1,"bytes"===o.type){if(void 0!==r.size)throw new RangeError("The strategy for a byte stream cannot have a size function");Oe(this,o,$e(r,0))}else{const e=Me(r);It(this,o,$e(r,1),e)}}get locked(){if(!Vt(this))throw Kt("locked");return Ut(this)}cancel(e){return Vt(this)?Ut(this)?d(new TypeError("Cannot cancel a stream that already has a reader")):Gt(this,e):d(Kt("cancel"))}getReader(e){if(!Vt(this))throw Kt("getReader");return void 0===function(e,t){F(e,t);const r=null==e?void 0:e.mode;return{mode:void 0===r?void 0:Nt(r,`${t} has member 'mode' that`)}}(e,"First parameter").mode?new ReadableStreamDefaultReader(this):function(e){return new ReadableStreamBYOBReader(e)}(this)}pipeThrough(e,t={}){if(!H(this))throw Kt("pipeThrough");$(e,1,"pipeThrough");const r=xt(e,"First parameter"),o=Ht(t,"Second parameter");if(this.locked)throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked ReadableStream");if(r.writable.locked)throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked WritableStream");return m(kt(this,r.writable,o.preventClose,o.preventAbort,o.preventCancel,o.signal)),r.readable}pipeTo(e,t={}){if(!H(this))return d(Kt("pipeTo"));if(void 0===e)return d("Parameter 1 is required in 'pipeTo'.");if(!x(e))return d(new TypeError("ReadableStream.prototype.pipeTo's first argument must be a WritableStream"));let r;try{r=Ht(t,"Second parameter")}catch(e){return d(e)}return this.locked?d(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked ReadableStream")):e.locked?d(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked WritableStream")):kt(this,e,r.preventClose,r.preventAbort,r.preventCancel,r.signal)}tee(){if(!H(this))throw Kt("tee");if(this.locked)throw new TypeError("Cannot tee a stream that already has a reader");return Ot(this)}values(e){if(!H(this))throw Kt("values");return function(e,t){const r=e.getReader(),o=new te(r,t),n=Object.create(re);return n._asyncIteratorImpl=o,n}(this,function(e,t){F(e,t);const r=null==e?void 0:e.preventCancel;return{preventCancel:Boolean(r)}}(e,"First parameter").preventCancel)}}function Vt(e){return!!r(e)&&(!!Object.prototype.hasOwnProperty.call(e,"_readableStreamController")&&e instanceof ReadableStream)}function Ut(e){return void 0!==e._reader}function Gt(e,r){if(e._disturbed=!0,"closed"===e._state)return c(void 0);if("errored"===e._state)return d(e._storedError);Xt(e);const o=e._reader;if(void 0!==o&&Fe(o)){const e=o._readIntoRequests;o._readIntoRequests=new S,e.forEach((e=>{e._closeSteps(void 0)}))}return p(e._readableStreamController[T](r),t)}function Xt(e){e._state="closed";const t=e._reader;if(void 0!==t&&(j(t),K(t))){const e=t._readRequests;t._readRequests=new S,e.forEach((e=>{e._closeSteps()}))}}function Jt(e,t){e._state="errored",e._storedError=t;const r=e._reader;void 0!==r&&(A(r,t),K(r)?Z(r,t):Ie(r,t))}function Kt(e){return new TypeError(`ReadableStream.prototype.${e} can only be used on a ReadableStream`)}function Zt(e,t){F(e,t);const r=null==e?void 0:e.highWaterMark;return M(r,"highWaterMark","QueuingStrategyInit"),{highWaterMark:Y(r)}}Object.defineProperties(ReadableStream.prototype,{cancel:{enumerable:!0},getReader:{enumerable:!0},pipeThrough:{enumerable:!0},pipeTo:{enumerable:!0},tee:{enumerable:!0},values:{enumerable:!0},locked:{enumerable:!0}}),n(ReadableStream.prototype.cancel,"cancel"),n(ReadableStream.prototype.getReader,"getReader"),n(ReadableStream.prototype.pipeThrough,"pipeThrough"),n(ReadableStream.prototype.pipeTo,"pipeTo"),n(ReadableStream.prototype.tee,"tee"),n(ReadableStream.prototype.values,"values"),"symbol"==typeof e.toStringTag&&Object.defineProperty(ReadableStream.prototype,e.toStringTag,{value:"ReadableStream",configurable:!0}),"symbol"==typeof e.asyncIterator&&Object.defineProperty(ReadableStream.prototype,e.asyncIterator,{value:ReadableStream.prototype.values,writable:!0,configurable:!0});const er=e=>e.byteLength;n(er,"size");class ByteLengthQueuingStrategy{constructor(e){$(e,1,"ByteLengthQueuingStrategy"),e=Zt(e,"First parameter"),this._byteLengthQueuingStrategyHighWaterMark=e.highWaterMark}get highWaterMark(){if(!rr(this))throw tr("highWaterMark");return this._byteLengthQueuingStrategyHighWaterMark}get size(){if(!rr(this))throw tr("size");return er}}function tr(e){return new TypeError(`ByteLengthQueuingStrategy.prototype.${e} can only be used on a ByteLengthQueuingStrategy`)}function rr(e){return!!r(e)&&(!!Object.prototype.hasOwnProperty.call(e,"_byteLengthQueuingStrategyHighWaterMark")&&e instanceof ByteLengthQueuingStrategy)}Object.defineProperties(ByteLengthQueuingStrategy.prototype,{highWaterMark:{enumerable:!0},size:{enumerable:!0}}),"symbol"==typeof e.toStringTag&&Object.defineProperty(ByteLengthQueuingStrategy.prototype,e.toStringTag,{value:"ByteLengthQueuingStrategy",configurable:!0});const or=()=>1;n(or,"size");class CountQueuingStrategy{constructor(e){$(e,1,"CountQueuingStrategy"),e=Zt(e,"First parameter"),this._countQueuingStrategyHighWaterMark=e.highWaterMark}get highWaterMark(){if(!ar(this))throw nr("highWaterMark");return this._countQueuingStrategyHighWaterMark}get size(){if(!ar(this))throw nr("size");return or}}function nr(e){return new TypeError(`CountQueuingStrategy.prototype.${e} can only be used on a CountQueuingStrategy`)}function ar(e){return!!r(e)&&(!!Object.prototype.hasOwnProperty.call(e,"_countQueuingStrategyHighWaterMark")&&e instanceof CountQueuingStrategy)}function ir(e,t,r){return I(e,r),r=>w(e,t,[r])}function lr(e,t,r){return I(e,r),r=>g(e,t,[r])}function sr(e,t,r){return I(e,r),(r,o)=>w(e,t,[r,o])}Object.defineProperties(CountQueuingStrategy.prototype,{highWaterMark:{enumerable:!0},size:{enumerable:!0}}),"symbol"==typeof e.toStringTag&&Object.defineProperty(CountQueuingStrategy.prototype,e.toStringTag,{value:"CountQueuingStrategy",configurable:!0});class TransformStream{constructor(e={},t={},r={}){void 0===e&&(e=null);const o=Ye(t,"Second parameter"),n=Ye(r,"Third parameter"),a=function(e,t){F(e,t);const r=null==e?void 0:e.flush,o=null==e?void 0:e.readableType,n=null==e?void 0:e.start,a=null==e?void 0:e.transform,i=null==e?void 0:e.writableType;return{flush:void 0===r?void 0:ir(r,e,`${t} has member 'flush' that`),readableType:o,start:void 0===n?void 0:lr(n,e,`${t} has member 'start' that`),transform:void 0===a?void 0:sr(a,e,`${t} has member 'transform' that`),writableType:i}}(e,"First parameter");if(void 0!==a.readableType)throw new RangeError("Invalid readableType specified");if(void 0!==a.writableType)throw new RangeError("Invalid writableType specified");const i=$e(n,0),l=Me(n),s=$e(o,1),f=Me(o);let b;!function(e,t,r,o,n,a){function i(){return t}function l(t){return function(e,t){const r=e._transformStreamController;if(e._backpressure){return p(e._backpressureChangePromise,(()=>{if("erroring"===(Ge(e._writable)?e._writable._state:e._writableState))throw Ge(e._writable)?e._writable._storedError:e._writableStoredError;return pr(r,t)}))}return pr(r,t)}(e,t)}function s(t){return function(e,t){return cr(e,t),c(void 0)}(e,t)}function u(){return function(e){const t=e._transformStreamController,r=t._flushAlgorithm();return hr(t),p(r,(()=>{if("errored"===e._readableState)throw e._readableStoredError;gr(e)&&wr(e)}),(t=>{throw cr(e,t),e._readableStoredError}))}(e)}function d(){return function(e){return fr(e,!1),e._backpressureChangePromise}(e)}function f(t){return dr(e,t),c(void 0)}e._writableState="writable",e._writableStoredError=void 0,e._writableHasInFlightOperation=!1,e._writableStarted=!1,e._writable=function(e,t,r,o,n,a,i){return new WritableStream({start(r){e._writableController=r;try{const t=r.signal;void 0!==t&&t.addEventListener("abort",(()=>{"writable"===e._writableState&&(e._writableState="erroring",t.reason&&(e._writableStoredError=t.reason))}))}catch(e){}return p(t(),(()=>(e._writableStarted=!0,Cr(e),null)),(t=>{throw e._writableStarted=!0,Rr(e,t),t}))},write:t=>(function(e){e._writableHasInFlightOperation=!0}(e),p(r(t),(()=>(function(e){e._writableHasInFlightOperation=!1}(e),Cr(e),null)),(t=>{throw function(e,t){e._writableHasInFlightOperation=!1,Rr(e,t)}(e,t),t}))),close:()=>(function(e){e._writableHasInFlightOperation=!0}(e),p(o(),(()=>(function(e){e._writableHasInFlightOperation=!1;"erroring"===e._writableState&&(e._writableStoredError=void 0);e._writableState="closed"}(e),null)),(t=>{throw function(e,t){e._writableHasInFlightOperation=!1,e._writableState,Rr(e,t)}(e,t),t}))),abort:t=>(e._writableState="errored",e._writableStoredError=t,n(t))},{highWaterMark:a,size:i})}(e,i,l,u,s,r,o),e._readableState="readable",e._readableStoredError=void 0,e._readableCloseRequested=!1,e._readablePulling=!1,e._readable=function(e,t,r,o,n,a){return new ReadableStream({start:r=>(e._readableController=r,t().catch((t=>{Sr(e,t)}))),pull:()=>(e._readablePulling=!0,r().catch((t=>{Sr(e,t)}))),cancel:t=>(e._readableState="closed",o(t))},{highWaterMark:n,size:a})}(e,i,d,f,n,a),e._backpressure=void 0,e._backpressureChangePromise=void 0,e._backpressureChangePromise_resolve=void 0,fr(e,!0),e._transformStreamController=void 0}(this,u((e=>{b=e})),s,f,i,l),function(e,t){const r=Object.create(TransformStreamDefaultController.prototype);let o,n;o=void 0!==t.transform?e=>t.transform(e,r):e=>{try{return _r(r,e),c(void 0)}catch(e){return d(e)}};n=void 0!==t.flush?()=>t.flush(r):()=>c(void 0);!function(e,t,r,o){t._controlledTransformStream=e,e._transformStreamController=t,t._transformAlgorithm=r,t._flushAlgorithm=o}(e,r,o,n)}(this,a),void 0!==a.start?b(a.start(this._transformStreamController)):b(void 0)}get readable(){if(!ur(this))throw yr("readable");return this._readable}get writable(){if(!ur(this))throw yr("writable");return this._writable}}function ur(e){return!!r(e)&&(!!Object.prototype.hasOwnProperty.call(e,"_transformStreamController")&&e instanceof TransformStream)}function cr(e,t){Sr(e,t),dr(e,t)}function dr(e,t){hr(e._transformStreamController),function(e,t){e._writableController.error(t);"writable"===e._writableState&&Tr(e,t)}(e,t),e._backpressure&&fr(e,!1)}function fr(e,t){void 0!==e._backpressureChangePromise&&e._backpressureChangePromise_resolve(),e._backpressureChangePromise=u((t=>{e._backpressureChangePromise_resolve=t})),e._backpressure=t}Object.defineProperties(TransformStream.prototype,{readable:{enumerable:!0},writable:{enumerable:!0}}),"symbol"==typeof e.toStringTag&&Object.defineProperty(TransformStream.prototype,e.toStringTag,{value:"TransformStream",configurable:!0});class TransformStreamDefaultController{constructor(){throw new TypeError("Illegal constructor")}get desiredSize(){if(!br(this))throw mr("desiredSize");return vr(this._controlledTransformStream)}enqueue(e){if(!br(this))throw mr("enqueue");_r(this,e)}error(e){if(!br(this))throw mr("error");var t;t=e,cr(this._controlledTransformStream,t)}terminate(){if(!br(this))throw mr("terminate");!function(e){const t=e._controlledTransformStream;gr(t)&&wr(t);const r=new TypeError("TransformStream terminated");dr(t,r)}(this)}}function br(e){return!!r(e)&&(!!Object.prototype.hasOwnProperty.call(e,"_controlledTransformStream")&&e instanceof TransformStreamDefaultController)}function hr(e){e._transformAlgorithm=void 0,e._flushAlgorithm=void 0}function _r(e,t){const r=e._controlledTransformStream;if(!gr(r))throw new TypeError("Readable side is not in a state that permits enqueue");try{!function(e,t){e._readablePulling=!1;try{e._readableController.enqueue(t)}catch(t){throw Sr(e,t),t}}(r,t)}catch(e){throw dr(r,e),r._readableStoredError}const o=function(e){return!function(e){if(!gr(e))return!1;if(e._readablePulling)return!0;if(vr(e)>0)return!0;return!1}(e)}(r);o!==r._backpressure&&fr(r,!0)}function pr(e,t){return p(e._transformAlgorithm(t),void 0,(t=>{throw cr(e._controlledTransformStream,t),t}))}function mr(e){return new TypeError(`TransformStreamDefaultController.prototype.${e} can only be used on a TransformStreamDefaultController`)}function yr(e){return new TypeError(`TransformStream.prototype.${e} can only be used on a TransformStream`)}function gr(e){return!e._readableCloseRequested&&"readable"===e._readableState}function wr(e){e._readableState="closed",e._readableCloseRequested=!0,e._readableController.close()}function Sr(e,t){"readable"===e._readableState&&(e._readableState="errored",e._readableStoredError=t),e._readableController.error(t)}function vr(e){return e._readableController.desiredSize}function Rr(e,t){"writable"!==e._writableState?qr(e):Tr(e,t)}function Tr(e,t){e._writableState="erroring",e._writableStoredError=t,!function(e){return e._writableHasInFlightOperation}(e)&&e._writableStarted&&qr(e)}function qr(e){e._writableState="errored"}function Cr(e){"erroring"===e._writableState&&qr(e)}Object.defineProperties(TransformStreamDefaultController.prototype,{enqueue:{enumerable:!0},error:{enumerable:!0},terminate:{enumerable:!0},desiredSize:{enumerable:!0}}),n(TransformStreamDefaultController.prototype.enqueue,"enqueue"),n(TransformStreamDefaultController.prototype.error,"error"),n(TransformStreamDefaultController.prototype.terminate,"terminate"),"symbol"==typeof e.toStringTag&&Object.defineProperty(TransformStreamDefaultController.prototype,e.toStringTag,{value:"TransformStreamDefaultController",configurable:!0});

// EXTERNAL MODULE: ../../node_modules/.pnpm/formdata-node@4.4.1/node_modules/formdata-node/lib/esm/isFunction.js
var isFunction = __webpack_require__(40279);
;// CONCATENATED MODULE: ../../node_modules/.pnpm/formdata-node@4.4.1/node_modules/formdata-node/lib/esm/blobHelpers.js
/*! Based on fetch-blob. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> & David Frank */

const CHUNK_SIZE = 65536;
async function* clonePart(part) {
    const end = part.byteOffset + part.byteLength;
    let position = part.byteOffset;
    while (position !== end) {
        const size = Math.min(end - position, CHUNK_SIZE);
        const chunk = part.buffer.slice(position, position + size);
        position += chunk.byteLength;
        yield new Uint8Array(chunk);
    }
}
async function* consumeNodeBlob(blob) {
    let position = 0;
    while (position !== blob.size) {
        const chunk = blob.slice(position, Math.min(blob.size, position + CHUNK_SIZE));
        const buffer = await chunk.arrayBuffer();
        position += buffer.byteLength;
        yield new Uint8Array(buffer);
    }
}
async function* consumeBlobParts(parts, clone = false) {
    for (const part of parts) {
        if (ArrayBuffer.isView(part)) {
            if (clone) {
                yield* clonePart(part);
            }
            else {
                yield part;
            }
        }
        else if ((0,isFunction/* isFunction */.T)(part.stream)) {
            yield* part.stream();
        }
        else {
            yield* consumeNodeBlob(part);
        }
    }
}
function* sliceBlob(blobParts, blobSize, start = 0, end) {
    end !== null && end !== void 0 ? end : (end = blobSize);
    let relativeStart = start < 0
        ? Math.max(blobSize + start, 0)
        : Math.min(start, blobSize);
    let relativeEnd = end < 0
        ? Math.max(blobSize + end, 0)
        : Math.min(end, blobSize);
    const span = Math.max(relativeEnd - relativeStart, 0);
    let added = 0;
    for (const part of blobParts) {
        if (added >= span) {
            break;
        }
        const partSize = ArrayBuffer.isView(part) ? part.byteLength : part.size;
        if (relativeStart && partSize <= relativeStart) {
            relativeStart -= partSize;
            relativeEnd -= partSize;
        }
        else {
            let chunk;
            if (ArrayBuffer.isView(part)) {
                chunk = part.subarray(relativeStart, Math.min(partSize, relativeEnd));
                added += chunk.byteLength;
            }
            else {
                chunk = part.slice(relativeStart, Math.min(partSize, relativeEnd));
                added += chunk.size;
            }
            relativeEnd -= partSize;
            relativeStart = 0;
            yield chunk;
        }
    }
}

;// CONCATENATED MODULE: ../../node_modules/.pnpm/formdata-node@4.4.1/node_modules/formdata-node/lib/esm/Blob.js
/*! Based on fetch-blob. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> & David Frank */
var __classPrivateFieldGet = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var _Blob_parts, _Blob_type, _Blob_size;



class Blob {
    constructor(blobParts = [], options = {}) {
        _Blob_parts.set(this, []);
        _Blob_type.set(this, "");
        _Blob_size.set(this, 0);
        options !== null && options !== void 0 ? options : (options = {});
        if (typeof blobParts !== "object" || blobParts === null) {
            throw new TypeError("Failed to construct 'Blob': "
                + "The provided value cannot be converted to a sequence.");
        }
        if (!(0,isFunction/* isFunction */.T)(blobParts[Symbol.iterator])) {
            throw new TypeError("Failed to construct 'Blob': "
                + "The object must have a callable @@iterator property.");
        }
        if (typeof options !== "object" && !(0,isFunction/* isFunction */.T)(options)) {
            throw new TypeError("Failed to construct 'Blob': parameter 2 cannot convert to dictionary.");
        }
        const encoder = new TextEncoder();
        for (const raw of blobParts) {
            let part;
            if (ArrayBuffer.isView(raw)) {
                part = new Uint8Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
            }
            else if (raw instanceof ArrayBuffer) {
                part = new Uint8Array(raw.slice(0));
            }
            else if (raw instanceof Blob) {
                part = raw;
            }
            else {
                part = encoder.encode(String(raw));
            }
            __classPrivateFieldSet(this, _Blob_size, __classPrivateFieldGet(this, _Blob_size, "f") + (ArrayBuffer.isView(part) ? part.byteLength : part.size), "f");
            __classPrivateFieldGet(this, _Blob_parts, "f").push(part);
        }
        const type = options.type === undefined ? "" : String(options.type);
        __classPrivateFieldSet(this, _Blob_type, /^[\x20-\x7E]*$/.test(type) ? type : "", "f");
    }
    static [(_Blob_parts = new WeakMap(), _Blob_type = new WeakMap(), _Blob_size = new WeakMap(), Symbol.hasInstance)](value) {
        return Boolean(value
            && typeof value === "object"
            && (0,isFunction/* isFunction */.T)(value.constructor)
            && ((0,isFunction/* isFunction */.T)(value.stream)
                || (0,isFunction/* isFunction */.T)(value.arrayBuffer))
            && /^(Blob|File)$/.test(value[Symbol.toStringTag]));
    }
    get type() {
        return __classPrivateFieldGet(this, _Blob_type, "f");
    }
    get size() {
        return __classPrivateFieldGet(this, _Blob_size, "f");
    }
    slice(start, end, contentType) {
        return new Blob(sliceBlob(__classPrivateFieldGet(this, _Blob_parts, "f"), this.size, start, end), {
            type: contentType
        });
    }
    async text() {
        const decoder = new TextDecoder();
        let result = "";
        for await (const chunk of consumeBlobParts(__classPrivateFieldGet(this, _Blob_parts, "f"))) {
            result += decoder.decode(chunk, { stream: true });
        }
        result += decoder.decode();
        return result;
    }
    async arrayBuffer() {
        const view = new Uint8Array(this.size);
        let offset = 0;
        for await (const chunk of consumeBlobParts(__classPrivateFieldGet(this, _Blob_parts, "f"))) {
            view.set(chunk, offset);
            offset += chunk.length;
        }
        return view.buffer;
    }
    stream() {
        const iterator = consumeBlobParts(__classPrivateFieldGet(this, _Blob_parts, "f"), true);
        return new ReadableStream({
            async pull(controller) {
                const { value, done } = await iterator.next();
                if (done) {
                    return queueMicrotask(() => controller.close());
                }
                controller.enqueue(value);
            },
            async cancel() {
                await iterator.return();
            }
        });
    }
    get [Symbol.toStringTag]() {
        return "Blob";
    }
}
Object.defineProperties(Blob.prototype, {
    type: { enumerable: true },
    size: { enumerable: true },
    slice: { enumerable: true },
    stream: { enumerable: true },
    text: { enumerable: true },
    arrayBuffer: { enumerable: true }
});


/***/ }),

/***/ 75505:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Z: () => (/* binding */ File)
/* harmony export */ });
/* harmony import */ var _Blob_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(31183);
var __classPrivateFieldSet = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _File_name, _File_lastModified;

class File extends _Blob_js__WEBPACK_IMPORTED_MODULE_0__/* .Blob */ .Y {
    constructor(fileBits, name, options = {}) {
        super(fileBits, options);
        _File_name.set(this, void 0);
        _File_lastModified.set(this, 0);
        if (arguments.length < 2) {
            throw new TypeError("Failed to construct 'File': 2 arguments required, "
                + `but only ${arguments.length} present.`);
        }
        __classPrivateFieldSet(this, _File_name, String(name), "f");
        const lastModified = options.lastModified === undefined
            ? Date.now()
            : Number(options.lastModified);
        if (!Number.isNaN(lastModified)) {
            __classPrivateFieldSet(this, _File_lastModified, lastModified, "f");
        }
    }
    static [(_File_name = new WeakMap(), _File_lastModified = new WeakMap(), Symbol.hasInstance)](value) {
        return value instanceof _Blob_js__WEBPACK_IMPORTED_MODULE_0__/* .Blob */ .Y
            && value[Symbol.toStringTag] === "File"
            && typeof value.name === "string";
    }
    get name() {
        return __classPrivateFieldGet(this, _File_name, "f");
    }
    get lastModified() {
        return __classPrivateFieldGet(this, _File_lastModified, "f");
    }
    get webkitRelativePath() {
        return "";
    }
    get [Symbol.toStringTag]() {
        return "File";
    }
}


/***/ }),

/***/ 68838:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  YQ: () => (/* reexport */ Blob/* Blob */.Y),
  ZH: () => (/* reexport */ File/* File */.Z),
  fS: () => (/* reexport */ FormData)
});

// EXTERNAL MODULE: external "util"
var external_util_ = __webpack_require__(39023);
// EXTERNAL MODULE: ../../node_modules/.pnpm/formdata-node@4.4.1/node_modules/formdata-node/lib/esm/File.js
var File = __webpack_require__(75505);
// EXTERNAL MODULE: ../../node_modules/.pnpm/formdata-node@4.4.1/node_modules/formdata-node/lib/esm/isFile.js
var isFile = __webpack_require__(16825);
// EXTERNAL MODULE: ../../node_modules/.pnpm/formdata-node@4.4.1/node_modules/formdata-node/lib/esm/Blob.js + 2 modules
var Blob = __webpack_require__(31183);
;// CONCATENATED MODULE: ../../node_modules/.pnpm/formdata-node@4.4.1/node_modules/formdata-node/lib/esm/isBlob.js

const isBlob = (value) => value instanceof Blob/* Blob */.Y;

// EXTERNAL MODULE: ../../node_modules/.pnpm/formdata-node@4.4.1/node_modules/formdata-node/lib/esm/isFunction.js
var isFunction = __webpack_require__(40279);
;// CONCATENATED MODULE: ../../node_modules/.pnpm/formdata-node@4.4.1/node_modules/formdata-node/lib/esm/deprecateConstructorEntries.js

const deprecateConstructorEntries = (0,external_util_.deprecate)(() => { }, "Constructor \"entries\" argument is not spec-compliant "
    + "and will be removed in next major release.");

;// CONCATENATED MODULE: ../../node_modules/.pnpm/formdata-node@4.4.1/node_modules/formdata-node/lib/esm/FormData.js
var __classPrivateFieldGet = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _FormData_instances, _FormData_entries, _FormData_setEntry;






class FormData {
    constructor(entries) {
        _FormData_instances.add(this);
        _FormData_entries.set(this, new Map());
        if (entries) {
            deprecateConstructorEntries();
            entries.forEach(({ name, value, fileName }) => this.append(name, value, fileName));
        }
    }
    static [(_FormData_entries = new WeakMap(), _FormData_instances = new WeakSet(), Symbol.hasInstance)](value) {
        return Boolean(value
            && (0,isFunction/* isFunction */.T)(value.constructor)
            && value[Symbol.toStringTag] === "FormData"
            && (0,isFunction/* isFunction */.T)(value.append)
            && (0,isFunction/* isFunction */.T)(value.set)
            && (0,isFunction/* isFunction */.T)(value.get)
            && (0,isFunction/* isFunction */.T)(value.getAll)
            && (0,isFunction/* isFunction */.T)(value.has)
            && (0,isFunction/* isFunction */.T)(value.delete)
            && (0,isFunction/* isFunction */.T)(value.entries)
            && (0,isFunction/* isFunction */.T)(value.values)
            && (0,isFunction/* isFunction */.T)(value.keys)
            && (0,isFunction/* isFunction */.T)(value[Symbol.iterator])
            && (0,isFunction/* isFunction */.T)(value.forEach));
    }
    append(name, value, fileName) {
        __classPrivateFieldGet(this, _FormData_instances, "m", _FormData_setEntry).call(this, {
            name,
            fileName,
            append: true,
            rawValue: value,
            argsLength: arguments.length
        });
    }
    set(name, value, fileName) {
        __classPrivateFieldGet(this, _FormData_instances, "m", _FormData_setEntry).call(this, {
            name,
            fileName,
            append: false,
            rawValue: value,
            argsLength: arguments.length
        });
    }
    get(name) {
        const field = __classPrivateFieldGet(this, _FormData_entries, "f").get(String(name));
        if (!field) {
            return null;
        }
        return field[0];
    }
    getAll(name) {
        const field = __classPrivateFieldGet(this, _FormData_entries, "f").get(String(name));
        if (!field) {
            return [];
        }
        return field.slice();
    }
    has(name) {
        return __classPrivateFieldGet(this, _FormData_entries, "f").has(String(name));
    }
    delete(name) {
        __classPrivateFieldGet(this, _FormData_entries, "f").delete(String(name));
    }
    *keys() {
        for (const key of __classPrivateFieldGet(this, _FormData_entries, "f").keys()) {
            yield key;
        }
    }
    *entries() {
        for (const name of this.keys()) {
            const values = this.getAll(name);
            for (const value of values) {
                yield [name, value];
            }
        }
    }
    *values() {
        for (const [, value] of this) {
            yield value;
        }
    }
    [(_FormData_setEntry = function _FormData_setEntry({ name, rawValue, append, fileName, argsLength }) {
        const methodName = append ? "append" : "set";
        if (argsLength < 2) {
            throw new TypeError(`Failed to execute '${methodName}' on 'FormData': `
                + `2 arguments required, but only ${argsLength} present.`);
        }
        name = String(name);
        let value;
        if ((0,isFile/* isFile */.f)(rawValue)) {
            value = fileName === undefined
                ? rawValue
                : new File/* File */.Z([rawValue], fileName, {
                    type: rawValue.type,
                    lastModified: rawValue.lastModified
                });
        }
        else if (isBlob(rawValue)) {
            value = new File/* File */.Z([rawValue], fileName === undefined ? "blob" : fileName, {
                type: rawValue.type
            });
        }
        else if (fileName) {
            throw new TypeError(`Failed to execute '${methodName}' on 'FormData': `
                + "parameter 2 is not of type 'Blob'.");
        }
        else {
            value = String(rawValue);
        }
        const values = __classPrivateFieldGet(this, _FormData_entries, "f").get(name);
        if (!values) {
            return void __classPrivateFieldGet(this, _FormData_entries, "f").set(name, [value]);
        }
        if (!append) {
            return void __classPrivateFieldGet(this, _FormData_entries, "f").set(name, [value]);
        }
        values.push(value);
    }, Symbol.iterator)]() {
        return this.entries();
    }
    forEach(callback, thisArg) {
        for (const [name, value] of this) {
            callback.call(thisArg, value, name, this);
        }
    }
    get [Symbol.toStringTag]() {
        return "FormData";
    }
    [external_util_.inspect.custom]() {
        return this[Symbol.toStringTag];
    }
}

;// CONCATENATED MODULE: ../../node_modules/.pnpm/formdata-node@4.4.1/node_modules/formdata-node/lib/esm/index.js





/***/ }),

/***/ 16825:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   f: () => (/* binding */ isFile)
/* harmony export */ });
/* harmony import */ var _File_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(75505);

const isFile = (value) => value instanceof _File_js__WEBPACK_IMPORTED_MODULE_0__/* .File */ .Z;


/***/ }),

/***/ 40279:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   T: () => (/* binding */ isFunction)
/* harmony export */ });
const isFunction = (value) => (typeof value === "function");


/***/ })

};
;