System.register([], function (_export) {
  'use strict';
  var cc;
  class Application {
    constructor() {
      this.settingsPath = 'src/settings.json';
      this.showFPS = false;
    }

    init(engine) {
      cc = engine;
      if (window.gameViewport && window.gameViewport.setMobile && cc.sys) {
        window.gameViewport.setMobile(cc.sys.isMobile);
      }
      cc.game.onPostBaseInitDelegate.add(this.onPostInitBase.bind(this));
      cc.game.onPostSubsystemInitDelegate.add(this.onPostSystemInit.bind(this));
    }

    onPostInitBase() {}

    onPostSystemInit() {}

    start() {
      return cc.game.init({
        debugMode: cc.DebugMode.ERROR,
        settingsPath: this.settingsPath,
        overrideSettings: {
          screen: { exactFitScreen: false, orientation: 'landscape' },
          profiling: { showFPS: this.showFPS }
        }
      }).then(function () {
        var result = cc.game.run();
        refreshViewport();
        if (cc.director && cc.Director && cc.director.once) {
          cc.director.once(cc.Director.EVENT_AFTER_SCENE_LAUNCH, function () {
            resyncViewport();
            setTimeout(resyncViewport, 500);
          });
        }
        return result;
      });
    }
  }

  function refreshViewport() {
    var viewport = typeof window !== 'undefined' ? window.gameViewport : null;
    if (viewport && viewport.refresh) viewport.refresh();
  }

  function resyncViewport() {
    var viewport = typeof window !== 'undefined' ? window.gameViewport : null;
    if (viewport && viewport.resync) viewport.resync();
    else refreshViewport();
  }
  return {
    setters: [],
    execute: function () { _export('Application', Application); }
  };
});
