(function () {
  'use strict';
  function gameTarget(target) {
    return target && typeof target.closest === 'function'
      && target.closest('#GameDiv, #loader-container');
  }
  function preventBrowserGesture(event) {
    if (gameTarget(event.target) && event.cancelable) event.preventDefault();
  }
  ['touchstart', 'touchmove', 'gesturestart', 'gesturechange', 'gestureend'].forEach(function (name) {
    document.addEventListener(name, preventBrowserGesture, { passive: false, capture: true });
  });
})();
