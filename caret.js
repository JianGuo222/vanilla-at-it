var caret = (function() {
  var InputCaret, methods, oDocument;

  InputCaret = (function() {
    function InputCaret($inputor) {
      this.$inputor = $inputor;
      this.domInputor = this.$inputor;
    }

    InputCaret.prototype.getIEPos = function() {
      var endRange, inputor, len, normalizedValue, pos, range, textInputRange;
      inputor = this.domInputor;
      range = oDocument.selection.createRange();
      pos = 0;
      if (range && range.parentElement() === inputor) {
        normalizedValue = inputor.value.replace(/\r\n/g, "\n");
        len = normalizedValue.length;
        textInputRange = inputor.createTextRange();
        textInputRange.moveToBookmark(range.getBookmark());
        endRange = inputor.createTextRange();
        endRange.collapse(false);
        if (textInputRange.compareEndPoints("StartToEnd", endRange) > -1) {
          pos = len;
        } else {
          pos = -textInputRange.moveStart("character", -len);
        }
      }
      return pos;
    };

    InputCaret.prototype.getPos = function() {
      if (oDocument.selection) {
        return this.getIEPos();
      } else {
        return this.domInputor.selectionStart;
      }
    };

    InputCaret.prototype.setPos = function(pos) {
      var inputor, range;
      inputor = this.domInputor;
      if (oDocument.selection) {
        range = inputor.createTextRange();
        range.move("character", pos);
        range.select();
      } else if (inputor.setSelectionRange) {
        inputor.setSelectionRange(pos, pos);
      }
      return inputor;
    };

    return InputCaret;
  })();

  methods = {
    pos: function(pos) {
      if (pos || pos === 0) {
        return this.setPos(pos);
      } else {
        return this.getPos();
      }
    }
  };

  oDocument = null;

  return function(el, method, value) {
    var caret;
    if (methods[method]) {
      if (!Number.isInteger(value)) {
        oDocument = document;
        value = void 0;
      }
      caret = new InputCaret(el);
      return methods[method].apply(caret, [value]);
    } else {
      return console.log("error");
    }
  };
})();
