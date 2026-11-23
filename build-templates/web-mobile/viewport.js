(function () {
  'use strict';
  var root = document.documentElement;
  var pending = false;
  var previous = '';
  var mobile = window.matchMedia ? window.matchMedia('(any-pointer: coarse)').matches : false;

  function update(force) {
    pending = false;
    var viewport = window.visualViewport;
    var width = viewport ? viewport.width : window.innerWidth;
    var height = viewport ? viewport.height : window.innerHeight;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    var left = viewport ? viewport.offsetLeft : 0;
    var top = viewport ? viewport.offsetTop : 0;
    var style = window.getComputedStyle ? window.getComputedStyle(root) : null;
    function pixels(name) { return style ? Math.max(0, parseFloat(style.getPropertyValue(name)) || 0) : 0; }
    var edge = pixels('--gesture-edge');
    var insetLeft = Math.max(edge, pixels('--safe-left'));
    var insetRight = Math.max(edge, pixels('--safe-right'));
    var insetTop = Math.max(edge ? 12 : 0, pixels('--safe-top'));
    var insetBottom = Math.max(pixels('--gesture-bottom'), pixels('--safe-bottom'));
    insetLeft = Math.min(insetLeft, width / 4);
    insetRight = Math.min(insetRight, width / 4);
    insetTop = Math.min(insetTop, height / 4);
    insetBottom = Math.min(insetBottom, height / 4);
    var values = [Math.floor(width - insetLeft - insetRight), Math.floor(height - insetTop - insetBottom), left + insetLeft, top + insetTop];
    var rotated = mobile && window.innerWidth <= window.innerHeight;
    if (rotated) {
      var physicalWidth = values[0];
      values[0] = values[1];
      values[1] = physicalWidth;
      values[2] += physicalWidth;
    }
    var signature = values.join(':') + ':' + rotated;
    if (force !== true && signature === previous) return;
    previous = signature;
    root.style.setProperty('--game-transform', rotated ? 'rotate(90deg)' : 'none');
    ['width', 'height', 'left', 'top'].forEach(function (name, index) {
      root.style.setProperty('--game-' + name, values[index] + 'px');
    });
    var frame = document.getElementById('GameDiv');
    if (frame) {
      frame.style.width = values[0] + 'px';
      frame.style.height = values[1] + 'px';
    }
    window.dispatchEvent(new Event('resize'));
  }

  function schedule() {
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(update);
  }

  function refresh() {
    update(true);
  }

  function resync() {
    var frame = document.getElementById('GameDiv');
    if (!frame || !previous) { refresh(); return; }
    var height = Number(previous.split(':')[1]);
    if (!(height > 1)) { refresh(); return; }
    frame.style.height = (height - 1) + 'px';
    window.dispatchEvent(new Event('resize'));
    window.requestAnimationFrame(function () { update(true); });
  }

  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.addEventListener('pageshow', schedule);
  document.addEventListener('fullscreenchange', schedule);
  document.addEventListener('webkitfullscreenchange', schedule);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', schedule);
    window.visualViewport.addEventListener('scroll', schedule);
  }
  window.gameViewport = {
    refresh: refresh,
    resync: resync,
    setMobile: function (value) { mobile = !!value; refresh(); }
  };
  update();
})();
