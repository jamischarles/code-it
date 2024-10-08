(function() {
  if (typeof self === 'undefined' || !self.Prism || !self.document) {
    return;
  }

  /**
   * Plugin name which is used as a class name for <pre> which is activating the plugin
   * @type {String}
   */
  var PLUGIN_NAME = 'line-numbers';

  /**
   * Regular expression used for determining line breaks
   * @type {RegExp}
   */
  var NEW_LINE_EXP = /\n(?!$)/g;

  /**
   * Resizes line numbers spans according to height of line of code
   * @param {Element} element <pre> element
   */
  var _resizeElement = function(element) {
    var codeStyles = getStyles(element);
    var whiteSpace = codeStyles['white-space'];

    if (whiteSpace === 'pre-wrap' || whiteSpace === 'pre-line') {
      var codeElement = element.querySelector('code');
      var lineNumbersWrapper = element.querySelector('.line-numbers-rows');
      if (!codeElement || !lineNumbersWrapper) {
        return;
      }
      var lineNumberSizer = element.querySelector('.line-numbers-sizer');
      var codeLines = codeElement.textContent.split(NEW_LINE_EXP);

      if (!lineNumberSizer) {
        lineNumberSizer = document.createElement('span');
        lineNumberSizer.className = 'line-numbers-sizer';

        codeElement.appendChild(lineNumberSizer);
      }

      lineNumberSizer.style.display = 'block';

      codeLines.forEach(function(line, lineNumber) {
        lineNumberSizer.textContent = line || '\n';
        var lineSize = lineNumberSizer.getBoundingClientRect().height;
        lineNumbersWrapper.children[lineNumber].style.height = lineSize + 'px';
      });

      lineNumberSizer.textContent = '';
      lineNumberSizer.style.display = 'none';
    }
  };

  /**
   * Returns style declarations for the element
   * @param {Element} element
   */
  var getStyles = function(element) {
    if (!element) {
      return null;
    }

    return window.getComputedStyle
      ? getComputedStyle(element)
      : element.currentStyle || null;
  };

  window.addEventListener('resize', function() {
    Array.prototype.forEach.call(
      document.querySelectorAll('pre.' + PLUGIN_NAME),
      _resizeElement,
    );
  });

  Prism.hooks.add('complete', function(env) {
    console.log('env', env);
    if (!env.code) {
      return;
    }

    var code = env.element;
    var pre = code.parentNode;

    // works only for <code> wrapped inside <pre> (not inline)
    if (!pre || !/pre/i.test(pre.nodeName)) {
      return;
    }

    // Abort if line numbers already exists
    if (code.querySelector('.line-numbers-rows')) {
      return;
    }

    var addLineNumbers = false;
    var lineNumbersRegex = /(?:^|\s)line-numbers(?:\s|$)/;

    for (var element = code; element; element = element.parentNode) {
      if (lineNumbersRegex.test(element.className)) {
        addLineNumbers = true;
        break;
      }
    }

    // only add line numbers if <code> or one of its ancestors has the `line-numbers` class
    if (!addLineNumbers) {
      return;
    }

    // Remove the class 'line-numbers' from the <code>
    code.className = code.className.replace(lineNumbersRegex, ' ');
    // Add the class 'line-numbers' to the <pre>
    if (!lineNumbersRegex.test(pre.className)) {
      pre.className += ' line-numbers';
    }

    var match = env.code.match(NEW_LINE_EXP);
    var linesNum = match ? match.length + 1 : 1;
    var lineNumbersWrapper;

    var lines = new Array(linesNum + 1).join('<span></span>');

    lineNumbersWrapper = document.createElement('span');
    lineNumbersWrapper.setAttribute('aria-hidden', 'true');
    lineNumbersWrapper.className = 'line-numbers-rows';
    lineNumbersWrapper.innerHTML = lines;

    if (pre.hasAttribute('data-start')) {
      pre.style.counterReset =
        'linenumber ' + (parseInt(pre.getAttribute('data-start'), 10) - 1);
    }

    // FIXME: CHANGE BY JAMIS
    // append to container we added so we don't clobber our custom markup
    env.element.appendChild(lineNumbersWrapper);
    // document
    //   .getElementById('line-numbers-container')
    //   .appendChild(lineNumbersWrapper);

    _resizeElement(pre);

    Prism.hooks.run('line-numbers', env);
  });

  Prism.hooks.add('line-numbers', function(env) {
    env.plugins = env.plugins || {};
    env.plugins.lineNumbers = true;
  });

  /**
   * Global exports
   */
  Prism.plugins.lineNumbers = {
    /**
     * Returns the node of the given line number in the given element.
     * @param {Element} element A `<pre>` element with line numbers.
     * @param {Number} number
     * @returns {Element | undefined}
     */
    getLine: function(element, number) {
      if (
        element.tagName !== 'PRE' ||
        !element.classList.contains(PLUGIN_NAME)
      ) {
        return;
      }

      var lineNumberRows = element.querySelector('.line-numbers-rows');
      var lineNumberStart =
        parseInt(element.getAttribute('data-start'), 10) || 1;
      var lineNumberEnd =
        lineNumberStart + (lineNumberRows.children.length - 1);

      if (number < lineNumberStart) {
        number = lineNumberStart;
      }
      if (number > lineNumberEnd) {
        number = lineNumberEnd;
      }

      var lineIndex = number - lineNumberStart;

      return lineNumberRows.children[lineIndex];
    },
    /**
     * Resizes the line numbers of the given element.
     *
     * This function will not add line numbers. It will only resize existing ones.
     * @param {Element} element A `<pre>` element with line numbers.
     * @returns {void}
     */
    resize: function(element) {
      _resizeElement(element);
    },
  };
})();
