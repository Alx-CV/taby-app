/**
 * TABY Main Application Controller
 * Handles screen navigation, event bindings, pillar workflows, and blob integration.
 */

(function (global) {
  'use strict';

  var TabyApp = {
    currentScreen: 'screen-1',
    previousScreen: 'screen-4',
    tabyBlobDash: null,
    tabyBlobChat: null,
    tabyBlobPillar: null,
    directorDash: null,
    directorChat: null,
    sense: null,
    activePillar: null,
    activePillarStep: 1,
    chartRange: '24h',
    hiddenChartLines: {},

    init: function () {
      var self = this;

      // Initialize theme from saved preference
      var theme = TabyState.getTheme();
      TabyState.setTheme(theme);

      // Initialize TabySense
      this.sense = new TabySense();
      this.sense.start();

      // Check returning user status
      if (TabyState.isSetupDone()) {
        this.navigateTo('screen-4', {}, true);
      } else {
        this.navigateTo('screen-1', {}, true);
      }

      this._initBlobs();
      this._bindGlobalEvents();
      this._bindScreen1();
      this._bindScreen2();
      this._bindScreen3();
      this._bindScreen4();
      this._bindScreen5();
      this._bindScreen6();
      this._bindScreen7();
      this._bindScreen8();
      this._bindScreen9();
      this._bindHostControls();
      this.refreshUI();
    },

    _initBlobs: function () {
      var cDash = document.getElementById('blob-canvas-dash');
      if (cDash) {
        this.tabyBlobDash = new TabyBlob(cDash, { mood: 'calm' });
        this.directorDash = new TabyDirector(this.tabyBlobDash);
      }

      var cChat = document.getElementById('blob-canvas-chat');
      if (cChat) {
        this.tabyBlobChat = new TabyBlob(cChat, { mood: 'calm' });
        this.directorChat = new TabyDirector(this.tabyBlobChat);
      }

      var cPillar = document.getElementById('blob-canvas-pillar');
      if (cPillar) {
        this.tabyBlobPillar = new TabyBlob(cPillar, { mood: 'calm' });
      }

      // Configure QwenClient with active blob
      global.tabyClient = new QwenClient({
        blob: this.tabyBlobDash,
        director: this.directorDash
      });
    },

    navigateTo: function (screenId, params, isDirect) {
      params = params || {};
      if (!isDirect) {
        this.previousScreen = this.currentScreen;
      }
      this.currentScreen = screenId;

      // Update active screen view
      var views = document.querySelectorAll('.screen-view');
      views.forEach(function (v) { v.classList.remove('active'); });

      var target = document.getElementById(screenId);
      if (target) {
        target.classList.add('active');
        var viewport = document.getElementById('screen-viewport');
        if (viewport) viewport.scrollTop = 0;
      }

      // Bottom Nav visibility rule (Section 1.5):
      // Visible on Screens 4, 6, 7, 8, 9 only.
      // Hidden on 1, 2, 3, 5, and all pillar screens.
      var nav = document.getElementById('bottom-nav');
      var viewportEl = document.getElementById('screen-viewport');
      var navAllowedScreens = ['screen-4', 'screen-6', 'screen-7', 'screen-8', 'screen-9'];

      if (nav) {
        if (navAllowedScreens.indexOf(screenId) >= 0) {
          nav.style.display = 'flex';
          if (viewportEl) viewportEl.classList.remove('no-nav-padding');

          // Highlight appropriate tab
          var navTabs = document.querySelectorAll('.nav-item');
          navTabs.forEach(function (t) { t.classList.remove('active'); });

          var activeTabKey = 'nav-dashboard';
          if (screenId === 'screen-8') activeTabKey = 'nav-library';
          else if (screenId === 'screen-9') activeTabKey = 'nav-profile';

          var tabBtn = document.getElementById(activeTabKey);
          if (tabBtn) tabBtn.classList.add('active');
        } else {
          nav.style.display = 'none';
          if (viewportEl) viewportEl.classList.add('no-nav-padding');
        }
      }

      // Screen-specific updates
      if (screenId === 'screen-4') {
        this._updateDashboardView();
        if (global.tabyClient && this.tabyBlobDash) {
          global.tabyClient.setBlob(this.tabyBlobDash, this.directorDash);
        }
      } else if (screenId === 'screen-5') {
        this._updateChatView(params);
        if (global.tabyClient && this.tabyBlobChat) {
          global.tabyClient.setBlob(this.tabyBlobChat, this.directorChat);
        }
      } else if (screenId === 'screen-6') {
        this._updateInsightsView();
      } else if (screenId === 'screen-7') {
        this._renderHistoryChart();
      } else if (screenId === 'screen-8') {
        this._updateLibraryView();
      } else if (screenId === 'screen-9') {
        this._updateProfileView();
      }

      this._updateHostScreenSelector();
    },

    goBack: function () {
      // Back behavior (Section 1.6)
      if (this.currentScreen === 'screen-pillar') {
        if (this.activePillarStep === 3) {
          this.setStep(2);
        } else if (this.activePillarStep === 2) {
          this.setStep(1);
        } else {
          this.navigateTo('screen-8');
        }
        return;
      }

      if (this.currentScreen === 'screen-2') {
        this.navigateTo('screen-1');
      } else if (this.currentScreen === 'screen-3') {
        this.navigateTo('screen-2');
      } else if (this.currentScreen === 'screen-6') {
        this.navigateTo('screen-4');
      } else if (this.currentScreen === 'screen-7') {
        this.navigateTo('screen-6');
      } else if (this.previousScreen && this.previousScreen !== this.currentScreen) {
        this.navigateTo(this.previousScreen);
      } else {
        this.navigateTo('screen-4');
      }
    },

    refreshUI: function () {
      var profile = TabyState.getProfile();
      var fName = profile.firstName || 'Alex';
      var initials = (fName.slice(0, 2)).toUpperCase();

      // Update greeting and avatar across views
      var avatarEls = document.querySelectorAll('.user-avatar-initials');
      avatarEls.forEach(function (el) { el.textContent = initials; });

      var greetingEls = document.querySelectorAll('.user-first-name');
      greetingEls.forEach(function (el) { el.textContent = fName; });
    },

    /* =========================================================================
       Screen 1: Demographics & Auth
       ========================================================================= */
    _bindScreen1: function () {
      var self = this;
      var nameInput = document.getElementById('s1-name');
      var emailInput = document.getElementById('s1-email');
      var genderChips = document.querySelectorAll('#s1-gender-chips .select-chip');
      var ageChips = document.querySelectorAll('#s1-age-chips .select-chip');
      var continueBtn = document.getElementById('s1-continue-btn');
      var emailError = document.getElementById('s1-email-error');

      var selectedGender = 'Female';
      var selectedAge = '25–34';

      function validate() {
        var nameVal = (nameInput.value || '').trim();
        var emailVal = (emailInput.value || '').trim();
        var emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);

        if (emailVal && !emailValid) {
          emailError.style.display = 'block';
        } else {
          emailError.style.display = 'none';
        }

        var isValid = nameVal.length >= 1 && nameVal.length <= 30 && emailValid && selectedGender && selectedAge;
        continueBtn.disabled = !isValid;
        if (isValid) {
          continueBtn.classList.remove('disabled');
        } else {
          continueBtn.classList.add('disabled');
        }
        return isValid;
      }

      nameInput.oninput = validate;
      emailInput.oninput = validate;

      genderChips.forEach(function (chip) {
        chip.onclick = function () {
          genderChips.forEach(function (c) { c.classList.remove('selected'); });
          chip.classList.add('selected');
          selectedGender = chip.getAttribute('data-value');
          validate();
        };
      });

      ageChips.forEach(function (chip) {
        chip.onclick = function () {
          ageChips.forEach(function (c) { c.classList.remove('selected'); });
          chip.classList.add('selected');
          selectedAge = chip.getAttribute('data-value');
          validate();
        };
      });

      continueBtn.onclick = function () {
        if (!validate()) return;
        TabyState.saveProfile({
          firstName: nameInput.value.trim(),
          email: emailInput.value.trim(),
          gender: selectedGender,
          ageRange: selectedAge
        });
        self.refreshUI();
        self.navigateTo('screen-2');
      };
    },

    /* =========================================================================
       Screen 2: Terms & Conditions
       ========================================================================= */
    _bindScreen2: function () {
      var self = this;
      var backBtn = document.getElementById('s2-back-btn');
      var agreeBtn = document.getElementById('s2-agree-btn');
      var chkKeyboard = document.getElementById('s2-chk-keyboard');
      var chkVoice = document.getElementById('s2-chk-voice');

      backBtn.onclick = function () { self.navigateTo('screen-1'); };

      agreeBtn.onclick = function () {
        TabyState.saveConsents({
          keyboard: chkKeyboard.checked,
          voice: chkVoice.checked
        });
        self.navigateTo('screen-3');
      };
    },

    /* =========================================================================
       Screen 3: Define Biometrics
       ========================================================================= */
    _bindScreen3: function () {
      var self = this;
      var backBtn = document.getElementById('s3-back-btn');
      var finishBtn = document.getElementById('s3-finish-btn');
      var swKeyboard = document.getElementById('s3-sw-keyboard');
      var swVoice = document.getElementById('s3-sw-voice');
      var noteText = document.getElementById('s3-note-text');

      backBtn.onclick = function () { self.navigateTo('screen-2'); };

      function syncConsents() {
        var k = swKeyboard.checked;
        var v = swVoice.checked;
        TabyState.saveConsents({ keyboard: k, voice: v });
        if (!k && !v) {
          noteText.style.display = 'block';
        } else {
          noteText.style.display = 'none';
        }
      }

      swKeyboard.onchange = syncConsents;
      swVoice.onchange = syncConsents;

      // Disabled sensor cards hint
      var disabledCards = document.querySelectorAll('.disabled-sensor-card');
      disabledCards.forEach(function (card) {
        card.onclick = function () {
          UiPopups.showToast('Sensor module coming soon in this prototype.');
        };
      });

      finishBtn.onclick = function () {
        TabyState.setSetupDone(true);
        self.navigateTo('screen-4');
      };
    },

    /* =========================================================================
       Screen 4: Master Emotional Command Dashboard
       ========================================================================= */
    _bindScreen4: function () {
      var self = this;

      var avatarBtn = document.getElementById('dash-avatar-btn');
      if (avatarBtn) {
        avatarBtn.onclick = function () { self.navigateTo('screen-9'); };
      }

      var gaugeCard = document.getElementById('dash-capacity-card');
      if (gaugeCard) {
        gaugeCard.onclick = function () { self.navigateTo('screen-6'); };
      }

      var insightsLink = document.getElementById('dash-view-insights');
      if (insightsLink) {
        insightsLink.onclick = function (e) {
          e.stopPropagation();
          self.navigateTo('screen-6');
        };
      }

      // Pills
      document.getElementById('dash-pill-connect').onclick = function () { UiPopups.openPillModal('connect'); };
      document.getElementById('dash-pill-regulate').onclick = function () { UiPopups.openPillModal('regulate'); };
      document.getElementById('dash-pill-purpose').onclick = function () { UiPopups.openPillModal('purpose'); };

      // TABY Card
      var tabyCard = document.getElementById('dash-taby-card');
      var recalBtn = document.getElementById('dash-recal-btn');

      if (recalBtn) {
        recalBtn.onclick = function (e) {
          e.stopPropagation();
          UiPopups.startBreathing('pulse', function () {
            self._updateDashboardView();
          });
        };
      }

      if (tabyCard) {
        tabyCard.onclick = function () {
          self.navigateTo('screen-5');
        };
      }
    },

    _updateDashboardView: function () {
      var profile = TabyState.getProfile();
      var fName = profile.firstName || 'Alex';
      this.refreshUI();

      var cap = TabyState.getCapacity();
      var capValEl = document.getElementById('dash-capacity-val');
      var capBarEl = document.getElementById('dash-capacity-bar');
      if (capValEl) capValEl.textContent = cap + '%';

      if (capBarEl) {
        var circleCircumference = 2 * Math.PI * 48; // r=48
        var offset = circleCircumference * (1 - cap / 100);
        capBarEl.style.strokeDasharray = circleCircumference;
        capBarEl.style.strokeDashoffset = offset;
      }

      // If cap has increased
      var cardTextEl = document.getElementById('dash-taby-card-text');
      var recalBtn = document.getElementById('dash-recal-btn');
      if (cap > 82 && cardTextEl && recalBtn) {
        cardTextEl.textContent = "Nice work, " + fName + ". Your capacity moved up by 3 points.";
        recalBtn.textContent = "Open TABY Chat";
        recalBtn.onclick = function (e) {
          e.stopPropagation();
          TabyApp.navigateTo('screen-5');
        };
      }
    },

    /* =========================================================================
       Screen 5: TABY Interactive Chat
       ========================================================================= */
    _bindScreen5: function () {
      var self = this;
      var backBtn = document.getElementById('s5-back-btn');
      var inputEl = document.getElementById('s5-chat-input');
      var sendBtn = document.getElementById('s5-send-btn');
      var micBtn = document.getElementById('s5-mic-btn');
      var msgContainer = document.getElementById('s5-chat-messages');

      backBtn.onclick = function () { self.goBack(); };

      // Attach TabySense typing cadence measurement
      if (this.sense) {
        this.sense.attachTyping(inputEl);
      }

      // Gentle pulse / curious glance when user types
      inputEl.addEventListener('input', function () {
        if (self.tabyBlobChat) {
          self.tabyBlobChat.lookAt(0, 0.6, 1);
        }
      });

      // Mic button behavior (Section 1.9)
      micBtn.onclick = function () {
        // Attempt Web Speech Recognition if available, otherwise show brief toast
        var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
          try {
            var recognition = new SpeechRecognition();
            recognition.lang = 'en-US';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;
            UiPopups.showToast('Listening... Speak now');
            micBtn.style.color = 'var(--teal)';

            recognition.onresult = function (event) {
              var speechResult = event.results[0][0].transcript;
              inputEl.value = speechResult;
              micBtn.style.color = '';
              self._sendMessage(speechResult);
            };

            recognition.onerror = function () {
              micBtn.style.color = '';
              UiPopups.showToast('Voice is coming soon in this prototype.');
            };

            recognition.start();
            return;
          } catch (e) {}
        }
        UiPopups.showToast('Voice is coming soon in this prototype.');
      };

      sendBtn.onclick = function () {
        var text = (inputEl.value || '').trim();
        if (text) {
          self._sendMessage(text);
          inputEl.value = '';
        }
      };

      inputEl.onkeydown = function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          var text = (inputEl.value || '').trim();
          if (text) {
            self._sendMessage(text);
            inputEl.value = '';
          }
        }
      };
    },

    _updateChatView: function (params) {
      params = params || {};
      var msgContainer = document.getElementById('s5-chat-messages');
      if (!msgContainer) return;

      var messages = TabyState.getChatMain();
      var profile = TabyState.getProfile();
      var fName = profile.firstName || 'Alex';

      // NEW: Update the default welcome message to use the real name
      if (messages.length > 0 && messages[0].text && messages[0].text.includes("Welcome back.")) {
        messages[0].text = "Welcome back, " + fName + ". I'm here to support your nervous system today. How are you feeling in your body right now?";
        TabyState.saveChatMain(messages); // Save the updated message so it remembers the name
      }

      // If initial message requested from a pop-up
      if (params.initialMessage) {
        var alreadyExists = messages.some(function (m) { return m.text === params.initialMessage; });
        if (!alreadyExists) {
          var now = new Date();
          var timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
          messages.push({
            id: 'msg-' + Date.now(),
            sender: 'taby',
            text: params.initialMessage,
            time: timeStr
          });
          TabyState.saveChatMain(messages);
        }
      }

      this._renderMessages(messages);
    },

    _renderMessages: function (messages) {
      var msgContainer = document.getElementById('s5-chat-messages');
      if (!msgContainer) return;

      msgContainer.innerHTML = '';
      var self = this;

      messages.forEach(function (m) {
        if (m.type === 'pulse-offer') {
          var card = document.createElement('div');
          card.className = 'system-chat-card';
          card.innerHTML = `
            <span>${m.title}</span>
            <span class="action-tag">${m.actionText || 'Start pulse'}</span>
          `;
          card.onclick = function () {
            UiPopups.startBreathing('pulse');
          };
          msgContainer.appendChild(card);
          return;
        }

        var bubble = document.createElement('div');
        bubble.className = 'chat-bubble ' + (m.sender === 'user' ? 'user-bubble' : 'taby-bubble');

        if (m.isRolePlay) {
          bubble.classList.add('role-play');
          bubble.innerHTML = '<div class="role-play-tag">Role-play with TABY</div>';
        }

        var textSpan = document.createElement('div');
        textSpan.textContent = m.text;
        bubble.appendChild(textSpan);

        // Saved card if returned by AI
        if (m.savedCard) {
          var sc = document.createElement('div');
          sc.className = 'card';
          sc.style.marginTop = '10px';
          sc.style.background = 'var(--panel)';
          sc.innerHTML = `
            <div class="kicker-label" style="color:var(--teal);">${m.savedCard.label || 'SAVED INSIGHT'}</div>
            <div style="font-family:var(--font-serif); font-size:15px; margin:4px 0 8px;">"${m.savedCard.text}"</div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button class="select-chip" id="btn-save-card-${m.id}">Save</button>
              <button class="select-chip" id="btn-rephrase-card-${m.id}">Rephrase</button>
            </div>
          `;
          bubble.appendChild(sc);

          setTimeout(function () {
            var sBtn = document.getElementById('btn-save-card-' + m.id);
            if (sBtn) {
              sBtn.onclick = function () {
                sBtn.textContent = 'Saved ✓';
                sBtn.classList.add('selected');
                UiPopups.showToast('Insight saved.');
              };
            }
            var rBtn = document.getElementById('btn-rephrase-card-' + m.id);
            if (rBtn) {
              rBtn.onclick = function () {
                self._sendMessage("Can you help rephrase this insight?");
              };
            }
          }, 0);
        }

        // Suggested Chips
        if (m.chips && m.chips.length) {
          var chipsWrap = document.createElement('div');
          chipsWrap.className = 'chips-row';
          chipsWrap.style.marginTop = '8px';

          m.chips.forEach(function (chipText) {
            var chip = document.createElement('button');
            chip.className = 'select-chip';
            chip.textContent = chipText;
            chip.onclick = function () {
              self._sendMessage(chipText);
            };
            chipsWrap.appendChild(chip);
          });
          bubble.appendChild(chipsWrap);
        }

        msgContainer.appendChild(bubble);
      });

      msgContainer.scrollTop = msgContainer.scrollHeight;
    },

    _sendMessage: function (text) {
      var self = this;
      var msgContainer = document.getElementById('s5-chat-messages');
      var profile = TabyState.getProfile();
      var fName = profile.firstName || 'Alex';

      var now = new Date();
      var timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

      // Append user bubble
      var userMsg = {
        id: 'msg-' + Date.now(),
        sender: 'user',
        text: text,
        time: timeStr
      };
      TabyState.addChatMessage(userMsg);
      this._renderMessages(TabyState.getChatMain());

      // Show typing indicator
      var typingIndicator = document.createElement('div');
      typingIndicator.id = 'taby-typing-bubble';
      typingIndicator.className = 'chat-bubble taby-bubble';
      typingIndicator.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
      msgContainer.appendChild(typingIndicator);
      msgContainer.scrollTop = msgContainer.scrollHeight;

      // Call Qwen
      global.tabyClient.send(text, { firstName: fName, history: TabyState.getChatMain() }, {
        onSuccess: function (res) {
          var ind = document.getElementById('taby-typing-bubble');
          if (ind) ind.remove();

          var tabyMsg = {
            id: 'msg-' + Date.now(),
            sender: 'taby',
            text: res.reply,
            time: timeStr,
            chips: res.chips,
            savedCard: res.saved_card
          };
          TabyState.addChatMessage(tabyMsg);
          self._renderMessages(TabyState.getChatMain());

          // Safety trigger check (Section 1.8)
          if (res.show_support) {
            setTimeout(function () {
              UiPopups.openSupportSheet();
            }, 600);
          }
        },
        onError: function (err, fallback) {
          var ind = document.getElementById('taby-typing-bubble');
          if (ind) ind.remove();

          var tabyMsg = {
            id: 'msg-' + Date.now(),
            sender: 'taby',
            text: fallback.reply,
            time: timeStr,
            chips: fallback.chips
          };
          TabyState.addChatMessage(tabyMsg);
          self._renderMessages(TabyState.getChatMain());
        }
      });
    },

    /* =========================================================================
       Screen 6: Emotional Insights
       ========================================================================= */
    _bindScreen6: function () {
      var self = this;
      var backBtn = document.getElementById('s6-back-btn');
      var histTopBtn = document.getElementById('s6-hist-top-btn');
      var histBottomBtn = document.getElementById('s6-go-hist-btn');
      var updateBtn = document.getElementById('s6-update-data-btn');

      backBtn.onclick = function () { self.navigateTo('screen-4'); };
      histTopBtn.onclick = function () { self.navigateTo('screen-7'); };
      histBottomBtn.onclick = function () { self.navigateTo('screen-7'); };

      updateBtn.onclick = function () {
        UiPopups.openDataReadingSheet(function () {
          self._updateInsightsView();
        });
      };

      // Proactive prompt buttons
      var yesSchedBtn = document.getElementById('s6-yes-sched');
      var notNowBtn = document.getElementById('s6-not-now');
      var proactiveCard = document.getElementById('s6-proactive-card');

      if (yesSchedBtn) {
        yesSchedBtn.onclick = function () {
          yesSchedBtn.textContent = 'Scheduled ✓';
          yesSchedBtn.classList.add('selected');
          UiPopups.showToast('Breathing pause scheduled for tomorrow 08:30.');
        };
      }

      if (notNowBtn && proactiveCard) {
        notNowBtn.onclick = function () {
          proactiveCard.style.opacity = '0';
          setTimeout(function () { proactiveCard.style.display = 'none'; }, 250);
        };
      }
    },

    _updateInsightsView: function () {
      var donut = TabyState.getBaselineDonut();
      var donutSvg = document.getElementById('s6-donut-svg');
      var donutCenterText = document.getElementById('s6-donut-center');

      // Colors
      var data = [
        { label: 'Joy', pct: donut.joy || 45, color: '#4AC9C0' },
        { label: 'Calm', pct: donut.calm || 35, color: '#7FD9A8' },
        { label: 'Stress', pct: donut.stress || 15, color: '#F2A65A' },
        { label: 'Anger', pct: donut.anger || 5, color: '#B36FC3' }
      ];

      var r = 58;
      var cx = 85;
      var cy = 85;
      var circumference = 2 * Math.PI * r;
      var accumulated = 0;

      var pathsHtml = '';
      data.forEach(function (d, i) {
        var strokeDash = (d.pct / 100) * circumference;
        var offset = -accumulated;
        accumulated += strokeDash;

        pathsHtml += `
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color}" stroke-width="18"
            stroke-dasharray="${strokeDash} ${circumference - strokeDash}"
            stroke-dashoffset="${offset}"
            data-label="${d.label}" data-pct="${d.pct}" class="donut-segment" style="cursor:pointer;" />
        `;
      });

      if (donutSvg) {
        donutSvg.innerHTML = pathsHtml;
        var segments = donutSvg.querySelectorAll('.donut-segment');
        segments.forEach(function (seg) {
          seg.onclick = function () {
            var label = seg.getAttribute('data-label');
            var pct = seg.getAttribute('data-pct');
            var desc = {
              'Joy': 'Vitality & flow',
              'Calm': 'Steady, regulated baseline',
              'Stress': 'Acute nervous activation',
              'Anger': 'Boundary alerts'
            }[label] || 'Emotional telemetry';

            if (donutCenterText) {
              donutCenterText.innerHTML = `
                <div style="font-size:18px; font-weight:700; color:var(--text);">${pct}%</div>
                <div style="font-size:11px; color:var(--muted);">${label}: ${desc}</div>
              `;
            }
          };
        });
      }
    },

    /* =========================================================================
       Screen 7: Historical Fusion Analytics
       ========================================================================= */
    _bindScreen7: function () {
      var self = this;
      var backBtn = document.getElementById('s7-back-btn');
      var backDashBtn = document.getElementById('s7-back-dash-btn');
      var t24h = document.getElementById('s7-tab-24h');
      var t7d = document.getElementById('s7-tab-7d');

      backBtn.onclick = function () { self.navigateTo('screen-6'); };
      backDashBtn.onclick = function () { self.navigateTo('screen-4'); };

      t24h.onclick = function () {
        t24h.classList.add('selected');
        t7d.classList.remove('selected');
        self.chartRange = '24h';
        self._renderHistoryChart();
      };

      t7d.onclick = function () {
        t7d.classList.add('selected');
        t24h.classList.remove('selected');
        self.chartRange = '7d';
        self._renderHistoryChart();
      };
    },

    _renderHistoryChart: function () {
      var chartWrap = document.getElementById('s7-chart-wrap');
      var svg = document.getElementById('s7-chart-svg');
      var tooltip = document.getElementById('s7-tooltip');
      if (!svg) return;

      var is24h = this.chartRange === '24h';
      var consents = TabyState.getConsents();

      // Data series
      var labels = is24h
        ? ['00:00','04:00','08:00','11:00','14:00','17:00','20:00','23:00']
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

      var typingSpeed = is24h
        ? [38, 35, 52, 68, 55, 74, 48, 42]
        : [54, 58, 62, 65, 59, 44, 40];

      var voiceStress = is24h
        ? [22, 18, 45, 72, 48, 76, 38, 25]
        : [48, 52, 66, 68, 55, 30, 24];

      var fusedIndex = is24h
        ? [28, 24, 48, 70, 51, 75, 42, 30]
        : [51, 55, 64, 66, 57, 36, 28];

      var W = 310;
      var H = 160;
      var N = labels.length;

      function toY(val) {
        return H - (val / 100) * (H - 24) - 12;
      }

      function toX(i) {
        return (i / (N - 1)) * (W - 30) + 15;
      }

      function createPath(dataArr) {
        var p = '';
        dataArr.forEach(function (v, i) {
          var x = toX(i);
          var y = toY(v);
          p += (i === 0 ? 'M ' : ' L ') + x.toFixed(1) + ' ' + y.toFixed(1);
        });
        return p;
      }

      var html = `
        <defs>
          <linearGradient id="grad-fuse" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <line x1="15" y1="${H - 12}" x2="${W - 15}" y2="${H - 12}" stroke="var(--border)" stroke-width="1"/>
      `;

      // Draw lines if consents active
      if (consents.keyboard && !this.hiddenChartLines.typing) {
        html += `<path d="${createPath(typingSpeed)}" fill="none" stroke="var(--teal)" stroke-width="2.5" />`;
      }
      if (consents.voice && !this.hiddenChartLines.voice) {
        html += `<path d="${createPath(voiceStress)}" fill="none" stroke="var(--orchid)" stroke-width="2.5" />`;
      }
      if ((consents.keyboard || consents.voice) && !this.hiddenChartLines.fused) {
        html += `<path d="${createPath(fusedIndex)}" fill="none" stroke="#FFFFFF" stroke-width="3" />`;
      }

      // JITAI Marker [D] at 17:00 (index 5)
      var markerIdx = is24h ? 5 : 3;
      var mx = toX(markerIdx);
      var my = toY(fusedIndex[markerIdx]);

      html += `
        <line x1="${mx}" y1="10" x2="${mx}" y2="${H - 12}" stroke="var(--indigo)" stroke-dasharray="3 3" stroke-width="1.5" />
        <g id="jitai-marker-d" style="cursor:pointer;">
          <circle cx="${mx}" cy="${my}" r="9" fill="var(--indigo)" stroke="#0B0F14" stroke-width="2"/>
          <text x="${mx}" y="${my + 3.5}" font-size="9" fill="#FFFFFF" font-weight="700" text-anchor="middle">D</text>
        </g>
      `;

      svg.innerHTML = html;

      // Click on marker D
      var mD = document.getElementById('jitai-marker-d');
      if (mD) {
        mD.onclick = function () {
          UiPopups.openInterventionDetail({
            title: '6-Second Recalibration Pulse',
            time: is24h ? 'Today 17:21' : 'Thursday 16:30',
            deliveredBy: 'DEXTER',
            strainBefore: 75,
            strainAfter: 58,
            delta: '-18%'
          });
        };
      }

      // Interactive scrubber
      chartWrap.onmousemove = function (e) {
        var rect = chartWrap.getBoundingClientRect();
        var rx = e.clientX - rect.left - 15;
        var idx = Math.round(clamp((rx / (W - 30)) * (N - 1), 0, N - 1));

        if (tooltip) {
          tooltip.style.display = 'block';
          tooltip.style.left = (toX(idx) - 20) + 'px';
          tooltip.style.top = '10px';
          tooltip.innerHTML = `
            <strong>${labels[idx]}</strong><br/>
            Typing: ${typingSpeed[idx]} wpm<br/>
            Stress: ${voiceStress[idx]}<br/>
            <span style="color:#FFF;">Fused Index: ${fusedIndex[idx]}</span>
          `;
        }
      };

      chartWrap.onmouseleave = function () {
        if (tooltip) tooltip.style.display = 'none';
      };
    },

    /* =========================================================================
       Screen 8: TABY Library & Module Sheets
       ========================================================================= */
    _bindScreen8: function () {
      var self = this;

      // Module cards
      document.getElementById('lib-mod-parasympathetic').onclick = function () {
        UiPopups.openOverlay(`
          <div class="sheet-content">
            <div class="kicker-label" style="color:var(--teal)">PHYSIOLOGICAL REGULATION</div>
            <h2 class="serif-title" style="margin:4px 0 8px;">Parasympathetic Co-regulation</h2>
            <p class="small-muted" style="margin-bottom:18px;">
              A 60-second synchronized respiratory sequence designed to slow the sinoatrial node and increase heart rate variability (HRV).
            </p>
            <button class="primary-pill-btn" id="start-60s-btn">START 60-SECOND BREATHING</button>
          </div>
        `, {
          sheet: true,
          onClose: function () {}
        });

        document.getElementById('start-60s-btn').onclick = function () {
          UiPopups.startBreathing('exercise');
        };
      };

      document.getElementById('lib-mod-recalibration').onclick = function () {
        UiPopups.openOverlay(`
          <div class="sheet-content">
            <div class="kicker-label" style="color:var(--sage)">ACUTE RESET</div>
            <h2 class="serif-title" style="margin:4px 0 8px;">Agitated Overload Recalibration</h2>
            <p class="small-muted" style="margin-bottom:18px;">
              A single 6-second box breathing pulse. Designed for instant implementation between back-to-back demands.
            </p>
            <button class="primary-pill-btn" id="start-6s-btn">START 6-SECOND PULSE</button>
          </div>
        `, {
          sheet: true
        });

        document.getElementById('start-6s-btn').onclick = function () {
          UiPopups.startBreathing('pulse');
        };
      };

      document.getElementById('lib-mod-offpeak').onclick = function () {
        UiPopups.openOverlay(`
          <div class="sheet-content">
            <div class="kicker-label" style="color:var(--amber)">SKILL MASTERY</div>
            <h2 class="serif-title" style="margin:4px 0 8px;">Off-Peak Skill Building</h2>
            <p class="small-muted" style="margin-bottom:18px;">
              Deepen cognitive resilience during calm moments. Practice boundary rehearsal or identity shifts with TABY.
            </p>
            <button class="primary-pill-btn" id="start-offpeak-btn">PRACTICE WITH TABY</button>
          </div>
        `, {
          sheet: true
        });

        document.getElementById('start-offpeak-btn').onclick = function () {
          UiPopups.closeOverlay();
          self.navigateTo('screen-5', {
            initialMessage: "This is a good calm moment to build a skill. Which pillar would you like to explore, " + (TabyState.getProfile().firstName || 'Alex') + "?"
          });
        };
      };
    },

    _updateLibraryView: function () {
      var self = this;
      var pillars = TabyState.getPillars();
      var listContainer = document.getElementById('lib-pillars-list');
      if (!listContainer) return;

      listContainer.innerHTML = '';
      Object.keys(pillars).forEach(function (k) {
        var p = pillars[k];
        var row = document.createElement('div');
        row.className = 'card interactive';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.cursor = 'pointer';

        var statusBadge = p.completed
          ? '<span class="tag-chip sage-tint">✓ Completed</span>'
          : (p.furthestStep > 1 ? `<span class="tag-chip" style="color:var(--teal)">Step ${p.furthestStep} of 3</span>` : '<span class="tag-chip">3 steps</span>');

        row.innerHTML = `
          <div>
            <div style="font-size:15px; font-weight:600; color:${p.hex};">${p.name}</div>
            <div class="small-muted" style="font-size:12px; margin-top:2px;">${p.description}</div>
          </div>
          <div>${statusBadge}</div>
        `;

        row.onclick = function () {
          self.openPillar(k);
        };
        listContainer.appendChild(row);
      });

      // History list
      var histContainer = document.getElementById('lib-history-list');
      var history = TabyState.getHistory();
      if (histContainer) {
        histContainer.innerHTML = '';
        history.slice(0, 4).forEach(function (h) {
          var hRow = document.createElement('div');
          hRow.className = 'card interactive';
          hRow.style.display = 'flex';
          hRow.style.alignItems = 'center';
          hRow.style.justifyContent = 'space-between';
          hRow.style.padding = '10px 14px';
          hRow.style.marginBottom = '6px';
          hRow.style.cursor = 'pointer';

          hRow.innerHTML = `
            <div>
              <div style="font-weight:600; font-size:13px;">${h.title}</div>
              <div class="small-muted" style="font-size:11px;">${h.time} · Delivered by ${h.deliveredBy || 'DEXTER'}</div>
            </div>
            <div class="tag-chip sage-tint">${h.delta}</div>
          `;
          hRow.onclick = function () {
            UiPopups.openInterventionDetail(h);
          };
          histContainer.appendChild(hRow);
        });
      }
    },

    /* =========================================================================
       Pillar 3-Step Flow (Learn 1/3 -> Practice 2/3 -> Reflect 3/3 -> Completion)
       ========================================================================= */
    openPillar: function (pillarKey) {
      var pillars = TabyState.getPillars();
      var p = pillars[pillarKey];
      if (!p) return;

      this.activePillar = p;
      var stepToOpen = p.completed ? 1 : (p.furthestStep || 1);
      this.setStep(stepToOpen);
      this.navigateTo('screen-pillar');
    },

    setStep: function (stepNum) {
      this.activePillarStep = stepNum;
      var p = this.activePillar;
      if (!p) return;

      // Update progress bar
      var step1Bar = document.getElementById('pillar-step-bar-1');
      var step2Bar = document.getElementById('pillar-step-bar-2');
      var step3Bar = document.getElementById('pillar-step-bar-3');
      var counter = document.getElementById('pillar-step-counter');

      if (counter) counter.textContent = stepNum + '/3';
      [step1Bar, step2Bar, step3Bar].forEach(function (b, idx) {
        if (b) {
          b.style.background = idx < stepNum ? p.hex : 'var(--panel)';
        }
      });

      // Show matching sub-view
      var v1 = document.getElementById('pillar-step-1');
      var v2 = document.getElementById('pillar-step-2');
      var v3 = document.getElementById('pillar-step-3');
      var vComp = document.getElementById('pillar-completion');

      [v1, v2, v3, vComp].forEach(function (v) { if (v) v.style.display = 'none'; });

      if (stepNum === 1) {
        v1.style.display = 'block';
        this._renderPillarLearn(p);
      } else if (stepNum === 2) {
        v2.style.display = 'block';
        this._renderPillarPractice(p);
      } else if (stepNum === 3) {
        v3.style.display = 'block';
        this._renderPillarReflect(p);
      } else if (stepNum === 4) {
        vComp.style.display = 'block';
        this._renderPillarCompletion(p);
      }
    },

    _renderPillarLearn: function (p) {
      var self = this;
      var kicker = document.getElementById('p1-kicker');
      var title = document.getElementById('p1-title');
      var body = document.getElementById('p1-body');
      var tabyCard = document.getElementById('p1-taby-card');
      var practiceBtn = document.getElementById('p1-practice-btn');

      if (kicker) kicker.textContent = p.name.toUpperCase() + ' · LEARN';
      if (title) title.textContent = p.name;
      if (body) {
        body.innerHTML = `
          <p style="margin-bottom:12px;">${p.description}</p>
          <p class="small-muted">
            Stress often originates from internalized scripts and unexamined beliefs. In this pillar, TABY guides you to step back from automated stress reactions and realign with psychological sovereignty.
          </p>
        `;
      }

      tabyCard.onclick = function () {
        UiPopups.openAskTabySheet({ pillar: p.id, step: 1 });
      };

      practiceBtn.onclick = function () {
        p.furthestStep = Math.max(p.furthestStep, 2);
        TabyState.updatePillar(p.id, { furthestStep: p.furthestStep });
        self.setStep(2);
      };
    },

    _renderPillarPractice: function (p) {
      var self = this;
      var title = document.getElementById('p2-title');
      if (title) title.textContent = 'Practice with TABY: ' + p.name;

      var chatBox = document.getElementById('p2-chat-box');
      var input = document.getElementById('p2-input');
      var sendBtn = document.getElementById('p2-send-btn');
      var toReflectBtn = document.getElementById('p2-to-reflect-btn');

      toReflectBtn.onclick = function () {
        p.furthestStep = Math.max(p.furthestStep, 3);
        TabyState.updatePillar(p.id, { furthestStep: p.furthestStep });
        self.setStep(3);
      };

      // Set up initial question if chat empty
      if (!p.practiceChat || p.practiceChat.length === 0) {
        var profile = TabyState.getProfile();
        var fName = profile.firstName || 'Alex';
        var initialQuestions = {
          identity: `Hello ${fName}. Let's find one outdated belief currently adding pressure. What is a rule you hold yourself to that feels heavy?`,
          values: `Hello ${fName}. Which value matters most to you right now? Pick or name one you feel uneasy drifting away from.`,
          clarity: `Hello ${fName}. Let's anchor yourself for upcoming conversations. What is one genuine, happy moment from your week?`,
          needs: `Hello ${fName}. Which essential need has felt most neglected recently? Rest, movement, connection, or autonomy?`,
          emotions: `Hello ${fName}. What emotion has been visiting you most today? Let's peel back what it's trying to protect.`,
          boundaries: `Hello ${fName}. Where in your schedule is someone asking for your time when you truly need to say no?`
        };

        p.practiceChat = [
          { sender: 'taby', text: initialQuestions[p.id] || `Welcome ${fName}. Let's practice ${p.name}.` }
        ];
        TabyState.updatePillar(p.id, { practiceChat: p.practiceChat });
      }

      function renderPracticeMessages() {
        chatBox.innerHTML = '';
        p.practiceChat.forEach(function (m) {
          var b = document.createElement('div');
          b.className = 'chat-bubble ' + (m.sender === 'user' ? 'user-bubble' : 'taby-bubble');
          b.textContent = m.text;
          chatBox.appendChild(b);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
      }
      renderPracticeMessages();

      function sendPracticeMsg() {
        var text = (input.value || '').trim();
        if (!text) return;
        input.value = '';

        p.practiceChat.push({ sender: 'user', text: text });
        renderPracticeMessages();

        var ind = document.createElement('div');
        ind.className = 'chat-bubble taby-bubble';
        ind.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
        chatBox.appendChild(ind);
        chatBox.scrollTop = chatBox.scrollHeight;

        global.tabyClient.send(text, { firstName: TabyState.getProfile().firstName, pillar: p.id, step: 2 }, {
          onSuccess: function (res) {
            ind.remove();
            p.practiceChat.push({ sender: 'taby', text: res.reply });
            if (res.saved_card) {
              p.savedCard = res.saved_card;
              toReflectBtn.classList.remove('secondary-outline-btn');
              toReflectBtn.classList.add('primary-pill-btn');
            }
            TabyState.updatePillar(p.id, { practiceChat: p.practiceChat, savedCard: p.savedCard });
            renderPracticeMessages();
          },
          onError: function () {
            ind.remove();
            p.practiceChat.push({ sender: 'taby', text: "Notice how that feels in your chest. When you feel ready, tap continue to reflect." });
            renderPracticeMessages();
          }
        });
      }

      sendBtn.onclick = sendPracticeMsg;
      input.onkeydown = function (e) {
        if (e.key === 'Enter') sendPracticeMsg();
      };
    },

    _renderPillarReflect: function (p) {
      var self = this;
      var qEl = document.getElementById('p3-question');
      var journalArea = document.getElementById('p3-journal');
      var finishBtn = document.getElementById('p3-finish-btn');
      var tabyBar = document.getElementById('p3-taby-bar');

      var questions = {
        identity: 'How have your past experiences shaped who you are becoming today?',
        values: 'Where do you notice a gap between your core values and your daily calendar?',
        clarity: 'Name one thing today that reflects who you are choosing to become.',
        needs: 'How does your body feel when this need is nourished vs neglected?',
        emotions: 'What does this emotion reveal about what matters most deeply to you?',
        boundaries: 'Where could saying no protect something profoundly important to you?'
      };

      if (qEl) qEl.textContent = questions[p.id] || 'What is your reflection on this pillar?';
      if (journalArea) {
        journalArea.value = p.journal || '';
        journalArea.oninput = function () {
          p.journal = journalArea.value;
          TabyState.updatePillar(p.id, { journal: p.journal });
          var hasText = journalArea.value.trim().length > 0;
          finishBtn.disabled = !hasText;
          if (hasText) finishBtn.classList.remove('disabled');
          else finishBtn.classList.add('disabled');
        };
      }

      tabyBar.onclick = function () {
        UiPopups.openAskTabySheet({ pillar: p.id, step: 3 });
      };

      finishBtn.onclick = function () {
        p.completed = true;
        p.furthestStep = 3;
        TabyState.updatePillar(p.id, { completed: true, furthestStep: 3 });
        self.setStep(4); // Completion
      };
    },

    _renderPillarCompletion: function (p) {
      var self = this;
      var sub = document.getElementById('p-comp-sub');
      if (sub) sub.textContent = 'Pillar complete: ' + p.name;

      var toLibBtn = document.getElementById('p-comp-lib-btn');
      var toChatBtn = document.getElementById('p-comp-chat-btn');

      toLibBtn.onclick = function () {
        self.navigateTo('screen-8');
      };

      toChatBtn.onclick = function () {
        self.navigateTo('screen-5', {
          initialMessage: "Well done, " + (TabyState.getProfile().firstName || 'Alex') + ". You've completed " + p.name + ". What stood out for you?"
        });
      };
    },

    /* =========================================================================
       Screen 9: Profile, Settings & Sovereignty Management
       ========================================================================= */
    _bindScreen9: function () {
      var self = this;
      var editProfileBtn = document.getElementById('s9-edit-profile-btn');
      var manageSubBtn = document.getElementById('s9-manage-sub-btn');
      var themeToggle = document.getElementById('s9-theme-toggle');
      var swKbd = document.getElementById('s9-sw-keyboard');
      var swVoice = document.getElementById('s9-sw-voice');
      var deleteBtn = document.getElementById('s9-delete-all-btn');

      // Edit profile sheet
      editProfileBtn.onclick = function () {
        var profile = TabyState.getProfile();
        UiPopups.openOverlay(`
          <div class="sheet-content">
            <h2 class="serif-title" style="margin-bottom:14px;">Edit Profile</h2>
            <div class="form-group">
              <label class="form-label">First Name</label>
              <input type="text" id="edit-fName" class="text-input" value="${profile.firstName || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" id="edit-email" class="text-input" value="${profile.email || ''}" />
            </div>
            <div style="display:flex; gap:10px; margin-top:20px;">
              <button class="primary-pill-btn" id="save-profile-btn">SAVE</button>
              <button class="secondary-outline-btn" id="cancel-profile-btn">CANCEL</button>
            </div>
          </div>
        `, { sheet: true });

        document.getElementById('save-profile-btn').onclick = function () {
          var fN = document.getElementById('edit-fName').value.trim();
          var em = document.getElementById('edit-email').value.trim();
          if (fN && em) {
            TabyState.saveProfile(Object.assign(profile, { firstName: fN, email: em }));
            self.refreshUI();
            self._updateProfileView();
            UiPopups.closeOverlay();
            UiPopups.showToast('Profile updated.');
          }
        };

        document.getElementById('cancel-profile-btn').onclick = function () {
          UiPopups.closeOverlay();
        };
      };

      // Subscription sheet
      manageSubBtn.onclick = function () {
        UiPopups.openOverlay(`
          <div class="sheet-content">
            <div class="tag-chip sage-tint" style="margin-bottom:8px;">ACTIVE PRO TIER</div>
            <h2 class="serif-title" style="margin-bottom:8px;">Your Sovereignty Plan</h2>
            <p class="small-muted" style="margin-bottom:14px;">Unlimited live Qwen AI companionship, full 6-Pillar guidance, and continuous biometric phenotyping.</p>
            <div class="small-muted" style="font-size:11px; margin-bottom:18px;">Billing is not part of this prototype preview.</div>
            <button class="primary-pill-btn" id="close-sub-btn">CLOSE</button>
          </div>
        `, { sheet: true });

        document.getElementById('close-sub-btn').onclick = function () {
          UiPopups.closeOverlay();
        };
      };

      // Theme toggle
      themeToggle.onchange = function () {
        var newTheme = themeToggle.checked ? 'light' : 'dark';
        TabyState.setTheme(newTheme);
      };

      // Biometric consents switches
      function onConsentChange() {
        var k = swKbd.checked;
        var v = swVoice.checked;
        TabyState.saveConsents({ keyboard: k, voice: v });
      }
      swKbd.onchange = onConsentChange;
      swVoice.onchange = onConsentChange;

      // Delete all data confirmation dialog
      deleteBtn.onclick = function () {
        UiPopups.openOverlay(`
          <div style="text-align:center;">
            <h2 class="serif-title" style="margin-bottom:8px;">Delete all my data?</h2>
            <p class="small-muted" style="margin-bottom:20px; line-height:1.5;">
              This removes your profile, chats, reflections, and progress from this device. This cannot be undone.
            </p>
            <div style="display:flex; flex-direction:column; gap:10px;">
              <button class="primary-pill-btn" style="background:var(--amber); color:#0B0F14;" id="confirm-del-btn">DELETE EVERYTHING</button>
              <button class="secondary-outline-btn" id="cancel-del-btn">CANCEL</button>
            </div>
          </div>
        `);

        document.getElementById('confirm-del-btn').onclick = function () {
          TabyState.resetAllData();
          UiPopups.closeOverlay();
          UiPopups.showToast('All your data has been deleted.');
          self.init();
        };

        document.getElementById('cancel-del-btn').onclick = function () {
          UiPopups.closeOverlay();
        };
      };
    },

    _updateProfileView: function () {
      var profile = TabyState.getProfile();
      var consents = TabyState.getConsents();
      var theme = TabyState.getTheme();

      var nameEl = document.getElementById('s9-profile-name');
      var emailEl = document.getElementById('s9-profile-email');
      var swKbd = document.getElementById('s9-sw-keyboard');
      var swVoice = document.getElementById('s9-sw-voice');
      var themeToggle = document.getElementById('s9-theme-toggle');

      if (nameEl) nameEl.textContent = profile.firstName || 'Alex';
      if (emailEl) emailEl.textContent = profile.email || 'alex@example.com';
      if (swKbd) swKbd.checked = !!consents.keyboard;
      if (swVoice) swVoice.checked = !!consents.voice;
      if (themeToggle) themeToggle.checked = (theme === 'light');
    },

    /* =========================================================================
       Global Navigation & Host Bars
       ========================================================================= */
    _bindGlobalEvents: function () {
      var self = this;

      // Bottom nav
      document.getElementById('nav-dashboard').onclick = function () { self.navigateTo('screen-4'); };
      document.getElementById('nav-chat').onclick = function () { self.navigateTo('screen-5'); };
      document.getElementById('nav-library').onclick = function () { self.navigateTo('screen-8'); };
      document.getElementById('nav-profile').onclick = function () { self.navigateTo('screen-9'); };

      // Pillar X button
      var pClose = document.getElementById('pillar-close-btn');
      if (pClose) {
        pClose.onclick = function () { self.navigateTo('screen-8'); };
      }
      var pBack = document.getElementById('pillar-back-btn');
      if (pBack) {
        pBack.onclick = function () { self.goBack(); };
      }
    },

    _bindHostControls: function () {
      var self = this;
      var frame = document.getElementById('phone-frame');
      var viewToggleBtn = document.getElementById('host-view-toggle');
      var screenSelect = document.getElementById('host-screen-select');

      if (viewToggleBtn) {
        viewToggleBtn.onclick = function () {
          var isFull = frame.classList.toggle('fullscreen-mode');
          viewToggleBtn.textContent = isFull ? 'Phone Frame' : 'Full Screen';
        };
      }

      if (screenSelect) {
        screenSelect.onchange = function () {
          self.navigateTo(screenSelect.value);
        };
      }
    },

    _updateHostScreenSelector: function () {
      var screenSelect = document.getElementById('host-screen-select');
      if (screenSelect) {
        screenSelect.value = this.currentScreen;
      }
    }
  };

  global.TabyApp = TabyApp;
  document.addEventListener('DOMContentLoaded', function () {
    TabyApp.init();
  });

})(typeof window !== 'undefined' ? window : globalThis);
