(function () {
  'use strict';
  var root = document.documentElement;
  var params = new URLSearchParams(window.location.search);
  var disabled = params.get('fullscreen') === '0';
  var embedded = false;
  try { embedded = window.self !== window.top; } catch (e) { embedded = true; }

  function element() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function supported() {
    return !!(root.requestFullscreen || root.webkitRequestFullscreen)
      && (document.fullscreenEnabled !== false || document.webkitFullscreenEnabled === true);
  }

  function enter() {
    if (element() || !supported()) return Promise.resolve(false);
    var request = root.requestFullscreen
      ? root.requestFullscreen({ navigationUI: 'hide' })
      : root.webkitRequestFullscreen();
    return Promise.resolve(request).then(function () {
      var orientation = window.screen && window.screen.orientation;
      if (orientation && orientation.lock) orientation.lock('landscape').catch(function () {});
      return true;
    }).catch(function () { return false; });
  }

  function exit() {
    if (!element()) return Promise.resolve();
    var request = document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen();
    return Promise.resolve(request).catch(function () {});
  }

  var button = null;
  function sync() {
    if (button) button.style.display = !disabled && supported() && !element() ? 'flex' : 'none';
  }

  function createButton() {
    button = document.createElement('button');
    button.id = 'fullscreen-toggle';
    button.type = 'button';
    button.setAttribute('aria-label', 'Во весь экран');
    button.title = 'Во весь экран';
    button.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">'
      + '<path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" '
      + 'd="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
    button.addEventListener('pointerdown', function (event) { event.stopPropagation(); });
    button.addEventListener('click', function (event) {
      event.stopPropagation();
      if (element()) exit(); else enter();
    });
    document.body.appendChild(button);
    sync();
  }

  var autoArmed = params.get('fullscreen') === 'auto' && !embedded;
  function firstGesture() {
    if (!autoArmed) return;
    autoArmed = false;
    window.removeEventListener('pointerup', firstGesture, true);
    window.removeEventListener('keyup', firstGesture, true);
    enter();
  }

  window.addEventListener('pointerup', firstGesture, true);
  window.addEventListener('keyup', firstGesture, true);
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);

  window.gameFullscreen = { enter: enter, exit: exit, isActive: function () { return !!element(); } };

  if (document.body) createButton();
  else document.addEventListener('DOMContentLoaded', createButton);
})();
