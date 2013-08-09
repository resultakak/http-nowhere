Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://http-nowhere/content/prefs.js");
Components.utils.import("chrome://http-nowhere/content/recent.js");

if ("undefined" === typeof(httpNowhere)) var httpNowhere = {};

httpNowhere.button = {

  init: function() {
    // Add the button, update the view, and show the installed message, if needed
    setTimeout(function() {
      if (httpNowhere.prefs.isFirstRun()) {
        // put the button on the toolbar if not already there
        var navbar = document.getElementById("nav-bar");
        var curSet = navbar.currentSet;
        if (curSet.indexOf("httpNowhere-button") == -1) {
           // put it just before the urlbar if present
           var set = curSet.replace(/urlbar-container/, "httpNowhere-button,urlbar-container");
           if (set.indexOf("httpNowhere-button") == -1) {
             // otherwise, put it on the far right
             set = curSet + ',httpNowhere-button';
           }
           navbar.setAttribute('currentset', set);
           navbar.currentSet = set;
           document.persist('nav-bar', 'currentset');
        }
        // give a quick one-time usage message
        Services.prompt.alert(null, "HTTP Nowhere is now installed", "Click the lock button to enable or disable it.\n\nWhile enabled, unencrypted web requests will fail.");
        httpNowhere.prefs.setFirstRun(false);
      }
      httpNowhere.button.updateButtonAppearance();
    }, 500);

    // Observe interesting stuff
    Services.obs.addObserver(httpNowhere.button, "http-on-modify-request", false);
  },

  observe: function(subject, topic, data) {
    if (topic == "http-on-modify-request" && httpNowhere.prefs.isEnabled()) {
      var request = subject.QueryInterface(Ci.nsIHttpChannel);
      if (request.URI.scheme == "http" && request.URI.host != 'localhost') {
        // signal that a block has occurred by briefly changing the badge
        var button = document.getElementById("httpNowhere-button");
        if (button != null) {
          if (button.getAttribute('status') != 'blocking') {
            button.setAttribute('status', 'blocking');
            setTimeout(function() {
              httpNowhere.button.updateButtonAppearance();
            }, 500);
          }
        }
        // abort the request
        request.cancel(Components.results.NS_ERROR_ABORT);
        // update the recent list 
        httpNowhere.recent.addURI(request.URI);
      }
    }
  },

  updateButtonAppearance: function() {
    var button = document.getElementById("httpNowhere-button");
    if (button != null) {
      if (httpNowhere.prefs.isEnabled()) {
        button.setAttribute('status', 'enabled');
        if (httpNowhere.recent.blockCount == 0) {
          button.setAttribute('badgeLabel', '');
        } else {
          button.setAttribute('badgeLabel', httpNowhere.recent.blockCount);
        }
        button.tooltipText = "HTTP Nowhere (Enabled)";
      } else {
        button.setAttribute('status', 'disabled');
        button.setAttribute('badgeLabel', '');
        button.tooltipText = "HTTP Nowhere (Disabled)";
      }
    }
  },

  updateTopMenu: function() {
    // TODO: get urls from dtd
    var onImage = "chrome://http-nowhere/skin/button-on.png";
    var offImage = "chrome://http-nowhere/skin/button-off.png";
    var toggle = document.getElementById("httpNowhere-toggle");
    if (httpNowhere.prefs.isEnabled()) {
      toggle.image = offImage;
      toggle.label = "Disable HTTP Nowhere";
    } else {
      toggle.image = onImage;
      toggle.label = "Enable HTTP Nowhere";
    }

    var recentlyBlocked = document.getElementById("httpNowhere-recently-blocked");
    recentlyBlocked.label = "Recent Blocks (" + httpNowhere.recent.blockCount + ")";
  },

  updateRecentMenu: function() {
    var recentlyBlockedPopup = document.getElementById("httpNowhere-recently-blocked-popup");
    while (recentlyBlockedPopup.firstChild.tagName != "menuseparator") {
      recentlyBlockedPopup.removeChild(recentlyBlockedPopup.firstChild);
    }

    var orderedHostnames = httpNowhere.recent.getKeysOrderedByLastBlockedDate(httpNowhere.recent.hostInfo);
    Services.console.logStringMessage(orderedHostnames);
    for (var i = 0; i < orderedHostnames.length; i++) {
      var hostname = orderedHostnames[i];
      var hostInfo = httpNowhere.recent.hostInfo[orderedHostnames[i]];
      Services.console.logStringMessage("hostInfo[" + hostname + "]: " + JSON.stringify(hostInfo));
      var menuitem = document.createElement("menuitem");
      menuitem.setAttribute('label', hostname + " (" + hostInfo.blockCount + ")");
      recentlyBlockedPopup.insertBefore(menuitem, recentlyBlockedPopup.firstChild);
    }
  },

  toggle: function() {
    httpNowhere.prefs.setEnabled(!httpNowhere.prefs.isEnabled());
    httpNowhere.button.updateButtonAppearance();
  },

  clearRecent: function() {
    httpNowhere.recent.clear();
    httpNowhere.button.updateButtonAppearance();
  }
}

window.addEventListener("load", httpNowhere.button.init, false);
