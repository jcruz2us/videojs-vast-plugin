(function(vjs, vast) {
"use strict";
  var
  extend = function(obj) {
    var arg, i, k;
    for (i = 1; i < arguments.length; i++) {
      arg = arguments[i];
      for (k in arg) {
        if (arg.hasOwnProperty(k)) {
          obj[k] = arg[k];
        }
      }
    }
    return obj;
  },

  defaults = {
    skip: 5 // negative disables
  },

  vastPlugin = function(options) {
    var player = this;
    var settings = extend({}, defaults, options || {});

    if (player.ads === undefined) {
        console.log("VAST requires videojs-contrib-ads");
        return;
    }

    // If we don't have a VAST url, just bail out.
    if(settings.url === undefined) {
      player.trigger('adtimeout');
      return;
    }

    // videojs-ads triggers this when src changes
    player.on('contentupdate', function(){
      player.vast.getContent(settings.url);
    });

    player.on('readyforpreroll', function() {
      player.vast.preroll();
    });

    player.vast.getContent = function(url) {
      vast.client.get(url, function(response) {
        if (response) {
          for (var adIdx = 0; adIdx < response.ads.length; adIdx++) {
            var ad = response.ads[adIdx];
            player.vast.companion = undefined;
            for (var creaIdx = 0; creaIdx < ad.creatives.length; creaIdx++) {
              var creative = ad.creatives[creaIdx], foundCreative = false, foundCompanion = false;
              if (creative.type === "linear" && !foundCreative) {

                if (creative.mediaFiles.length) {

                  player.vast.sources = player.vast.createSourceObjects(creative.mediaFiles);

                  if (!player.vast.sources.length) {
                    player.trigger('adtimeout');
                    return;
                  }

                  player.vastTracker = new vast.tracker(ad, creative);

                  var errorOccurred = false,
                      canplayFn = function() {
                        this.vastTracker.load();
                      },
                      timeupdateFn = function() {
                        if (isNaN(this.vastTracker.assetDuration)) {
                          this.vastTracker.assetDuration = this.duration();
                        }
                        this.vastTracker.setProgress(this.currentTime());
                      },
                      playFn = function() {
                        this.vastTracker.setPaused(false);
                      },
                      pauseFn = function() {
                        this.vastTracker.setPaused(true);
                      },
                      errorFn = function() {
                        // Inform ad server we couldn't play the media file for this ad
                        vast.util.track(ad.errorURLTemplates, {ERRORCODE: 405});
                        errorOccurred = true;
                        player.trigger('ended');
                      };

                  player.on('canplay', canplayFn);
                  player.on('timeupdate', timeupdateFn);
                  player.on('play', playFn);
                  player.on('pause', pauseFn);
                  player.on('error', errorFn);

                  player.one('ended', function() {
                    player.off('canplay', canplayFn);
                    player.off('timeupdate', timeupdateFn);
                    player.off('play', playFn);
                    player.off('pause', pauseFn);
                    player.off('error', errorFn);
                    if (!errorOccurred) {
                      this.vastTracker.complete();
                    }
                  });

                  foundCreative = true;
                }

              } else if (creative.type === "companion" && !foundCompanion) {

                player.vast.companion = creative;

                foundCompanion = true;

              }
            }

            if (player.vastTracker) {
              player.trigger("adsready");
              break;
            } else {
              // Inform ad server we can't find suitable media file for this ad
              vast.util.track(ad.errorURLTemplates, {ERRORCODE: 403});
            }
          }
        }

        if (!player.vastTracker) {
          // No pre-roll, start video
          player.trigger('adtimeout');
        }
      });
    };

    player.vast.preroll = function() {
      player.ads.startLinearAdMode();
      player.vast.showControls = player.controls();
      if (player.vast.showControls ) {
        player.controls(false);
      }
      player.autoplay(true);
      // play your linear ad content
      var adSources = player.vast.sources;
      player.src(adSources);

      var clickthrough;
      if (player.vastTracker.clickThroughURLTemplate) {
        clickthrough = vast.util.resolveURLTemplates(
          [player.vastTracker.clickThroughURLTemplate],
          {
            CACHEBUSTER: Math.round(Math.random() * 1.0e+10),
            CONTENTPLAYHEAD: player.vastTracker.progressFormated()
          }
        )[0];
      }
      var blocker = document.createElement("a");
      blocker.className = "vast-blocker";
      blocker.href = clickthrough || "#";
      blocker.target = "_blank";
      blocker.onclick = function() {
        if (player.paused()) {
          player.play();
          return false;
        }
        var clicktrackers = player.vastTracker.clickTrackingURLTemplate;
        if (clicktrackers) {
          player.vastTracker.trackURLs([clicktrackers]);
        }
        player.trigger("adclick");
      };
      player.vast.blocker = blocker;
      player.el().insertBefore(blocker, player.controlBar.el());

      //use the 'skip-countdown' events emitted by the 
      //vastTracker to start/update the skip ad button
      //countdown. The vastTracker correctly fires the event in the following
      //scenerios
      //
      //If a VAST ad is set to not be skippable, 'skip-countdown' will
      //never fire, therefore the skip button will never show up
      //
      //If a VAST ad is set to be skippable, 'skip-countdown' will emit
      //multiple times until the skip offset has been reached.
      //The event payload will contain the timeLeft or 0 if the ad has 
      //reached the skip offset.
      player.vastTracker.on("skip-countdown", player.vast.skipCountdown);

      //we only need to listen for 1 'timeupdate'
      //after that, the loading spinner will already be hidden
      player.one("timeupdate", player.vast.hideLoadingSpinner);
      player.one("ended", player.vast.tearDown);
    };

    player.vast.tearDown = function() {
      player.vastTracker.removeListener("skip-countdown", player.vast.skipCountdown);

      if (player.vast.skipButton) {
        player.vast.skipButton.parentNode.removeChild(player.vast.skipButton);
        delete player.vast.skipButton;
      }

      player.off('timeupdate', player.vast.timeupdate);
      player.off('ended', player.vast.tearDown);
      player.ads.endLinearAdMode();
      if (player.vast.showControls ) {
        player.controls(true);
      }
    };

    player.vast.hideLoadingSpinner = function(e) {
      player.loadingSpinner.el().style.display = "none";
    };


    player.vast.skipCountdown = function (timeLeft) {
      timeLeft = Math.round(timeLeft);
      player.vast.createSkipButton();
      if(timeLeft > 0) {
        player.vast.skipButton.innerHTML = "Skip in " + timeLeft + "...";
      } else {
        if(player.vast.skipButton.innerHTML !== "Skip"){
          player.vast.skipButton.className += " enabled";
          player.vast.skipButton.innerHTML = "Skip";
        }
      }
    };

    player.vast.createSkipButton = function () {
      if (player.vast.skipButton) return;

      player.vast.skipButton = document.createElement("div");
      player.vast.skipButton.className = "vast-skip-button";
      player.el().appendChild(player.vast.skipButton);

      player.vast.skipButton.onclick = player.vast.skipAd;
    };

    player.vast.skipAd = function (e) {
      if(player.vast.skipButton.innerHTML !== "Skip")
        return;

      player.trigger('adskipped');
      player.vast.tearDown();

      if(Event.prototype.stopPropagation !== undefined) {
        e.stopPropagation();
      } else {
        return false;
      }
    };

    player.vast.createSourceObjects = function (media_files) {
      var sourcesByFormat = {}, i, j, tech;
      var techOrder = player.options().techOrder;
      for (i = 0, j = techOrder.length; i < j; i++) {
        var techName = techOrder[i].charAt(0).toUpperCase() + techOrder[i].slice(1);
        tech = window.videojs[techName];

        // Check if the current tech is defined before continuing
        if (!tech) {
          continue;
        }

        // Check if the browser supports this technology
        if (tech.isSupported()) {
          // Loop through each source object
          for (var a = 0, b = media_files.length; a < b; a++) {
            var media_file = media_files[a];
            var source = {type:media_file.mimeType, src:media_file.fileURL};
            // Check if source can be played with this technology
            if (tech.canPlaySource(source)) {
              if (sourcesByFormat[techOrder[i]] === undefined) {
                sourcesByFormat[techOrder[i]] = [];
              }
              sourcesByFormat[techOrder[i]].push({
                type:media_file.mimeType,
                src: media_file.fileURL,
                width: media_file.width,
                height: media_file.height
              });
            }
          }
        }
      }
      // Create sources in preferred format order
      var sources = [];
      for (j = 0; j < techOrder.length; j++) {
        tech = techOrder[j];
        if (sourcesByFormat[tech] !== undefined) {
          for (i = 0; i < sourcesByFormat[tech].length; i++) {
            sources.push(sourcesByFormat[tech][i]);
          }
        }
      }
      return sources;
    };

  };

  vjs.plugin('vast', vastPlugin);
}(window.videojs, window.DMVAST));