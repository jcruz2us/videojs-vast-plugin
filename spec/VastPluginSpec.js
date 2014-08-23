(function(window, vjs, vast) {
  "use strict";

  var player, isHtmlSupported, oldClearImmediate;

  beforeEach(function() {
    var id = "vid";
    (function() {
      var video = document.createElement("video");
      video.id = id;
      video.src = "http://vjs.zencdn.net/v/oceans.mp4";
      video.setAttribute = "controls";
      document.body.appendChild(video);
      isHtmlSupported = vjs.Html5.isSupported;
      if (/phantomjs/gi.test(window.navigator.userAgent)) {
        // PhantomJS doesn't have a video element implementation
        // force support here so that the HTML5 tech is still used during
        // command-line test runs
        videojs.Html5.isSupported = function() {
          return true;
        };

        // provide implementations for any video element functions that are
        // used in the tests
        video.load = function() {};
        video.play = function() {};

        // see https://github.com/videojs/videojs-contrib-ads/blob/master/test/videojs.ads.test.js#L23
        window.setImmediate = function(callback) {
          callback.call(window);
        };
        oldClearImmediate = window.clearImmediate;
      }
    })();
    player = vjs(id);
    player.ads();
    player.vast({
      url: ""
    });
  });


  afterEach(function() {
    player.dispose();
    vjs.Html5.isSupported = isHtmlSupported;
    window.clearImmediate = oldClearImmediate;
  });


  describe("Requirements", function() {

    beforeEach(function() {
      var video = document.createElement("video");
      video.setAttribute = "controls";
      document.body.appendChild(video);
      this.p = vjs(video);
    });

    afterEach(function() {
      this.p.dispose();
    });

    it("should bail out if player.ads isn't defined", function() {
      spyOn(console, "log");
      spyOn(this.p.vast, "createSourceObjects");
      this.p.ads = undefined;
      this.p.vast({url:"i wanna go VAST!"});
      expect(console.log).toHaveBeenCalledWith(jasmine.any(String));
      expect(this.p.vast.createSourceObjects).not.toHaveBeenCalled();
    });

    it("should bail out if no url is provided", function() {
      spyOn(this.p.vast, "createSourceObjects");
      spyOn(this.p, "trigger");
      this.p.ads();
      this.p.vast({});
      expect(this.p.trigger).toHaveBeenCalledWith("adtimeout");
      expect(this.p.vast.createSourceObjects).not.toHaveBeenCalled();
    });
  });


  describe("Public methods", function() {

    describe("createSourceObjects", function() {

      it("should return objects with 'src', 'type', 'width', and 'height' properties", function() {
        var media_files = [
          {
            fileURL: "TRL",
            mimeType: "video/webm",
            width: 640,
            height: 360
          },
          {
            fileURL: "BuddhaForRill",
            mimeType: "video/mp4",
            width: 0,
            height: 0
          }
        ];
        var sources = player.vast.createSourceObjects(media_files);
        for (var s in sources) {
          expect(sources[s].src).toBeDefined();
          expect(sources[s].type).toBeDefined();
          expect(sources[s].width).toBeDefined();
          expect(sources[s].height).toBeDefined();
        }
      });

      //phantomjs does not support video
      xit("should not accept all video formats", function() {
        var media_files = [
          {
            fileURL: "TRL",
            mimeType: "video/flv",
            width: 640,
            height: 360
          },
          {
            fileURL: "So Trill",
            mimeType: "video/x-flv",
            width: 512,
            height: 288
          },
          {
            fileURL: "Skrill, WHERES MY SKRILL",
            mimeType: "video/mpeg",
            width: 0,
            height: 0
          },
          {
            fileURL: "Jack and Jill",
            mimeType: "video/ogg",
            width: 1280,
            height: 720
          },
          {
            fileURL: "-- Code Raps -- ",
            mimeType: "hls/playlist.m3u8",
            width: 640,
            height: 480
          },
          {
            fileURL: "I'm tapped",
            mimeType: "video/avi",
            width: 512,
            height: 384
          },
          {
            fileURL: "BuddhaForRill",
            mimeType: "video/mp4",
            width: 1920,
            height: 1080
          }
        ];
        var sources = player.vast.createSourceObjects(media_files);
        expect(sources.length).toBe(1);
      });

      //phantomjs does not support video
      xit("can return sources with duplicate formats", function() {
        var media_files = [
          {
            fileURL: "TRL",
            mimeType: "video/mp4",
            width: 640,
            height: 360
          },
          {
            fileURL: "BuddhaForRill",
            mimeType: "video/mp4",
            width: 853,
            height: 480
          }
        ];
        var sources = player.vast.createSourceObjects(media_files);
        expect(sources.length).toBe(2);
      });

    });
    
    describe("tearDown", function() {

      beforeEach(function() {
        player.vastTracker = {
          removeListener: function () {}
        };
      });

      it("should end the linear ad", function() {
        spyOn(player.ads, "endLinearAdMode");
        spyOn(player, "off");

        // TODO: fix this
        player.vast.skipButton = document.createElement("div");
        player.el().appendChild(player.vast.skipButton);
        player.vast.blocker = document.createElement("a");
        player.el().insertBefore(player.vast.blocker, player.controlBar.el());

        player.vast.tearDown();
        expect(player.off).toHaveBeenCalledWith("ended", jasmine.any(Function));
        expect(player.ads.endLinearAdMode).toHaveBeenCalled();
      });

      it("should stop listening for the 'skip-countdown' event", function () {
        spyOn(player.vastTracker, "removeListener");
  
        player.vast.tearDown();

        //make sure the listener is set with the correct handler
        expect(player.vastTracker.removeListener)
          .toHaveBeenCalledWith("skip-countdown", player.vast.skipCountdown);
      });


      it("should remove the skip button", function () {
        player.vast.skipCountdown(0);

        var removeChildSpy = spyOn(player.vast.skipButton.parentNode, "removeChild");
        //keep a reference to the skip button
        //before its removed so we can check that it removed
        var skipButton = player.vast.skipButton;

        player.vast.tearDown();

        //make sure the listener is set with the correct handler
        expect(removeChildSpy).toHaveBeenCalledWith(skipButton);
        expect(player.vast.skipButton).not.toBeDefined();
      });
    });

    describe("preroll", function() {

      beforeEach(function() {
        player.vastTracker = {
          clickThroughURLTemplate: "a whole new page",
          clickTrackingURLTemplate: "a new fantastic advertisement",
          trackURLs: function(){},
          progressFormated: function(){},
          on: function () {}
        };
        player.vast.sources = [];
      });

      it("should start the ad", function() {
        spyOn(player.ads, "startLinearAdMode");
        spyOn(player, "src");
        player.vast.preroll();
        expect(player.ads.startLinearAdMode).toHaveBeenCalled();
        expect(player.src).toHaveBeenCalledWith(jasmine.any(Array));
      });

      it("should end the ad", function() {
        spyOn(player, "one");
        player.vast.preroll();
        expect(player.one).toHaveBeenCalledWith("ended", jasmine.any(Function));
      });

      it("should listen for the skip-countdown event from the vastTracker", function() {
        var timeLeft = 5;      
        spyOn(player.vastTracker, "on");
  
        player.vast.preroll();

        //make sure the listener is set with the correct handler
        expect(player.vastTracker.on).toHaveBeenCalledWith("skip-countdown", player.vast.skipCountdown);
      });

      it("should remove the loading spinner on timeupdate", function () {
        spyOn(player.vast, "hideLoadingSpinner");
  
        player.vast.preroll();
        player.trigger('timeupdate');
        //make sure the listener is set with the correct handler
        expect(player.vast.hideLoadingSpinner).toHaveBeenCalled();
      });

    });

    describe("getContent", function() {
      it("should bail out if there aren't playable media files", function() {
        spyOn(vast.client, "get").and.callFake(function(url, callback){
            var fake_response = {
              ads: [{
                creatives:[{
                  type: "linear",
                  mediaFiles: [{fileURL:"0", mimeType:"n0t-r34l"}]
                }]
              }]
            };
            callback(fake_response);
          });
      
        spyOn(player, "trigger");
        player.vast.getContent("some url");
        expect(player.trigger).toHaveBeenCalledWith("adtimeout");
      });

      describe("linear ads", function() {
        beforeEach(function() {
          spyOn(vast.client, "get")
            .and.callFake(function(url, callback){
              var fake_response = {
                ads: [{
                  creatives:[{
                    type: "linear",
                    mediaFiles: [{fileURL:"hunt", mimeType:"video/webm"}]
                  }]
                }]
              };
              callback(fake_response);
            });
        });

        //phantomjs does not support video
        xit("should create a vast tracker", function() {
          spyOn(vast, "tracker");
          player.vast.getContent("some url");
          expect(vast.tracker).toHaveBeenCalled();
          expect(player.vastTracker).toBeDefined();
        });

        //phantomjs does not support video
        xit("should guarantee that assetDuration is defined", function() {
          spyOn(vast, "tracker").and.returnValue({
            setProgress: function(){}
          });
          spyOn(player, "duration").and.returnValue(11);
          spyOn(player, "currentTime").and.returnValue(11);
          player.vast.getContent("some url");

          /* 
            Forcing some implementation here, but the
            duration fail-safe is a hack anyway.
          */
          player.trigger("timeupdate");
          expect(player.vastTracker.assetDuration).toBe(11);
        });

        //phantomjs does not support video
        xit("should trigger the 'adsready' event", function() {
          spyOn(player, "trigger");
          player.vast.getContent("some url");
          expect(player.trigger).toHaveBeenCalledWith("adsready");
        });
      });

      describe("non-linear ads", function() {
        beforeEach(function() {
          spyOn(vast.client, "get")
            .and.callFake(function(url, callback){
              var fake_response = {
                ads: [{
                  creatives:[{
                    type: "non-linear",
                    mediaFiles: [{}]
                  }],
                  errorURLTemplates: "error!"
                }]
              };
              callback(fake_response);
            });
        });
        it("should do nothing with non-linear ads, and report the error", function() {
          spyOn(vast.util, "track");
          spyOn(player, "trigger");
          player.vast.getContent("some url");
          expect(vast.util.track).toHaveBeenCalledWith(
            jasmine.any(String), jasmine.any(Object)
          );
          expect(player.trigger).toHaveBeenCalledWith("adtimeout");
        });
      });
    });
  });


  describe("skip button", function () {

    afterEach(function () {
      //clear out any previous skip button
      delete player.vast.skipButton;
    });

    describe("skipCountdown", function () {
      it("should create the skip button", function () {
        spyOn(player.vast, 'createSkipButton').and.callThrough();
        
        player.vast.skipCountdown(5);
        
        expect(player.vast.createSkipButton).toHaveBeenCalled();
      });

      describe("called with time left", function () {
        it("should display the time left in the skip button", function () {
          //the function will receive floats
          player.vast.skipCountdown(5.3434123);
          expect(player.vast.skipButton.innerHTML).toBe("Skip in 5...");
        });

        it("should disable the skip button", function () {
          player.vast.skipCountdown(5);
          expect(' ' + player.vast.skipButton.className + ' ').not.toContain("enabled");
        });
      });

      describe("called with no time left", function () {
        it("should display 'Skip' in the skip button", function () {
          player.vast.skipCountdown(0);
          expect(player.vast.skipButton.innerHTML).toBe("Skip");
        });

        it("should enabled the skip button", function () {
          player.vast.skipCountdown(0);
          expect(' ' + player.vast.skipButton.className + ' ').toContain("enabled");
        });
      });

    });

    describe("createSkipButton", function () {
      it("should create a button", function () {
        spyOn(document, 'createElement').and.callThrough();
        player.vast.createSkipButton();
        
        expect(document.createElement).toHaveBeenCalledWith('div');
        expect(player.vast.skipButton).toBeDefined();
        expect(' ' + player.vast.skipButton.className + ' ').toContain(" vast-skip-button ");
      });

      it("should create a button only once", function () {
        spyOn(document, 'createElement').and.callThrough();

        player.vast.createSkipButton();
        player.vast.createSkipButton();
        
        expect(document.createElement.calls.count()).toEqual(1);
      });

      it("should append the button to the video element parent", function () {
        var spy = spyOn(player.el(), 'appendChild');
        player.vast.createSkipButton();
        expect(spy).toHaveBeenCalledWith(player.vast.skipButton);
      });

      it("should make the button skip the ad on click", function () {
        spyOn(player.vast, 'skipAd');

        player.vast.createSkipButton();
        player.vast.skipButton.onclick();

        expect(player.vast.skipAd).toHaveBeenCalled();
      });
    });

    describe("skipAd", function () {
      var dummyEvent = {
        stopPropagation: function () {}
      };

      describe("called when no time is left", function () {
        it("should trigger 'adskipped' and teardown", function () {
          spyOn(player, 'trigger');
          spyOn(player.vast, 'tearDown');

          player.vast.skipCountdown(0);
          player.vast.skipAd(dummyEvent);

          expect(player.trigger).toHaveBeenCalledWith('adskipped');
          expect(player.vast.tearDown).toHaveBeenCalled();
        });
      });

      describe("called when time is left", function () {
        it("should not skip the ad", function () {
          spyOn(player, 'trigger');
          spyOn(player.vast, 'tearDown');

          player.vast.skipCountdown(5);
          player.vast.skipAd(dummyEvent);

          expect(player.trigger).not.toHaveBeenCalled();
          expect(player.vast.tearDown).not.toHaveBeenCalled();
        });
      });
    });

  });

  describe("hideLoadingSpinner", function () {
    it("should hide the loading spinner", function () {
      player.vast.hideLoadingSpinner();

      expect(player.loadingSpinner.el().style.display).toBe("none");
    });
  });

})(window, videojs, DMVAST);
