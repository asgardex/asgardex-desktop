let wasm;

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_export_2.set(idx, obj);
    return idx;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

let WASM_VECTOR_LEN = 0;

const cachedTextEncoder = (typeof TextEncoder !== 'undefined' ? new TextEncoder('utf-8') : { encode: () => { throw Error('TextEncoder not available') } } );

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_export_2.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

function passArrayJsValueToWasm0(array, malloc) {
    const ptr = malloc(array.length * 4, 4) >>> 0;
    for (let i = 0; i < array.length; i++) {
        const add = addToExternrefTable0(array[i]);
        getDataViewMemory0().setUint32(ptr + 4 * i, add, true);
    }
    WASM_VECTOR_LEN = array.length;
    return ptr;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_export_2.get(mem.getUint32(i, true)));
    }
    wasm.__externref_drop_slice(ptr, len);
    return result;
}

const KeyExportSessionFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_keyexportsession_free(ptr >>> 0, 1));

export class KeyExportSession {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(KeyExportSession.prototype);
        obj.__wbg_ptr = ptr;
        KeyExportSessionFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        KeyExportSessionFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_keyexportsession_free(ptr, 0);
    }
    /**
     * @param {Keyshare} share
     * @param {string[]} ids
     * @returns {KeyExportSession}
     */
    static new(share, ids) {
        _assertClass(share, Keyshare);
        const ptr0 = passArrayJsValueToWasm0(ids, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.keyexportsession_new(share.__wbg_ptr, ptr0, len0);
        return KeyExportSession.__wrap(ret);
    }
    /**
     * Setup message for the session.
     * @returns {Uint8Array}
     */
    get setup() {
        const ret = wasm.keyexportsession_setup(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Handle an input message. If processing of the input message moves the
     * session into some final state then it will return `true`.
     *
     * Passing messages out of order is OK.
     *
     * Invalid messages will be silently ignored.
     * @param {Uint8Array} msg
     * @returns {boolean}
     */
    inputMessage(msg) {
        const ptr0 = passArray8ToWasm0(msg, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.keyexportsession_inputMessage(this.__wbg_ptr, ptr0, len0);
        return ret !== 0;
    }
    /**
     * Finish the session and return resulting secret key.
     * @returns {Uint8Array}
     */
    finish() {
        const ret = wasm.keyexportsession_finish(this.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Return encrypted secret material from passed key share.
     * @param {Uint8Array} setup
     * @param {string} id
     * @param {Keyshare} share
     * @returns {Message}
     */
    static exportShare(setup, id, share) {
        const ptr0 = passArray8ToWasm0(setup, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        _assertClass(share, Keyshare);
        const ret = wasm.keyexportsession_exportShare(ptr0, len0, ptr1, len1, share.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Message.__wrap(ret[0]);
    }
}

const KeyImportInitiatorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_keyimportinitiator_free(ptr >>> 0, 1));

export class KeyImportInitiator {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        KeyImportInitiatorFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_keyimportinitiator_free(ptr, 0);
    }
    /**
     * Create session for key import initiator and setup message for
     * rest of parties.
     *
     * # Arguments
     *
     * * `private_key` - Private key to import
     *
     * * `root_chain` - Optional root chain code
     *
     * * `threshold` - Signature threshold
     *
     * * `ids` - List of human readable identifiers.
     *   The initiator is first in the list
     * @param {Uint8Array} private_key
     * @param {Uint8Array | null | undefined} root_chain
     * @param {number} threshold
     * @param {string[]} ids
     */
    constructor(private_key, root_chain, threshold, ids) {
        const ptr0 = passArray8ToWasm0(private_key, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(root_chain) ? 0 : passArray8ToWasm0(root_chain, wasm.__wbindgen_malloc);
        var len1 = WASM_VECTOR_LEN;
        const ptr2 = passArrayJsValueToWasm0(ids, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.keyimportinitiator_new(ptr0, len0, ptr1, len1, threshold, ptr2, len2);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        KeyImportInitiatorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Setup message for the key importers.
     * @returns {Uint8Array}
     */
    get setup() {
        const ret = wasm.keyimportinitiator_setup(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Get next output message. If no pending output message available,
     * `undefined` will be returned.
     *
     * Messages are authenticated and encrypted if required.
     * @returns {Message | undefined}
     */
    outputMessage() {
        const ret = wasm.keyimportinitiator_outputMessage(this.__wbg_ptr);
        return ret === 0 ? undefined : Message.__wrap(ret);
    }
    /**
     * Handle an input message. If processing of the input message moves the
     * session into some final state then it will return `true`.
     *
     * Passing messages out of order is OK.
     *
     * Invalid messages will be silently ignored.
     * @param {Uint8Array} msg
     * @returns {boolean}
     */
    inputMessage(msg) {
        const ptr0 = passArray8ToWasm0(msg, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.keyimportinitiator_inputMessage(this.__wbg_ptr, ptr0, len0);
        return ret !== 0;
    }
    /**
     * Finish the session and return resulting key share.
     * @returns {Keyshare}
     */
    finish() {
        const ret = wasm.keyimportinitiator_finish(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Keyshare.__wrap(ret[0]);
    }
}

const KeyImportSessionFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_keyimportsession_free(ptr >>> 0, 1));

export class KeyImportSession {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        KeyImportSessionFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_keyimportsession_free(ptr, 0);
    }
    /**
     * Join key import protocol execution.
     *
     * # Arguments
     *
     * * `setup` - Setup message generated by `KeyImportInitiator`
     *
     * * `id` - Human readable ID of the participant
     * @param {Uint8Array} setup
     * @param {string} id
     */
    constructor(setup, id) {
        const ptr0 = passArray8ToWasm0(setup, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.keyimportsession_new(ptr0, len0, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return KeyImporterSession.__wrap(ret[0]);
    }
    /**
     * Get next output message. If no pending output message available,
     * `undefined` will be returned.
     *
     * Messages are authenticated and encrypted if required.
     * @returns {Message | undefined}
     */
    outputMessage() {
        const ret = wasm.keyimportsession_outputMessage(this.__wbg_ptr);
        return ret === 0 ? undefined : Message.__wrap(ret);
    }
    /**
     * Handle an input message. If processing of the input message moves the
     * session into some final state then it will return `true`.
     *
     * Passing messages out of order is OK.
     *
     * Invalid messages will be silently ignored.
     * @param {Uint8Array} msg
     * @returns {boolean}
     */
    inputMessage(msg) {
        const ptr0 = passArray8ToWasm0(msg, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.keyimportsession_inputMessage(this.__wbg_ptr, ptr0, len0);
        return ret !== 0;
    }
    /**
     * Finish the session and return resulting key share.
     * @returns {Keyshare}
     */
    finish() {
        const ret = wasm.keyimportsession_finish(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Keyshare.__wrap(ret[0]);
    }
}

const KeyImporterSessionFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_keyimportersession_free(ptr >>> 0, 1));

export class KeyImporterSession {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(KeyImporterSession.prototype);
        obj.__wbg_ptr = ptr;
        KeyImporterSessionFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        KeyImporterSessionFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_keyimportersession_free(ptr, 0);
    }
}

const KeygenSessionFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_keygensession_free(ptr >>> 0, 1));

export class KeygenSession {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(KeygenSession.prototype);
        obj.__wbg_ptr = ptr;
        KeygenSessionFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        KeygenSessionFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_keygensession_free(ptr, 0);
    }
    /**
     * Allocate new key generation session
     *
     * # Arguments
     *
     * * `setup` - A setup message created by `KeygenSession.setup`
     *
     * * `id`    - A human readable party identifier
     * @param {Uint8Array} setup
     * @param {string} id
     */
    constructor(setup, id) {
        const ptr0 = passArray8ToWasm0(setup, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.keygensession_new(ptr0, len0, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        KeygenSessionFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Allocate new key refresh session
     *
     * # Arguments
     *
     * * `setup`     - A setup message created by `KeygenSession.setup`
     *
     * * `id`        - A human readable party identifier
     *
     * * `old_Share` - Old key share
     * @param {Uint8Array} setup
     * @param {string} id
     * @param {Keyshare} old_keyshare
     * @returns {KeygenSession}
     */
    static refresh(setup, id, old_keyshare) {
        const ptr0 = passArray8ToWasm0(setup, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        _assertClass(old_keyshare, Keyshare);
        const ret = wasm.keygensession_refresh(ptr0, len0, ptr1, len1, old_keyshare.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return KeygenSession.__wrap(ret[0]);
    }
    /**
     * Allocate new key migration session
     *
     * # Arguments
     *
     * * `setup`     - A setup message created by `KeygenSession.setup`
     *
     * * `id`        - A human readable party identifier
     *
     * * `s_i_0` - The additive share of the party such that Σ(s_i_0) = private key , 0<=i<=n
     *
     * * `publickey` - The generic common public key
     *
     * * `rootChainCode` - The root chain code
     * @param {Uint8Array} setup
     * @param {string} id
     * @param {Uint8Array} s_i_0
     * @param {Uint8Array} public_key
     * @param {Uint8Array} root_chain_code
     * @returns {KeygenSession}
     */
    static migrate(setup, id, s_i_0, public_key, root_chain_code) {
        const ptr0 = passArray8ToWasm0(setup, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(s_i_0, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArray8ToWasm0(public_key, wasm.__wbindgen_malloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passArray8ToWasm0(root_chain_code, wasm.__wbindgen_malloc);
        const len4 = WASM_VECTOR_LEN;
        const ret = wasm.keygensession_migrate(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return KeygenSession.__wrap(ret[0]);
    }
    /**
     * Create a new DKG setup message.
     *
     * # Arguments
     *
     * * `key_id`    - Optional array of 32 bytes to identify an existing
     *                 key share for key refresh.
     *
     * * `threshold` - Threshold parameter.
     *
     * * `ids`       - Array of party identities.
     * @param {Uint8Array | null | undefined} key_id
     * @param {number} threshold
     * @param {string[]} ids
     * @returns {Uint8Array}
     */
    static setup(key_id, threshold, ids) {
        var ptr0 = isLikeNone(key_id) ? 0 : passArray8ToWasm0(key_id, wasm.__wbindgen_malloc);
        var len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayJsValueToWasm0(ids, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.keygensession_setup(ptr0, len0, threshold, ptr1, len1);
        var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v3;
    }
    /**
     * Extract key ID from a setup message.
     * @param {Uint8Array} setup_msg
     * @returns {Uint8Array | undefined}
     */
    static setupKeyId(setup_msg) {
        const ptr0 = passArray8ToWasm0(setup_msg, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.keygensession_setupKeyId(ptr0, len0);
        let v2;
        if (ret[0] !== 0) {
            v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v2;
    }
    /**
     * Get next output message. If no pending output message available,
     * `undefined` will be returned.
     *
     * Messages are authenticated and encrypted if required.
     * @returns {Message | undefined}
     */
    outputMessage() {
        const ret = wasm.keygensession_outputMessage(this.__wbg_ptr);
        return ret === 0 ? undefined : Message.__wrap(ret);
    }
    /**
     * Handle an input message. If processing of the input message moves the
     * session into some final state then it will return `true`.
     *
     * Passing messages out of order is OK.
     *
     * Invalid messages will be silently ignored.
     * @param {Uint8Array} msg
     * @returns {boolean}
     */
    inputMessage(msg) {
        const ptr0 = passArray8ToWasm0(msg, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.keygensession_inputMessage(this.__wbg_ptr, ptr0, len0);
        return ret !== 0;
    }
    /**
     * Finish the session and return resulting key share.
     * @returns {Keyshare}
     */
    finish() {
        const ret = wasm.keygensession_finish(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Keyshare.__wrap(ret[0]);
    }
}

const KeyshareFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_keyshare_free(ptr >>> 0, 1));

export class Keyshare {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Keyshare.prototype);
        obj.__wbg_ptr = ptr;
        KeyshareFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        KeyshareFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_keyshare_free(ptr, 0);
    }
    /**
     * Return public key as compressed encoding of the public key.
     * @returns {Uint8Array}
     */
    publicKey() {
        const ret = wasm.keyshare_publicKey(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Return key Id.
     * @returns {Uint8Array}
     */
    keyId() {
        const ret = wasm.keyshare_keyId(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Serialize the keyshare into array of bytes.
     * @returns {Uint8Array}
     */
    toBytes() {
        const ret = wasm.keyshare_toBytes(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Deserialize keyshare from the array of bytes.
     * @param {Uint8Array} bytes
     * @returns {Keyshare}
     */
    static fromBytes(bytes) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.keyshare_fromBytes(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Keyshare.__wrap(ret[0]);
    }
    /**
     * Returns the common  chaincode that has been computed at keygen
     * @returns {Uint8Array}
     */
    rootChainCode() {
        const ret = wasm.keyshare_rootChainCode(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
}

const MessageFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_message_free(ptr >>> 0, 1));

export class Message {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Message.prototype);
        obj.__wbg_ptr = ptr;
        MessageFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MessageFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_message_free(ptr, 0);
    }
    /**
     * Body of the message
     * @returns {Uint8Array}
     */
    get body() {
        const ret = wasm.message_body(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * A list of message receviers.
     * @returns {string[]}
     */
    get receivers() {
        const ret = wasm.message_receivers(this.__wbg_ptr);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
}

const QcSessionFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_qcsession_free(ptr >>> 0, 1));

export class QcSession {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        QcSessionFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_qcsession_free(ptr, 0);
    }
    /**
     * Allocate new QC session
     *
     * # Arguments
     *
     * * `setup` - A setup message created by `QcSession.setup`
     *
     * * `id`    - A human readable party identifier
     *
     * * `keyshare` - Optional keyshare, passed to "old" parties
     * @param {Uint8Array} setup
     * @param {string} id
     * @param {Keyshare | null} [keyshare]
     */
    constructor(setup, id, keyshare) {
        const ptr0 = passArray8ToWasm0(setup, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        let ptr2 = 0;
        if (!isLikeNone(keyshare)) {
            _assertClass(keyshare, Keyshare);
            ptr2 = keyshare.__destroy_into_raw();
        }
        const ret = wasm.qcsession_new(ptr0, len0, ptr1, len1, ptr2);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        QcSessionFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Create a new QC setup message.
     *
     * # Arguments
     *
     * * `keyshare`  - keyshare.
     *
     * * `ids`       - Array of party identities.
     *
     * * `olds`      - Array of indices of old parties.
     *
     * * `threshold` - New threshold parameter.
     *
     * * `news`      - Array of indices of new parties.
     * @param {Keyshare} keyshare
     * @param {string[]} ids
     * @param {Uint8Array} olds
     * @param {number} threshold
     * @param {Uint8Array} news
     * @returns {Uint8Array}
     */
    static setup(keyshare, ids, olds, threshold, news) {
        _assertClass(keyshare, Keyshare);
        const ptr0 = passArrayJsValueToWasm0(ids, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(olds, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(news, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.qcsession_setup(keyshare.__wbg_ptr, ptr0, len0, ptr1, len1, threshold, ptr2, len2);
        var v4 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v4;
    }
    /**
     * Extract key ID from a setup message.
     * @param {Uint8Array} setup_msg
     * @returns {Uint8Array | undefined}
     */
    static setupKeyId(setup_msg) {
        const ptr0 = passArray8ToWasm0(setup_msg, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.qcsession_setupKeyId(ptr0, len0);
        let v2;
        if (ret[0] !== 0) {
            v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v2;
    }
    /**
     * Get next output message. If no pending output message available,
     * `undefined` will be returned.
     *
     * Messages are authenticated and encrypted if required.
     * @returns {Message | undefined}
     */
    outputMessage() {
        const ret = wasm.qcsession_outputMessage(this.__wbg_ptr);
        return ret === 0 ? undefined : Message.__wrap(ret);
    }
    /**
     * Handle an input message. If processing of the input message moves the
     * session into some final state then it will return `true`.
     *
     * Passing messages out of order is OK.
     *
     * Invalid messages will be silently ignored.
     * @param {Uint8Array} msg
     * @returns {boolean}
     */
    inputMessage(msg) {
        const ptr0 = passArray8ToWasm0(msg, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.qcsession_inputMessage(this.__wbg_ptr, ptr0, len0);
        return ret !== 0;
    }
    /**
     * Finish the session and return resulting keyshare for new
     * parties or `undefined` for old parties.
     * @returns {Keyshare | undefined}
     */
    finish() {
        const ret = wasm.qcsession_finish(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] === 0 ? undefined : Keyshare.__wrap(ret[0]);
    }
}

const SignSessionFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_signsession_free(ptr >>> 0, 1));

export class SignSession {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SignSessionFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_signsession_free(ptr, 0);
    }
    /**
     * Allocate a signature generation session
     *
     * # Arguments
     *
     * * `setup` - Setup message created by `SignSession.setup()`
     *
     * * `id`    - Party identifier
     *
     * * `share` - Key share object
     * @param {Uint8Array} setup
     * @param {string} id
     * @param {Keyshare} share
     */
    constructor(setup, id, share) {
        const ptr0 = passStringToWasm0(id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        _assertClass(share, Keyshare);
        const ret = wasm.signsession_new(setup, ptr0, len0, share.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        SignSessionFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Generate a setup message for signature generation session.
     *
     * # Arguments
     *
     * * `key_id`       - 32 bytes array identifing a distributed key
     *
     * * `chain_path`   - Key derivation path
     *
     * * `message`      - message to sign.
     *
     * * `ids`          - Array of party identifiers
     * @param {Uint8Array} key_id
     * @param {string} chain_path
     * @param {Uint8Array} message
     * @param {string[]} ids
     * @returns {Uint8Array}
     */
    static setup(key_id, chain_path, message, ids) {
        const ptr0 = passArray8ToWasm0(key_id, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(chain_path, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(message, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArrayJsValueToWasm0(ids, wasm.__wbindgen_malloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.signsession_setup(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Extract message hash form the setup message.
     * @param {Uint8Array} setup_msg
     * @returns {Uint8Array | undefined}
     */
    static setupMessageHash(setup_msg) {
        const ptr0 = passArray8ToWasm0(setup_msg, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.signsession_setupMessageHash(ptr0, len0);
        let v2;
        if (ret[0] !== 0) {
            v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v2;
    }
    /**
     * Extract key ID from a setup message.
     * @param {Uint8Array} setup_msg
     * @returns {Uint8Array | undefined}
     */
    static setupKeyId(setup_msg) {
        const ptr0 = passArray8ToWasm0(setup_msg, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.signsession_setupKeyId(ptr0, len0);
        let v2;
        if (ret[0] !== 0) {
            v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v2;
    }
    /**
     * Get next output message. If no pending output message available,
     * `undefined` will be returned.
     *
     * Messages are authenticated and encrypted if required.
     * @returns {Message | undefined}
     */
    outputMessage() {
        const ret = wasm.signsession_outputMessage(this.__wbg_ptr);
        return ret === 0 ? undefined : Message.__wrap(ret);
    }
    /**
     * Handle an input message. If processing of the input message moves the
     * session into some final state then it will return `true`.
     *
     * Passing messages out of order is OK.
     *
     * Invalid messages will be silently ignored.
     * @param {Uint8Array} msg
     * @returns {boolean}
     */
    inputMessage(msg) {
        const ptr0 = passArray8ToWasm0(msg, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.signsession_inputMessage(this.__wbg_ptr, ptr0, len0);
        return ret !== 0;
    }
    /**
     * Finish the session and return resulting signature or pre-sign object.
     * @returns {Uint8Array}
     */
    finish() {
        const ret = wasm.signsession_finish(this.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg_buffer_609cc3eee51ed158 = function(arg0) {
        const ret = arg0.buffer;
        return ret;
    };
    imports.wbg.__wbg_call_672a4d21634d4a24 = function() { return handleError(function (arg0, arg1) {
        const ret = arg0.call(arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_call_7cccdd69e0791ae2 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = arg0.call(arg1, arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_crypto_ed58b8e10a292839 = function(arg0) {
        const ret = arg0.crypto;
        return ret;
    };
    imports.wbg.__wbg_getRandomValues_bcb4912f16000dc4 = function() { return handleError(function (arg0, arg1) {
        arg0.getRandomValues(arg1);
    }, arguments) };
    imports.wbg.__wbg_length_a446193dc22c12f8 = function(arg0) {
        const ret = arg0.length;
        return ret;
    };
    imports.wbg.__wbg_msCrypto_0a36e2ec3a343d26 = function(arg0) {
        const ret = arg0.msCrypto;
        return ret;
    };
    imports.wbg.__wbg_new_a12002a7f91c75be = function(arg0) {
        const ret = new Uint8Array(arg0);
        return ret;
    };
    imports.wbg.__wbg_newnoargs_105ed471475aaf50 = function(arg0, arg1) {
        const ret = new Function(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbg_newwithbyteoffsetandlength_d97e637ebe145a9a = function(arg0, arg1, arg2) {
        const ret = new Uint8Array(arg0, arg1 >>> 0, arg2 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_newwithlength_a381634e90c276d4 = function(arg0) {
        const ret = new Uint8Array(arg0 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_node_02999533c4ea02e3 = function(arg0) {
        const ret = arg0.node;
        return ret;
    };
    imports.wbg.__wbg_process_5c1d670bc53614b8 = function(arg0) {
        const ret = arg0.process;
        return ret;
    };
    imports.wbg.__wbg_randomFillSync_ab2cfe79ebbf2740 = function() { return handleError(function (arg0, arg1) {
        arg0.randomFillSync(arg1);
    }, arguments) };
    imports.wbg.__wbg_require_79b1e9274cde3c87 = function() { return handleError(function () {
        const ret = module.require;
        return ret;
    }, arguments) };
    imports.wbg.__wbg_set_65595bdd868b3009 = function(arg0, arg1, arg2) {
        arg0.set(arg1, arg2 >>> 0);
    };
    imports.wbg.__wbg_static_accessor_GLOBAL_88a902d13a557d07 = function() {
        const ret = typeof global === 'undefined' ? null : global;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0 = function() {
        const ret = typeof globalThis === 'undefined' ? null : globalThis;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_SELF_37c5d418e4bf5819 = function() {
        const ret = typeof self === 'undefined' ? null : self;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_WINDOW_5de37043a91a9c40 = function() {
        const ret = typeof window === 'undefined' ? null : window;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_subarray_aa9065fa9dc5df96 = function(arg0, arg1, arg2) {
        const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_versions_c71aa1626a93e0a1 = function(arg0) {
        const ret = arg0.versions;
        return ret;
    };
    imports.wbg.__wbindgen_error_new = function(arg0, arg1) {
        const ret = new Error(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_export_2;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
        ;
    };
    imports.wbg.__wbindgen_is_function = function(arg0) {
        const ret = typeof(arg0) === 'function';
        return ret;
    };
    imports.wbg.__wbindgen_is_object = function(arg0) {
        const val = arg0;
        const ret = typeof(val) === 'object' && val !== null;
        return ret;
    };
    imports.wbg.__wbindgen_is_string = function(arg0) {
        const ret = typeof(arg0) === 'string';
        return ret;
    };
    imports.wbg.__wbindgen_is_undefined = function(arg0) {
        const ret = arg0 === undefined;
        return ret;
    };
    imports.wbg.__wbindgen_memory = function() {
        const ret = wasm.memory;
        return ret;
    };
    imports.wbg.__wbindgen_string_get = function(arg0, arg1) {
        const obj = arg1;
        const ret = typeof(obj) === 'string' ? obj : undefined;
        var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
        const ret = getStringFromWasm0(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };

    return imports;
}

function __wbg_init_memory(imports, memory) {

}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();

    __wbg_init_memory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('vs_schnorr_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    __wbg_init_memory(imports);

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
