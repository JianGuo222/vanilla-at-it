var smartTag = (function() {
  var DEFAULT_CALLBACKS, KEY_CODE;

  // Show an element
  var show = function(elem) {
    elem.style.display = "block";
  };

  // Hide an element
  var hide = function(elem) {
    elem.style.display = "none";
  };

  function hasClass(elem, className) {
    return new RegExp(" " + className + " ").test(" " + elem.className + " ");
  }

  function addClass(elem, className) {
    if (!hasClass(elem, className)) {
      elem.className += " " + className;
    }
  }
  function removeClass(elem, className) {
    var newClass = " " + elem.className.replace(/[\t\r\n]/g, " ") + " ";
    if (hasClass(elem, className)) {
      while (newClass.indexOf(" " + className + " ") >= 0) {
        newClass = newClass.replace(" " + className + " ", " ");
      }
      elem.className = newClass.replace(/^\s+|\s+$/g, "");
    }
  }

  KEY_CODE = {
    ESC: 27,
    TAB: 9,
    ENTER: 13,
    CTRL: 17,
    A: 65,
    P: 80,
    N: 78,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    BACKSPACE: 8,
    SPACE: 32
  };

  DEFAULT_CALLBACKS = {
    beforeSave: function(data) {
      return Controller.arrayToDefaultHash(data);
    },
    matcher: function(flag, subtext, should_startWithSpace, acceptSpaceBar) {
      var _a, _y, match, regexp, space;
      flag = flag.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
      if (should_startWithSpace) {
        flag = "(?:^|\\s)" + flag;
      }
      _a = decodeURI("%C3%80");
      _y = decodeURI("%C3%BF");
      space = acceptSpaceBar ? " " : "";
      regexp = new RegExp(
        flag +
          "([A-Za-z" +
          _a +
          "-" +
          _y +
          "0-9_" +
          space +
          "'.+-]*)$|" +
          flag +
          "([^\\x00-\\xff]*)$",
        "gi"
      );
      match = regexp.exec(subtext);
      if (match) {
        return match[2] || match[1];
      } else {
        return null;
      }
    },
    filter: function(query, data, searchKey) {
      var _results, i, item, len;
      _results = [];
      for (i = 0, len = data.length; i < len; i++) {
        item = data[i];
        if (
          ~new String(item[searchKey])
            .toLowerCase()
            .indexOf(query.toLowerCase())
        ) {
          _results.push(item);
        }
      }
      return _results;
    },
    remoteFilter: null,
    sorter: function(query, items, searchKey) {
      var _results, i, item, len;
      if (!query) {
        return items;
      }
      _results = [];
      for (i = 0, len = items.length; i < len; i++) {
        item = items[i];
        item.atwho_order = new String(item[searchKey])
          .toLowerCase()
          .indexOf(query.toLowerCase());
        if (item.atwho_order > -1) {
          _results.push(item);
        }
      }
      return _results.sort(function(a, b) {
        return a.atwho_order - b.atwho_order;
      });
    },
    tplEval: function(tpl, map) {
      var error, template;
      template = tpl;
      try {
        if (typeof tpl !== "string") {
          template = tpl(map);
        }
        return template.replace(/\$\{([^\}]*)\}/g, function(tag, key, pos) {
          return map[key];
        });
      } catch (error1) {
        error = error1;
        return "";
      }
    },
    highlighter: function($li, query) {
      var regexp;
      if (!query) {
        return $li;
      }
      regexp = new RegExp(
        "\\s*([^<]*?)(" + query.replace("+", "\\+") + ")([^<]*)\\s*",
        "ig"
      );
      $li.innerHTML = $li.innerHTML.replace(regexp, function(str, $1, $2, $3) {
        return "" + $1 + "<strong>" + $2 + "</strong>" + $3 + "";
      });
      return $li;
    },
    beforeInsert: function(value, $li, e) {
      return value;
    },

    afterMatchFailed: function(at, el) {}
  };

  var App;

  App = (function() {
    function App(inputor) {
      this.currentFlag = null;
      this.controllers = {};
      this.aliasMaps = {};
      this.$inputor = inputor;
      this.setupRootElement();
      this.listen();
    }

    App.prototype.createContainer = function(doc) {
      var ref;
      if ((ref = this.$el) != null) {
        ref.remove();
      }

      var containerEl = document.createElement("div");
      containerEl.className = "atwho-container";

      this.$el = containerEl;

      return document.querySelector("#smart-tag-dropdown").append(containerEl);
    };

    App.prototype.setupRootElement = function(iframe, asRoot) {
      var error;
      if (asRoot == null) {
        asRoot = false;
      }
      if (iframe) {
        this.window = iframe.contentWindow;
        this.document = iframe.contentDocument || this.window.document;
        this.iframe = iframe;
      } else {
        this.document = this.$inputor.ownerDocument;
        this.window = this.document.defaultView || this.document.parentWindow;
        try {
          this.iframe = this.window.frameElement;
        } catch (error1) {
          error = error1;
          this.iframe = null;
        }
      }
      return this.createContainer(
        (this.iframeAsRoot = asRoot) ? this.document : document
      );
    };

    App.prototype.controller = function(at) {
      var c, current, currentFlag, ref;
      if (this.aliasMaps[at]) {
        current = this.controllers[this.aliasMaps[at]];
      } else {
        ref = this.controllers;
        for (currentFlag in ref) {
          c = ref[currentFlag];
          if (currentFlag === at) {
            current = c;
            break;
          }
        }
      }
      if (current) {
        return current;
      } else {
        return this.controllers[this.currentFlag];
      }
    };

    App.prototype.setContextFor = function(at) {
      this.currentFlag = at;
      return this;
    };

    App.prototype.reg = function(flag, setting) {
      var base, controller;
      controller =
        (base = this.controllers)[flag] ||
        (base[flag] = new TextareaController(this, flag));
      if (setting.alias) {
        this.aliasMaps[setting.alias] = flag;
      }
      controller.init(setting);
      return this;
    };

    App.prototype.listen = function() {
      this.$inputor.addEventListener(
        "compositionstart",
        (function(_this) {
          return function(e) {
            var ref;
            if ((ref = _this.controller()) != null) {
              ref.view.hide();
            }
            _this.isComposing = true;
            return null;
          };
        })(this)
      );
      this.$inputor.addEventListener(
        "compositionstart",
        (function(_this) {
          return function(e) {
            _this.isComposing = false;
            setTimeout(function(e) {
              return _this.dispatch(e);
            });
            return null;
          };
        })(this)
      );
      this.$inputor.addEventListener(
        "keyup",
        (function(_this) {
          return function(e) {
            return _this.onKeyup(e);
          };
        })(this)
      );
      this.$inputor.addEventListener(
        "keydown",
        (function(_this) {
          return function(e) {
            return _this.onKeydown(e);
          };
        })(this)
      );
      this.$inputor.addEventListener(
        "blur",
        (function(_this) {
          return function(e) {
            var c;
            if ((c = _this.controller())) {
              c.expectedQueryCBId = null;
              return c.view.hide(e, c.getOpt("displayTimeout"));
            }
          };
        })(this)
      );
      this.$inputor.addEventListener(
        "click",
        (function(_this) {
          return function(e) {
            return _this.dispatch(e);
          };
        })(this)
      );
      this.$inputor.addEventListener(
        "scroll",
        (function(_this) {
          return function() {
            var lastScrollTop;
            lastScrollTop = _this.$inputor.scrollTop;
            return function(e) {
              var currentScrollTop, ref;
              currentScrollTop = e.target.scrollTop;
              if (lastScrollTop !== currentScrollTop) {
                if ((ref = _this.controller()) != null) {
                  ref.view.hide(e);
                }
              }
              lastScrollTop = currentScrollTop;
              return true;
            };
          };
        })(this)
      );

      return this.$inputor;
    };

    App.prototype.shutdown = function() {
      var _, c, ref;
      ref = this.controllers;
      for (_ in ref) {
        c = ref[_];
        c.destroy();
        delete this.controllers[_];
      }
      // this.$inputor.off(".atwhoInner");
      return this.$el.remove();
    };

    App.prototype.dispatch = function(e) {
      var _, c, ref, results;
      if (void 0 === e) {
        return;
      }
      ref = this.controllers;
      results = [];
      for (_ in ref) {
        c = ref[_];
        results.push(c.lookUp(e));
      }
      return results;
    };

    App.prototype.onKeyup = function(e) {
      var ref;
      switch (e.keyCode) {
        case KEY_CODE.ESC:
          e.preventDefault();
          if ((ref = this.controller()) != null) {
            ref.view.hide();
          }
          break;
        case KEY_CODE.UP:
        case KEY_CODE.CTRL:
        case KEY_CODE.DOWN:
        case KEY_CODE.ENTER:
          break;
        case KEY_CODE.P:
        case KEY_CODE.N:
          if (!e.ctrlKey) {
            this.dispatch(e);
          }
          break;
        default:
          this.dispatch(e);
      }
    };

    App.prototype.onKeydown = function(e) {
      var ref, view;
      view = (ref = this.controller()) != null ? ref.view : void 0;
      if (!(view && view.visible())) {
        return;
      }
      switch (e.keyCode) {
        case KEY_CODE.ESC:
          e.preventDefault();
          view.hide(e);
          break;
        case KEY_CODE.UP:
          e.preventDefault();
          view.prev();
          break;
        case KEY_CODE.DOWN:
          e.preventDefault();
          view.next();
          break;
        case KEY_CODE.P:
          if (!e.ctrlKey) {
            return;
          }
          e.preventDefault();
          view.prev();
          break;
        case KEY_CODE.N:
          if (!e.ctrlKey) {
            return;
          }
          e.preventDefault();
          view.next();
          break;
        case KEY_CODE.TAB:
        case KEY_CODE.ENTER:
        case KEY_CODE.SPACE:
          if (!view.visible()) {
            return;
          }
          if (
            !this.controller().getOpt("spaceSelectsMatch") &&
            e.keyCode === KEY_CODE.SPACE
          ) {
            return;
          }
          if (
            !this.controller().getOpt("tabSelectsMatch") &&
            e.keyCode === KEY_CODE.TAB
          ) {
            return;
          }
          if (view.highlighted()) {
            e.preventDefault();
            view.choose(e);
          } else {
            view.hide(e);
          }
          break;
        default:
          break;
      }
    };

    return App;
  })();

  var Controller,
    slice = [].slice;

  Controller = (function() {
    Controller.prototype.uid = function() {
      return (
        (Math.random().toString(16) + "000000000").substr(2, 8) +
        new Date().getTime()
      );
    };

    function Controller(app, at1) {
      this.app = app;
      this.at = at1;
      this.$inputor = this.app.$inputor;
      this.id = this.$inputor.id || this.uid();
      this.expectedQueryCBId = null;
      this.setting = null;
      this.query = null;
      this.pos = 0;
      this.range = null;
      this.$el = this.app.$el.querySelector("#atwho-ground-" + this.id);
      if (this.$el === null) {
        var newContainer = document.createElement("div");
        newContainer.id = "atwho-ground-" + this.id;

        this.$el = newContainer;
        this.app.$el.append((this.$el = newContainer));
      }
      this.model = new Model(this);
      this.view = new View(this);
    }

    Controller.prototype.init = function(setting) {
      this.defaultSettings = {
        at: void 0,
        alias: void 0,
        data: null,
        displayTpl: "<li>${name}</li>",
        insertTpl: "${atwho-at}${name}",
        headerTpl: null,
        callbacks: DEFAULT_CALLBACKS,
        searchKey: "name",
        suffix: void 0,
        hideWithoutSuffix: false,
        startWithSpace: true,
        acceptSpaceBar: true,
        highlightFirst: true,
        limit: 5,
        maxLen: 20,
        minLen: 0,
        displayTimeout: 300,
        delay: null,
        spaceSelectsMatch: false,
        tabSelectsMatch: true,
        editableAtwhoQueryAttrs: {},
        scrollDuration: 150,
        suspendOnComposing: true,
        lookUpOnClick: true
      };

      this.setting = Object.assign(
        {},
        this.setting || this.defaultSettings,
        setting
      );
      this.view.init();
      return this.model.reload(this.setting.data);
    };

    Controller.prototype.destroy = function() {
      this.trigger("beforeDestroy");
      this.model.destroy();
      this.view.destroy();
      return this.$el.remove();
    };

    Controller.prototype.callDefault = function() {
      var args, error, funcName;
      (funcName = arguments[0]),
        (args = 2 <= arguments.length ? slice.call(arguments, 1) : []);
      try {
        return DEFAULT_CALLBACKS[funcName].apply(this, args);
      } catch (error1) {
        error = error1;
        return console.log(
          error + " Or maybe At.js doesn't have function " + funcName
        );
      }
    };

    Controller.prototype.trigger = function(name, data) {
      var alias, eventName;
      if (data == null) {
        data = [];
      }
      data.push(this);
      alias = this.getOpt("alias");
      eventName = alias ? name + "-" + alias + ".atwho" : name + ".atwho";
      return this.$inputor.dispatchEvent(new Event(eventName, data));
    };

    Controller.prototype.callbacks = function(funcName) {
      return this.getOpt("callbacks")[funcName] || DEFAULT_CALLBACKS[funcName];
    };

    Controller.prototype.getOpt = function(at, default_value) {
      var e;
      try {
        return this.setting[at];
      } catch (error1) {
        e = error1;
        return null;
      }
    };

    Controller.prototype.insertContentFor = function($li) {
      var data, tpl;
      tpl = this.getOpt("insertTpl");

      data = {
        name: $li.getAttribute("item-data"),
        "atwho-at": this.at
      };
      return this.callbacks("tplEval").call(this, tpl, data, "onInsert");
    };

    Controller.prototype.renderView = function(data) {
      var searchKey;
      searchKey = this.getOpt("searchKey");
      data = this.callbacks("sorter").call(
        this,
        this.query.text,
        data.slice(0, 1001),
        searchKey
      );
      return this.view.render(data.slice(0, this.getOpt("limit")));
    };

    Controller.arrayToDefaultHash = function(data) {
      var i, item, len, results;
      if (!Array.isArray(data)) {
        return data;
      }
      results = [];
      for (i = 0, len = data.length; i < len; i++) {
        item = data[i];
        if (typeof item === "object") {
          results.push(item);
        } else {
          results.push({
            name: item
          });
        }
      }
      return results;
    };

    Controller.prototype.lookUp = function(e) {
      var query, wait;
      if (e && e.type === "click" && !this.getOpt("lookUpOnClick")) {
        return;
      }
      if (this.getOpt("suspendOnComposing") && this.app.isComposing) {
        return;
      }
      query = this.catchQuery(e);
      if (!query) {
        this.expectedQueryCBId = null;
        return query;
      }
      this.app.setContextFor(this.at);
      if ((wait = this.getOpt("delay"))) {
        this._delayLookUp(query, wait);
      } else {
        this._lookUp(query);
      }
      return query;
    };

    Controller.prototype._delayLookUp = function(query, wait) {
      var now, remaining;
      now = Date.now ? Date.now() : new Date().getTime();
      this.previousCallTime || (this.previousCallTime = now);
      remaining = wait - (now - this.previousCallTime);
      if (0 < remaining && remaining < wait) {
        this.previousCallTime = now;
        this._stopDelayedCall();
        return (this.delayedCallTimeout = setTimeout(
          (function(_this) {
            return function() {
              _this.previousCallTime = 0;
              _this.delayedCallTimeout = null;
              return _this._lookUp(query);
            };
          })(this),
          wait
        ));
      } else {
        this._stopDelayedCall();
        if (this.previousCallTime !== now) {
          this.previousCallTime = 0;
        }
        return this._lookUp(query);
      }
    };

    Controller.prototype._stopDelayedCall = function() {
      if (this.delayedCallTimeout) {
        clearTimeout(this.delayedCallTimeout);
        return (this.delayedCallTimeout = null);
      }
    };

    Controller.prototype._generateQueryCBId = function() {
      return {};
    };

    Controller.prototype._lookUp = function(query) {
      var _callback;
      _callback = function(queryCBId, data) {
        if (queryCBId !== this.expectedQueryCBId) {
          return;
        }
        if (data && data.length > 0) {
          return this.renderView(this.constructor.arrayToDefaultHash(data));
        } else {
          return this.view.hide();
        }
      };
      this.expectedQueryCBId = this._generateQueryCBId();
      var cb;
      cb = function() {
        return _callback.apply(
          this,
          [this.expectedQueryCBId].concat(Array.prototype.slice.call(arguments))
        );
      }.bind(this);

      return this.model.query(query.text, cb);
    };

    return Controller;
  })();

  var TextareaController,
    extend = function(child, parent) {
      for (var key in parent) {
        if (hasProp.call(parent, key)) child[key] = parent[key];
      }
      function ctor() {
        this.constructor = child;
      }
      ctor.prototype = parent.prototype;
      child.prototype = new ctor();
      child.__super__ = parent.prototype;
      return child;
    },
    hasProp = {}.hasOwnProperty;

  TextareaController = (function(superClass) {
    extend(TextareaController, superClass);

    function TextareaController() {
      return TextareaController.__super__.constructor.apply(this, arguments);
    }

    TextareaController.prototype.catchQuery = function() {
      var caretPos, content, end, isString, query, start, subtext;
      content = this.$inputor.value;
      caretPos = caret(this.$inputor, "pos", {
        iframe: this.app.iframe
      });
      subtext = content.slice(0, caretPos);
      query = this.callbacks("matcher").call(
        this,
        this.at,
        subtext,
        this.getOpt("startWithSpace"),
        this.getOpt("acceptSpaceBar")
      );
      isString = typeof query === "string";
      if (isString && query.length < this.getOpt("minLen", 0)) {
        return;
      }
      if (isString && query.length <= this.getOpt("maxLen", 20)) {
        start = caretPos - query.length;
        end = start + query.length;
        this.pos = start;
        query = {
          text: query,
          headPos: start,
          endPos: end
        };
        this.trigger("matched", [this.at, query.text]);
      } else {
        query = null;
        this.view.hide();
      }
      return (this.query = query);
    };

    TextareaController.prototype.insert = function(content, $li) {
      var $inputor, source, startStr, suffix, text;
      $inputor = this.$inputor;
      source = $inputor.value;
      startStr = source.slice(
        0,
        Math.max(this.query.headPos - this.at.length, 0)
      );
      suffix = (suffix = this.getOpt("suffix")) === "" ? suffix : suffix || " ";
      content += suffix;
      text = "" + startStr + content + source.slice(this.query["endPos"] || 0);
      $inputor.value = text;
      caret($inputor, "pos", startStr.length + content.length, {
        iframe: this.app.iframe
      });
      $inputor.focus();
      return $inputor.dispatchEvent(new Event("change"));
    };

    return TextareaController;
  })(Controller);

  var Model;

  Model = (function() {
    function Model(context) {
      this.context = context;
      this.at = this.context.at;
      this.storage = {};
    }

    Model.prototype.destroy = function() {
      return (this.storage[this.at] = null);
    };

    Model.prototype.saved = function() {
      return this.fetch() > 0;
    };

    Model.prototype.query = function(query, callback) {
      var _remoteFilter, data, searchKey;
      data = this.fetch();
      searchKey = this.context.getOpt("searchKey");
      data =
        this.context
          .callbacks("filter")
          .call(this.context, query, data, searchKey) || [];
      _remoteFilter = this.context.callbacks("remoteFilter");
      if (data.length > 0 || (!_remoteFilter && data.length === 0)) {
        return callback(data);
      } else {
        return _remoteFilter.call(this.context, query, callback);
      }
    };

    Model.prototype.fetch = function() {
      return this.storage[this.at] || [];
    };

    Model.prototype.save = function(data) {
      this.storage[this.at] = this.context
        .callbacks("beforeSave")
        .call(this.context, data || []);
      return this.context.$inputor;
    };

    Model.prototype.load = function(data) {
      if (!(this.saved() || !data)) {
        return this._load(data);
      }
    };

    Model.prototype.reload = function(data) {
      return this._load(data);
    };

    Model.prototype._load = function(data) {
      return this.save(data);
    };

    return Model;
  })();

  var View;

  View = (function() {
    function View(context) {
      this.context = context;
      this.$el = document.createElement("div");
      this.$el.className = "atwho-view";
      this.$elUl = document.createElement("ul");
      this.$elUl.className = "atwho-view-ul";
      this.$el.append(this.$elUl);

      this.timeoutID = null;
      this.context.$el.append(this.$el);
      this.bindEvent();
    }

    View.prototype.init = function() {
      var header_tpl, id;
      id = this.context.getOpt("alias") || this.context.at.charCodeAt(0);
      header_tpl = this.context.getOpt("headerTpl");
      if (header_tpl && this.$el.children().length === 1) {
        this.$el.prepend(header_tpl);
      }
      return this.$el.setAttribute("id", "at-view-" + id);
    };

    View.prototype.destroy = function() {
      return this.$el.remove();
    };

    View.prototype.bindEvent = function() {
      var $menu, lastCoordX, lastCoordY;
      $menu = this.$el.querySelector("ul");
      lastCoordX = 0;
      lastCoordY = 0;
      var listItems = $menu.querySelectorAll("li");

      $menu.addEventListener(
        "mousemove",
        (function(_this) {
          return function(e) {
            var $cur;
            if (lastCoordX === e.clientX && lastCoordY === e.clientY) {
              return;
            }
            lastCoordX = e.clientX;
            lastCoordY = e.clientY;
            $cur = e.target;
            if (hasClass($cur, "cur")) {
              return;
            }
            removeClass($menu.querySelector(".cur"), "cur");
            return addClass($cur, "cur");
          };
        })(this)
      );
      $menu.addEventListener(
        "click",
        (function(_this) {
          return function(e) {
            removeClass($menu.querySelector(".cur"), "cur");
            addClass(e.target, "cur");
            _this.choose(e);
            return e.preventDefault();
          };
        })(this)
      );
    };

    View.prototype.visible = function() {
      return this.$el.style.display !== "none";
    };

    View.prototype.highlighted = function() {
      return this.$el.querySelectorAll(".cur").length > 0;
    };

    View.prototype.choose = function(e) {
      var $li, content;
      if (this.$el.querySelectorAll(".cur").length) {
        $li = this.$el.querySelector(".cur");
        content = this.context.insertContentFor($li);
        this.context._stopDelayedCall();
        this.context.insert(
          this.context
            .callbacks("beforeInsert")
            .call(this.context, content, $li, e),
          $li
        );
        this.context.trigger("inserted", [$li, e]);
        this.hide(e);
      }
      if (this.context.getOpt("hideWithoutSuffix")) {
        return (this.stopShowing = true);
      }
    };

    View.prototype.next = function() {
      var cur, next, nextEl, offset;
      cur = this.$el.querySelector(".cur");
      removeClass(cur, "cur");
      next = cur.nextElementSibling;
      if (next === null) {
        next = this.$el.querySelector("li:first-child");
      }
      addClass(next, "cur");
      nextEl = next;
      offset =
        nextEl.offsetTop +
        nextEl.offsetHeight +
        (nextEl.nextSibling ? nextEl.nextSibling.offsetHeight : 0);

      return this.scrollTop(Math.max(0, offset - this.$el.clientHeight));
    };

    View.prototype.prev = function() {
      var cur, offset, prev, prevEl;
      cur = this.$el.querySelector(".cur");
      removeClass(cur, "cur");
      prev = cur.previousElementSibling;
      if (prev === null) {
        prev = this.$el.querySelector("li:last-child");
      }
      addClass(prev, "cur");
      offset =
        prev.offsetTop +
        prev.offsetHeight +
        (prev.nextElementSibling ? prev.nextElementSibling.offsetHeight : 0);

      return this.scrollTop(Math.max(0, offset - this.$el.clientHeight));
    };

    View.prototype.scrollTop = function(scrollTop) {
      return (this.$elUl.scrollTop = scrollTop);
    };

    View.prototype.show = function() {
      if (this.stopShowing) {
        this.stopShowing = false;
        return;
      }
      if (!this.visible()) {
        show(this.$el);
        this.$el.scrollTop = 0;
        this.context.trigger("shown");
      }
    };

    View.prototype.hide = function(e, time) {
      var callback;
      if (!this.visible()) {
        return;
      }
      if (isNaN(time)) {
        hide(this.$el);
        return this.context.trigger("hidden", [e]);
      } else {
        callback = (function(_this) {
          return function() {
            return _this.hide();
          };
        })(this);
        clearTimeout(this.timeoutID);
        return (this.timeoutID = setTimeout(callback, time));
      }
    };

    View.prototype.render = function(list) {
      var $li, $ul, i, item, len, li, tpl;
      if (!(Array.isArray(list) && list.length > 0)) {
        this.hide();
        return;
      }
      $ul = this.$el.querySelector("ul");
      while ($ul.firstChild) $ul.removeChild($ul.firstChild);
      tpl = this.context.getOpt("displayTpl");
      for (i = 0, len = list.length; i < len; i++) {
        item = list[i];
        item["atwho-at"] = this.context.at;

        $li = document.createElement("li");
        $li.innerText = item.name;

        $li = this.context
          .callbacks("highlighter")
          .call(this.context, $li, this.context.query.text);
        $li.setAttribute("item-data", item.name);
        $ul.append($li);
      }
      this.show();
      if (this.context.getOpt("highlightFirst")) {
        return addClass($ul.querySelector("li:first-child"), "cur");
      }
    };

    return View;
  })();

  return function(id, method) {
    var _args, result;
    _args = arguments;
    result = null;
    var app;
    var $this = document.querySelector(id);
    if (!app) app = new App($this);

    if (typeof method === "object" || !method) {
      return app.reg(method.at, method);
    } else {
      return console.log(
        "Method " + method + " does not exist on jQuery.atwho"
      );
    }
    if (result != null) {
      return result;
    } else {
      return $this;
    }
  };
})();
