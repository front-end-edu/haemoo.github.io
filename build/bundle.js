
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value == null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.59.2 */

    const { Error: Error_1, console: console_1 } = globals;
    const file = "src\\App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[14] = list[i];
    	return child_ctx;
    }

    // (155:2) {#if searchResults.length}
    function create_if_block_3(ctx) {
    	let ul;
    	let each_value = /*searchResults*/ ctx[4];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(ul, file, 155, 4, 4787);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(ul, null);
    				}
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*selectAddress, searchResults*/ 80) {
    				each_value = /*searchResults*/ ctx[4];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(155:2) {#if searchResults.length}",
    		ctx
    	});

    	return block;
    }

    // (157:6) {#each searchResults as result}
    function create_each_block(ctx) {
    	let li;
    	let t_value = /*result*/ ctx[14].label + "";
    	let t;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[8](/*result*/ ctx[14]);
    	}

    	const block = {
    		c: function create() {
    			li = element("li");
    			t = text(t_value);
    			add_location(li, file, 157, 8, 4838);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, t);

    			if (!mounted) {
    				dispose = listen_dev(li, "click", click_handler, false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*searchResults*/ 16 && t_value !== (t_value = /*result*/ ctx[14].label + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(157:6) {#each searchResults as result}",
    		ctx
    	});

    	return block;
    }

    // (166:60) 
    function create_if_block_2(ctx) {
    	let div;
    	let h2;
    	let t1;
    	let p0;
    	let t2;
    	let t3_value = /*weatherData*/ ctx[0].address + "";
    	let t3;
    	let t4;
    	let p1;
    	let t5;
    	let t6_value = /*weatherData*/ ctx[0].temperature + "";
    	let t6;
    	let t7;
    	let p2;
    	let t8;
    	let t9_value = /*weatherData*/ ctx[0].humidity + "";
    	let t9;
    	let t10;
    	let p3;
    	let t11;
    	let t12_value = /*weatherData*/ ctx[0].windSpeed + "";
    	let t12;
    	let t13;
    	let p4;
    	let t14;
    	let t15_value = /*weatherData*/ ctx[0].clouds + "";
    	let t15;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "날씨 정보";
    			t1 = space();
    			p0 = element("p");
    			t2 = text("주소: ");
    			t3 = text(t3_value);
    			t4 = space();
    			p1 = element("p");
    			t5 = text("온도: ");
    			t6 = text(t6_value);
    			t7 = space();
    			p2 = element("p");
    			t8 = text("습도: ");
    			t9 = text(t9_value);
    			t10 = space();
    			p3 = element("p");
    			t11 = text("풍속: ");
    			t12 = text(t12_value);
    			t13 = space();
    			p4 = element("p");
    			t14 = text("구름양: ");
    			t15 = text(t15_value);
    			add_location(h2, file, 167, 6, 5108);
    			add_location(p0, file, 168, 6, 5129);
    			add_location(p1, file, 169, 6, 5168);
    			add_location(p2, file, 170, 6, 5211);
    			add_location(p3, file, 171, 6, 5251);
    			add_location(p4, file, 172, 6, 5292);
    			add_location(div, file, 166, 4, 5096);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h2);
    			append_dev(div, t1);
    			append_dev(div, p0);
    			append_dev(p0, t2);
    			append_dev(p0, t3);
    			append_dev(div, t4);
    			append_dev(div, p1);
    			append_dev(p1, t5);
    			append_dev(p1, t6);
    			append_dev(div, t7);
    			append_dev(div, p2);
    			append_dev(p2, t8);
    			append_dev(p2, t9);
    			append_dev(div, t10);
    			append_dev(div, p3);
    			append_dev(p3, t11);
    			append_dev(p3, t12);
    			append_dev(div, t13);
    			append_dev(div, p4);
    			append_dev(p4, t14);
    			append_dev(p4, t15);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*weatherData*/ 1 && t3_value !== (t3_value = /*weatherData*/ ctx[0].address + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*weatherData*/ 1 && t6_value !== (t6_value = /*weatherData*/ ctx[0].temperature + "")) set_data_dev(t6, t6_value);
    			if (dirty & /*weatherData*/ 1 && t9_value !== (t9_value = /*weatherData*/ ctx[0].humidity + "")) set_data_dev(t9, t9_value);
    			if (dirty & /*weatherData*/ 1 && t12_value !== (t12_value = /*weatherData*/ ctx[0].windSpeed + "")) set_data_dev(t12, t12_value);
    			if (dirty & /*weatherData*/ 1 && t15_value !== (t15_value = /*weatherData*/ ctx[0].clouds + "")) set_data_dev(t15, t15_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(166:60) ",
    		ctx
    	});

    	return block;
    }

    // (164:25) 
    function create_if_block_1(ctx) {
    	let p;
    	let t;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(/*errorMessage*/ ctx[2]);
    			add_location(p, file, 164, 4, 5009);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*errorMessage*/ 4) set_data_dev(t, /*errorMessage*/ ctx[2]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(164:25) ",
    		ctx
    	});

    	return block;
    }

    // (162:2) {#if isLoading}
    function create_if_block(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "날씨 정보를 불러오는 중...";
    			add_location(p, file, 162, 4, 4955);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(162:2) {#if isLoading}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let div;
    	let t0;
    	let input;
    	let t1;
    	let button;
    	let t3;
    	let t4;
    	let mounted;
    	let dispose;
    	let if_block0 = /*searchResults*/ ctx[4].length && create_if_block_3(ctx);

    	function select_block_type(ctx, dirty) {
    		if (/*isLoading*/ ctx[1]) return create_if_block;
    		if (/*errorMessage*/ ctx[2]) return create_if_block_1;
    		if (/*weatherData*/ ctx[0].temperature && /*weatherData*/ ctx[0].humidity) return create_if_block_2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block1 = current_block_type && current_block_type(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			t0 = space();
    			input = element("input");
    			t1 = space();
    			button = element("button");
    			button.textContent = "검색";
    			t3 = space();
    			if (if_block0) if_block0.c();
    			t4 = space();
    			if (if_block1) if_block1.c();
    			attr_dev(div, "id", "map");
    			set_style(div, "width", "100%");
    			set_style(div, "height", "400px");
    			attr_dev(div, "class", "svelte-1ou2gvd");
    			add_location(div, file, 151, 2, 4578);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", "주소 검색...");
    			add_location(input, file, 152, 2, 4637);
    			add_location(button, file, 153, 2, 4709);
    			attr_dev(main, "class", "svelte-1ou2gvd");
    			add_location(main, file, 150, 0, 4569);
    		},
    		l: function claim(nodes) {
    			throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(main, t0);
    			append_dev(main, input);
    			set_input_value(input, /*searchInput*/ ctx[3]);
    			append_dev(main, t1);
    			append_dev(main, button);
    			append_dev(main, t3);
    			if (if_block0) if_block0.m(main, null);
    			append_dev(main, t4);
    			if (if_block1) if_block1.m(main, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[7]),
    					listen_dev(button, "click", /*searchAddress*/ ctx[5], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*searchInput*/ 8 && input.value !== /*searchInput*/ ctx[3]) {
    				set_input_value(input, /*searchInput*/ ctx[3]);
    			}

    			if (/*searchResults*/ ctx[4].length) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_3(ctx);
    					if_block0.c();
    					if_block0.m(main, t4);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if (if_block1) if_block1.d(1);
    				if_block1 = current_block_type && current_block_type(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(main, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block0) if_block0.d();

    			if (if_block1) {
    				if_block1.d();
    			}

    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    async function loadNaverMapsAPI() {
    	return new Promise((resolve, reject) => {
    			const script = document.createElement('script');
    			script.src = 'https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=tbl2cislwz&submodules=geocoder';
    			script.async = true;
    			script.onload = () => resolve();
    			script.onerror = () => reject(new Error('네이버 지도 로드 실패'));
    			document.head.appendChild(script);
    		});
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let map;
    	let weatherData = {};
    	let isLoading = false;
    	let errorMessage = '';
    	let searchInput = '';
    	let currentAddress = '';
    	let currentMarker = null;
    	let searchResults = []; // 검색 결과를 저장할 배열로 수정

    	async function fetchWeatherData(lat, lon) {
    		const API_KEY = '1e657dc0d8ee9f105075aab7719defa8';
    		const units = 'metric';
    		const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${API_KEY}`;
    		$$invalidate(1, isLoading = true);

    		try {
    			const response = await fetch(url);
    			const data = await response.json();

    			if (data.cod === 200) {
    				$$invalidate(0, weatherData = {
    					address: currentAddress,
    					temperature: data.main.temp + '°C',
    					humidity: data.main.humidity + '%',
    					windSpeed: data.wind.speed + ' m/s',
    					clouds: data.clouds.all + '%'
    				});
    			} else {
    				console.error('API 호출에 실패했습니다.', data.message);
    				$$invalidate(2, errorMessage = 'API 호출에 실패했습니다: ' + data.message);
    			}
    		} catch(error) {
    			console.error('날씨 정보를 불러오는 중 오류가 발생했습니다:', error);
    			$$invalidate(2, errorMessage = '날씨 정보를 불러오는 중 오류가 발생했습니다: ' + error.message);
    		} finally {
    			$$invalidate(1, isLoading = false);
    		}
    	}

    	onMount(async () => {
    		await loadNaverMapsAPI();

    		const mapOptions = {
    			center: new naver.maps.LatLng(37.5665, 126.978),
    			zoom: 10
    		};

    		map = new naver.maps.Map('map', mapOptions);

    		naver.maps.Event.addListener(map, 'click', async function (e) {
    			const lat = e.coord.lat();
    			const lon = e.coord.lng();

    			// 역지오코딩을 통해 주소 정보를 가져옵니다.
    			const navermaps = window.naver.maps;

    			await navermaps.Service.reverseGeocode({ location: new navermaps.LatLng(lat, lon) }, function (status, response) {
    				if (status !== navermaps.Service.Status.OK) {
    					console.log('Something went wrong!', status);
    					return;
    				}

    				const result = response.result;
    				currentAddress = result.items[0].address; // 첫 번째 결과의 주소를 사용합니다.
    				addMarker(lat, lon);
    				fetchWeatherData(lat, lon);
    			});
    		});
    	});

    	// 주소 검색 기능을 수정하여 검색 결과를 searchResults에 저장
    	async function searchAddress() {
    		if (!searchInput.trim()) return;
    		$$invalidate(1, isLoading = true);
    		$$invalidate(2, errorMessage = '');
    		$$invalidate(4, searchResults = []); // 검색 전 결과 초기화
    		const navermaps = window.naver.maps;

    		try {
    			const response = await new Promise((resolve, reject) => {
    					navermaps.Service.geocode({ query: searchInput }, function (status, response) {
    						if (status === navermaps.Service.Status.ERROR) {
    							reject(new Error('검색 결과를 찾을 수 없습니다.'));
    						} else {
    							resolve(response);
    						}
    					});
    				});

    			// 검색 결과 중 최대 10개까지만 searchResults 배열에 저장
    			$$invalidate(4, searchResults = response.v2.addresses.slice(0, 10).map(address => ({
    				label: address.roadAddress || address.jibunAddress, // 도로명 주소 또는 지번 주소
    				x: address.x,
    				y: address.y
    			})));
    		} catch(error) {
    			$$invalidate(2, errorMessage = error.message);
    		} finally {
    			$$invalidate(1, isLoading = false);
    		}
    	}

    	// 마커 추가 기능
    	function addMarker(lat, lon) {
    		// 새 마커를 추가하기 전에 현재 마커가 있다면 지웁니다.
    		if (currentMarker) {
    			currentMarker.setMap(null); // 현재 마커를 지도에서 제거
    		}

    		// 사용자 지정 마커 이미지 URL
    		const markerImageUrl = '../svelte_weather_app/marker.png'; // 여기서 이미지 URL을 자신의 것으로 교체하세요.

    		// 새로운 마커 생성
    		currentMarker = new naver.maps.Marker({
    				position: new naver.maps.LatLng(lat, lon),
    				map,
    				icon: {
    					content: `<img src="${markerImageUrl}" alt="Marker" style="width: 30px; height: 87.7px;">`, // 마커 이미지와 크기 설정
    					anchor: new naver.maps.Point(15, 43), // 이미지의 중심점 설정. 여기서는 이미지 크기의 절반 값을 사용하여 중앙 아래 지점이 위치 지정점이 되도록 함
    					
    				}
    			});
    	}

    	// 검색 결과 중 하나를 선택했을 때 실행될 함수
    	function selectAddress(address) {
    		currentAddress = address.label;
    		map.setCenter(new naver.maps.LatLng(address.y, address.x));
    		addMarker(address.y, address.x);
    		fetchWeatherData(address.y, address.x);
    		$$invalidate(4, searchResults = []); // 검색 결과 초기화
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		searchInput = this.value;
    		$$invalidate(3, searchInput);
    	}

    	const click_handler = result => selectAddress(result);

    	$$self.$capture_state = () => ({
    		onMount,
    		map,
    		weatherData,
    		isLoading,
    		errorMessage,
    		searchInput,
    		currentAddress,
    		currentMarker,
    		searchResults,
    		fetchWeatherData,
    		loadNaverMapsAPI,
    		searchAddress,
    		addMarker,
    		selectAddress
    	});

    	$$self.$inject_state = $$props => {
    		if ('map' in $$props) map = $$props.map;
    		if ('weatherData' in $$props) $$invalidate(0, weatherData = $$props.weatherData);
    		if ('isLoading' in $$props) $$invalidate(1, isLoading = $$props.isLoading);
    		if ('errorMessage' in $$props) $$invalidate(2, errorMessage = $$props.errorMessage);
    		if ('searchInput' in $$props) $$invalidate(3, searchInput = $$props.searchInput);
    		if ('currentAddress' in $$props) currentAddress = $$props.currentAddress;
    		if ('currentMarker' in $$props) currentMarker = $$props.currentMarker;
    		if ('searchResults' in $$props) $$invalidate(4, searchResults = $$props.searchResults);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		weatherData,
    		isLoading,
    		errorMessage,
    		searchInput,
    		searchResults,
    		searchAddress,
    		selectAddress,
    		input_input_handler,
    		click_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
