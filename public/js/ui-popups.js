/**
 * TABY UI Popups, Modals, Bottom Sheets & Breathing Overlay
 * Adheres strictly to Section 1.2, 1.3, 1.8, 1.10 & Section 4 of Build Brief.
 */

(function (global) {
  'use strict';

  var UiPopups = {
    activeModal: null,
    breathingTimer: null,
    breathingInterval: null,

    /**
     * Show a transient toast notification (Section 1.3)
     */
    showToast: function (text, onAction) {
      var container = document.getElementById('toast-container');
      if (!container) return;

      var toast = document.createElement('div');
      toast.className = 'taby-toast';
      toast.innerHTML = '<span>' + text + '</span>';

      toast.onclick = function () {
        if (onAction) onAction();
        toast.classList.add('hide');
        setTimeout(function () { toast.remove(); }, 250);
      };

      container.appendChild(toast);

      setTimeout(function () {
        toast.classList.add('visible');
      }, 20);

      setTimeout(function () {
        toast.classList.remove('visible');
        toast.classList.add('hide');
        setTimeout(function () { toast.remove(); }, 300);
      }, 3000);
    },

    /**
     * Open an overlay container with blurred backdrop and top-right X button (Section 1.2)
     */
    openOverlay: function (contentHtml, opts) {
      opts = opts || {};
      this.closeOverlay();

      var backdrop = document.getElementById('overlay-backdrop');
      var container = document.getElementById('overlay-container');
      if (!backdrop || !container) return;

      var isSheet = !!opts.sheet;
      container.className = isSheet ? 'overlay-sheet' : 'overlay-card';

      var html = '<button class="overlay-x-btn" aria-label="Close" id="overlay-x-btn">&times;</button>';
      html += contentHtml;

      container.innerHTML = html;
      backdrop.classList.add('active');
      document.body.classList.add('modal-open');

      var self = this;
      document.getElementById('overlay-x-btn').onclick = function () {
        if (opts.onClose) opts.onClose();
        self.closeOverlay();
      };

      if (!opts.ignoreBackdrop) {
        backdrop.onclick = function (e) {
          if (e.target === backdrop) {
            if (opts.onClose) opts.onClose();
            self.closeOverlay();
          }
        };
      } else {
        backdrop.onclick = null;
      }

      this.activeModal = { opts: opts };
    },

    closeOverlay: function () {
      var backdrop = document.getElementById('overlay-backdrop');
      var container = document.getElementById('overlay-container');
      if (backdrop) backdrop.classList.remove('active');
      if (container) container.innerHTML = '';
      document.body.classList.remove('modal-open');
      this.activeModal = null;
    },

    /**
     * Reusable Breathing Overlay (Section 1.10)
     * Handles 6-second Recalibration Pulse and 60-second Breathing Exercise
     */
    startBreathing: function (type, onDoneCallback) {
      var isPulse = type === 'pulse'; // 6s pulse vs 60s exercise
      var totalSeconds = isPulse ? 6 : 60;
      var cycles = isPulse ? 1 : 6;
      var inhaleTime = isPulse ? 2 : 4;
      var holdTime = 2;
      var exhaleTime = isPulse ? 2 : 4;
      var cycleLength = inhaleTime + holdTime + exhaleTime;
      var deltaPercent = isPulse ? '-18%' : '-22%';
      var title = isPulse ? '6-Second Recalibration Pulse' : '60-Second Breathing Exercise';

      var remaining = totalSeconds;
      var currentPhase = 'Inhale';
      var self = this;
      var completedNormally = false;

      var contentHtml = `
        <div class="breathing-content">
          <div class="kicker-label" style="color:var(--teal)">BREATHE WITH TABY</div>
          <h2 class="serif-title" style="margin: 4px 0 16px;">${title}</h2>
          
          <div class="breathing-ring-wrapper">
            <div class="breathing-ring-outer"></div>
            <div class="breathing-ring-pulse" id="b-ring"></div>
            <div class="breathing-center-text" id="b-counter">${remaining}s</div>
          </div>
          
          <div class="breathing-phase-label" id="b-phase">Inhale slowly...</div>
          <div class="small-muted" style="margin-top: 6px;">Feel your chest soften</div>
        </div>
      `;

      this.openOverlay(contentHtml, {
        ignoreBackdrop: true,
        onClose: function () {
          clearInterval(self.breathingInterval);
          if (!completedNormally) {
            // Early exit rule (Section 1.10)
            self.showToast('Suggestion saved to TABY Chat history.');
            var now = new Date();
            var timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
            TabyState.addChatMessage({
              sender: 'system',
              type: 'pulse-offer',
              title: title + ' offered at ' + timeStr,
              actionText: 'Start pulse',
              time: timeStr
            });
          }
        }
      });

      var ringEl = document.getElementById('b-ring');
      var counterEl = document.getElementById('b-counter');
      var phaseEl = document.getElementById('b-phase');

      function updatePhase(secPassed) {
        var cycleSec = secPassed % cycleLength;
        if (cycleSec < inhaleTime) {
          phaseEl.textContent = 'Inhale deeply...';
          ringEl.style.transform = 'scale(1.35)';
          ringEl.style.opacity = '0.9';
        } else if (cycleSec < inhaleTime + holdTime) {
          phaseEl.textContent = 'Hold steady...';
          ringEl.style.transform = 'scale(1.35)';
          ringEl.style.opacity = '1';
        } else {
          phaseEl.textContent = 'Exhale gently...';
          ringEl.style.transform = 'scale(0.82)';
          ringEl.style.opacity = '0.6';
        }
      }

      var secPassed = 0;
      updatePhase(0);

      this.breathingInterval = setInterval(function () {
        secPassed++;
        remaining = Math.max(0, totalSeconds - secPassed);

        if (counterEl) counterEl.textContent = remaining + 's';
        updatePhase(secPassed);

        if (remaining <= 0) {
          clearInterval(self.breathingInterval);
          completedNormally = true;
          self._showBreathingCompletion(title, deltaPercent, isPulse, onDoneCallback);
        }
      }, 1000);
    },

    _showBreathingCompletion: function (title, deltaPercent, isPulse, onDoneCallback) {
      // Update state
      var curCap = TabyState.getCapacity();
      var newCap = Math.min(95, curCap + 3);
      TabyState.setCapacity(newCap);

      var now = new Date();
      var timeStr = 'Today ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      TabyState.addHistoryRow({
        title: title,
        time: timeStr,
        delta: deltaPercent,
        strainBefore: 70,
        strainAfter: isPulse ? 52 : 48,
        deliveredBy: 'DEXTER'
      });

      var self = this;
      var completionHtml = `
        <div class="breathing-content completion-view">
          <div class="check-circle-wrapper">
            <svg class="check-icon" viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="var(--sage)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h2 class="serif-title" style="margin: 12px 0 6px;">Well done.</h2>
          <div class="tag-chip sage-tint" style="margin: 0 auto 16px; display: inline-flex;">Stress Change: ${deltaPercent}</div>
          <p class="small-muted" style="margin-bottom: 24px;">Your autonomic nervous system is recalibrating into parasympathetic ease.</p>
          <button class="primary-pill-btn" id="breathing-done-btn">DONE</button>
        </div>
      `;

      this.openOverlay(completionHtml, {
        ignoreBackdrop: false,
        onClose: function () {
          self.showToast('Well done. Added to your history.');
          if (onDoneCallback) onDoneCallback();
        }
      });

      var doneBtn = document.getElementById('breathing-done-btn');
      if (doneBtn) {
        doneBtn.onclick = function () {
          self.closeOverlay();
          self.showToast('Well done. Added to your history.');
          if (onDoneCallback) onDoneCallback();
        };
      }
    },

    /**
     * Support Sheet (Safety Protocol - Section 1.8)
     */
    openSupportSheet: function () {
      var html = `
        <div class="sheet-content">
          <div class="tag-chip amber-tint" style="margin-bottom:8px;">IMMEDIATE CARE & SAFETY</div>
          <h2 class="serif-title" style="font-size:22px; margin: 0 0 8px;">You don't have to carry this alone.</h2>
          <p style="color:var(--text); font-size:14px; margin-bottom: 18px; line-height:1.5;">
            Talking to someone can help. If you are in danger or thinking about hurting yourself, please reach out right now. Free, confidential support is available 24/7:
          </p>
          
          <div class="hotline-list">
            <a href="tel:143" class="hotline-btn">
              <span class="hotline-num">143</span>
              <span class="hotline-name">Die Dargebotene Hand / La Main Tendue <small>(Adults, 24/7)</small></span>
            </a>
            <a href="tel:147" class="hotline-btn">
              <span class="hotline-num">147</span>
              <span class="hotline-name">Pro Juventute <small>(Youth & Children, 24/7)</small></span>
            </a>
            <a href="tel:144" class="hotline-btn">
              <span class="hotline-num">144</span>
              <span class="hotline-name">Ambulance & Medical Emergency</span>
            </a>
            <a href="tel:112" class="hotline-btn">
              <span class="hotline-num">112</span>
              <span class="hotline-name">European Emergency Number</span>
            </a>
          </div>

          <div style="margin-top: 20px; display:flex; flex-direction:column; gap:10px;">
            <button class="secondary-outline-btn" id="support-chat-btn">TALK WITH TABY</button>
          </div>
          
          <div class="small-muted" style="margin-top:14px; font-size:11px; text-align:center;">
            TABY is a supportive wellness guide, not a substitute for professional clinical medical care.
          </div>
        </div>
      `;

      var self = this;
      this.openOverlay(html, { sheet: true });

      var chatBtn = document.getElementById('support-chat-btn');
      if (chatBtn) {
        chatBtn.onclick = function () {
          self.closeOverlay();
          if (global.TabyApp) global.TabyApp.navigateTo('screen-5');
        };
      }
    },

    /**
     * Dashboard Pillars: Connect, Regulate, Purpose Pop-ups (Section 3, Screen 4)
     */
    openPillModal: function (type) {
      var profile = TabyState.getProfile();
      var fName = profile.firstName || 'Alex';
      var self = this;

      var configs = {
        connect: {
          accent: 'var(--orchid)',
          kicker: 'CONNECT',
          title: "You're not meant to do this alone.",
          text: "Stress shrinks when we feel connected. One honest sentence to someone you trust can change the temperature of your whole day.",
          tryThis: "Send one message today: Thinking of you. How are you really?",
          primaryBtn: "TALK WITH TABY",
          secondaryBtn: "EXPLORE CLARITY",
          onPrimary: function () {
            self.closeOverlay();
            if (global.TabyApp) {
              global.TabyApp.navigateTo('screen-5', {
                initialMessage: "Who is one person you'd like to feel closer to today, " + fName + "?"
              });
            }
          },
          onSecondary: function () {
            self.closeOverlay();
            if (global.TabyApp) global.TabyApp.openPillar('clarity');
          },
          svg: `
            <svg viewBox="0 0 200 120" class="modal-illu">
              <circle cx="80" cy="60" r="42" stroke="var(--orchid)" stroke-width="2.5" fill="none" opacity="0.6"/>
              <circle cx="120" cy="60" r="42" stroke="var(--orchid)" stroke-width="2.5" fill="none" opacity="0.6"/>
              <circle cx="100" cy="60" r="6" fill="var(--orchid)" />
            </svg>
          `
        },
        regulate: {
          accent: 'var(--sage)',
          kicker: 'REGULATE',
          title: "Bring your body back to calm.",
          text: "Your nervous system settles when your breath slows down. Six seconds is enough to start shifting out of overload.",
          tryThis: "Drop your shoulders and breathe out slowly through your mouth.",
          primaryBtn: "START 6-SECOND PULSE",
          secondaryBtn: "OPEN THE LIBRARY",
          onPrimary: function () {
            self.startBreathing('pulse');
          },
          onSecondary: function () {
            self.closeOverlay();
            if (global.TabyApp) global.TabyApp.navigateTo('screen-8');
          },
          svg: `
            <svg viewBox="0 0 200 120" class="modal-illu">
              <circle cx="100" cy="60" r="45" stroke="var(--sage)" stroke-width="2" fill="none" stroke-dasharray="4 4" opacity="0.4"/>
              <circle cx="100" cy="60" r="30" stroke="var(--sage)" stroke-width="2.5" fill="none" opacity="0.8"/>
              <circle cx="100" cy="60" r="14" fill="var(--sage)" opacity="0.9"/>
            </svg>
          `
        },
        purpose: {
          accent: 'var(--amber)',
          kicker: 'PURPOSE',
          title: "Come back to what matters.",
          text: "When your days follow your values, effort feels lighter. Purpose starts with naming what you stand for.",
          tryThis: "Ask yourself: what is one thing I would be proud to have done today?",
          primaryBtn: "DISCOVER MY VALUES",
          secondaryBtn: "TALK WITH TABY",
          onPrimary: function () {
            self.closeOverlay();
            if (global.TabyApp) global.TabyApp.openPillar('values');
          },
          onSecondary: function () {
            self.closeOverlay();
            if (global.TabyApp) {
              global.TabyApp.navigateTo('screen-5', {
                initialMessage: "What would a day that matches your values look like, " + fName + "?"
              });
            }
          },
          svg: `
            <svg viewBox="0 0 200 120" class="modal-illu">
              <path d="M 100 100 L 100 35 M 92 48 L 100 32 L 108 48" stroke="var(--amber)" stroke-width="3" fill="none" stroke-linecap="round"/>
              <circle cx="100" cy="20" r="8" fill="var(--amber)"/>
              <line x1="60" y1="100" x2="140" y2="100" stroke="var(--muted)" stroke-width="1.5"/>
            </svg>
          `
        }
      };

      var cfg = configs[type];
      if (!cfg) return;

      var html = `
        <div class="pill-modal-content">
          ${cfg.svg}
          <div class="kicker-label" style="color:${cfg.accent};">${cfg.kicker}</div>
          <h2 class="serif-title" style="margin: 4px 0 10px; font-size:20px;">${cfg.title}</h2>
          <p style="font-size:13.5px; color:var(--text); line-height:1.5; margin-bottom:12px;">${cfg.text}</p>
          <div class="try-this-box">
            <em>Try this:</em> "${cfg.tryThis}"
          </div>
          <div style="display:flex; flex-direction:column; gap:8px; margin-top:20px;">
            <button class="primary-pill-btn" style="background:${cfg.accent}; color:#0B0F14;" id="pill-modal-pri">${cfg.primaryBtn}</button>
            <button class="secondary-outline-btn" id="pill-modal-sec">${cfg.secondaryBtn}</button>
          </div>
        </div>
      `;

      this.openOverlay(html);

      document.getElementById('pill-modal-pri').onclick = cfg.onPrimary;
      document.getElementById('pill-modal-sec').onclick = cfg.onSecondary;
    },

    /**
     * Data-reading Sheet ("Update my data now", Section 3, Screen 6)
     */
    openDataReadingSheet: function (onUpdatedCallback) {
      var consents = TabyState.getConsents();
      var self = this;

      function renderStep1() {
        return `
          <div class="sheet-content">
            <div class="heart-pulse-icon" style="color:var(--teal); font-size:32px; margin-bottom:8px;">♡</div>
            <h2 class="serif-title" style="margin:0 0 8px; font-size:20px;">Update my data now</h2>
            <p class="small-muted" style="margin-bottom:16px;">Take a 5-second reading so your insights reflect how your autonomic system is pacing right now.</p>
            
            <div class="sensor-readout-list">
              <div class="sensor-row">
                <span>Heart Rate (PPG)</span>
                <span class="tag-chip">Active Sensor</span>
              </div>
              <div class="sensor-row">
                <span>Typing Cadence</span>
                <span class="tag-chip ${consents.keyboard ? 'sage-tint' : 'amber-tint'}">${consents.keyboard ? 'Connected' : 'Paused in Settings'}</span>
              </div>
              <div class="sensor-row">
                <span>Voice Prosody</span>
                <span class="tag-chip ${consents.voice ? 'sage-tint' : 'amber-tint'}">${consents.voice ? 'Connected' : 'Paused in Settings'}</span>
              </div>
            </div>

            <button class="primary-pill-btn" id="start-reading-btn" style="margin-top:20px;">START READING</button>
          </div>
        `;
      }

      this.openOverlay(renderStep1(), { sheet: true });

      document.getElementById('start-reading-btn').onclick = function () {
        self._runDataReadingStep2(onUpdatedCallback);
      };
    },

    _runDataReadingStep2: function (onUpdatedCallback) {
      var self = this;
      var html = `
        <div class="sheet-content" style="text-align:center;">
          <div class="heart-pulse-animation">♥</div>
          <h2 class="serif-title" style="margin:10px 0 4px; font-size:22px;">Measuring biometrics...</h2>
          <div class="live-hr-display"><span id="live-hr-num">62</span> <small>bpm</small></div>
          <div class="progress-bar-track" style="margin: 18px 0 8px;">
            <div class="progress-bar-fill" id="reading-bar" style="width: 0%;"></div>
          </div>
          <div class="small-muted">Keep hands steady · Measuring autonomic baseline</div>
        </div>
      `;

      var container = document.getElementById('overlay-container');
      if (container) {
        var xBtn = '<button class="overlay-x-btn" aria-label="Close" id="overlay-x-btn">&times;</button>';
        container.innerHTML = xBtn + html;
        document.getElementById('overlay-x-btn').onclick = function () { self.closeOverlay(); };
      }

      var hrNumEl = document.getElementById('live-hr-num');
      var barEl = document.getElementById('reading-bar');
      var step = 0;
      var interval = setInterval(function () {
        step++;
        var pct = (step / 5) * 100;
        if (barEl) barEl.style.width = pct + '%';
        if (hrNumEl) hrNumEl.textContent = String(62 + Math.floor(step * 1.2));

        if (step >= 5) {
          clearInterval(interval);
          self._showDataReadingResult(onUpdatedCallback);
        }
      }, 1000);
    },

    _showDataReadingResult: function (onUpdatedCallback) {
      var consents = TabyState.getConsents();
      var self = this;

      var signals = ["Heart rate: 68 bpm"];
      if (consents.keyboard) signals.push("Typing rhythm: steady");
      if (consents.voice) signals.push("Voice tone: calm");

      var html = `
        <div class="sheet-content">
          <div class="tag-chip sage-tint" style="margin-bottom:8px;">READING COMPLETE</div>
          <h2 class="serif-title" style="margin: 0 0 6px; font-size:20px;">Your insights are updated.</h2>
          <p class="small-muted" style="margin-bottom:14px;">Recent signals captured:</p>
          
          <div class="card" style="padding:12px; margin-bottom:18px;">
            ${signals.map(s => '<div style="font-size:13px; color:var(--text); padding:4px 0;">• ' + s + '</div>').join('')}
          </div>

          <div style="display:flex; flex-direction:column; gap:10px;">
            <button class="primary-pill-btn" id="see-updated-insights-btn">SEE UPDATED INSIGHTS</button>
            <button class="secondary-outline-btn" id="view-in-history-btn">VIEW IN HISTORY</button>
          </div>
        </div>
      `;

      var container = document.getElementById('overlay-container');
      if (container) {
        var xBtn = '<button class="overlay-x-btn" aria-label="Close" id="overlay-x-btn">&times;</button>';
        container.innerHTML = xBtn + html;
        document.getElementById('overlay-x-btn').onclick = function () { self.closeOverlay(); };
      }

      document.getElementById('see-updated-insights-btn').onclick = function () {
        TabyState.saveBaselineDonut({ joy: 46, calm: 36, stress: 13, anger: 5 });
        self.closeOverlay();
        self.showToast('Insights updated with new reading.');
        if (onUpdatedCallback) onUpdatedCallback();
      };

      document.getElementById('view-in-history-btn').onclick = function () {
        self.closeOverlay();
        if (global.TabyApp) global.TabyApp.navigateTo('screen-7');
      };
    },

    /**
     * Intervention Detail Sheet (Section 3, Screen 7 & 8)
     */
    openInterventionDetail: function (item) {
      item = item || {
        title: '6-Second Recalibration Pulse',
        time: 'Today 17:21',
        deliveredBy: 'DEXTER',
        strainBefore: 71,
        strainAfter: 58,
        delta: '-18%'
      };

      var html = `
        <div class="sheet-content">
          <div class="kicker-label" style="color:var(--teal)">INTERVENTION DETAILS</div>
          <h2 class="serif-title" style="margin:4px 0 4px; font-size:20px;">${item.title}</h2>
          <div class="small-muted" style="margin-bottom:14px;">${item.time} · Delivered by ${item.deliveredBy || 'DEXTER'}</div>
          
          <div class="card" style="padding:16px; margin-bottom:16px; display:flex; justify-content:space-around; text-align:center;">
            <div>
              <div class="small-muted">Strain Before</div>
              <div style="font-size:20px; font-weight:700; color:var(--amber);">${item.strainBefore || 71}</div>
            </div>
            <div style="font-size:22px; color:var(--muted); line-height:36px;">→</div>
            <div>
              <div class="small-muted">Strain After</div>
              <div style="font-size:20px; font-weight:700; color:var(--sage);">${item.strainAfter || 58}</div>
            </div>
            <div>
              <div class="small-muted">Delta</div>
              <div class="tag-chip sage-tint">${item.delta || '-18%'}</div>
            </div>
          </div>

          <p style="font-size:13px; color:var(--text); line-height:1.5; margin-bottom:18px;">
            Delivered via JITAI (Just-In-Time Adaptive Intervention) upon detecting acute typing acceleration and elevated biometric tension.
          </p>

          <button class="secondary-outline-btn" id="see-in-history-btn">SEE IN ACCOMPLISHMENT HISTORY</button>
        </div>
      `;

      var self = this;
      this.openOverlay(html, { sheet: true });

      var btn = document.getElementById('see-in-history-btn');
      if (btn) {
        btn.onclick = function () {
          self.closeOverlay();
          if (global.TabyApp) global.TabyApp.navigateTo('screen-8');
        };
      }
    },

    /**
     * Ask TABY sheet (Learn & Reflect steps)
     */
    openAskTabySheet: function (context) {
      var profile = TabyState.getProfile();
      var fName = profile.firstName || 'Alex';
      var self = this;

      var html = `
        <div class="sheet-content" style="display:flex; flex-direction:column; height: 75vh;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <div style="width:10px; height:10px; border-radius:50%; background:var(--teal);"></div>
            <span style="font-weight:600; font-size:14px;">Ask TABY</span>
            <span class="small-muted" style="margin-left:auto;">${context.pillar ? context.pillar.toUpperCase() : 'GUIDANCE'}</span>
          </div>

          <div class="ask-taby-chat-body" id="ask-taby-messages" style="flex:1; overflow-y:auto; padding:10px 0;">
            <div class="chat-bubble taby-bubble">
              Need help finding words or exploring this concept, ${fName}? Ask me anything about this pillar.
            </div>
          </div>

          <div style="display:flex; gap:8px; padding-top:10px; border-top:1px solid var(--border);">
            <input type="text" id="ask-taby-input" placeholder="Ask a question..." style="flex:1; font-size:14px; padding:10px;" />
            <button class="primary-pill-btn" id="ask-taby-send" style="padding:8px 16px;">Send</button>
          </div>
        </div>
      `;

      this.openOverlay(html, { sheet: true });

      var input = document.getElementById('ask-taby-input');
      var sendBtn = document.getElementById('ask-taby-send');
      var msgBox = document.getElementById('ask-taby-messages');

      function sendQuestion() {
        var val = (input.value || '').trim();
        if (!val) return;

        var userDiv = document.createElement('div');
        userDiv.className = 'chat-bubble user-bubble';
        userDiv.textContent = val;
        msgBox.appendChild(userDiv);
        input.value = '';
        msgBox.scrollTop = msgBox.scrollHeight;

        var typingDiv = document.createElement('div');
        typingDiv.className = 'chat-bubble taby-bubble';
        typingDiv.innerHTML = '<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>';
        msgBox.appendChild(typingDiv);
        msgBox.scrollTop = msgBox.scrollHeight;

        if (global.tabyClient) {
          global.tabyClient.send(val, { firstName: fName, pillar: context.pillar, step: context.step }, {
            onSuccess: function (res) {
              typingDiv.innerHTML = res.reply || "I'm with you. Reflect on what feels most true to you.";
              msgBox.scrollTop = msgBox.scrollHeight;
            },
            onError: function () {
              typingDiv.textContent = "Take a moment to write what naturally comes to your heart.";
            }
          });
        }
      }

      sendBtn.onclick = sendQuestion;
      input.onkeydown = function (e) {
        if (e.key === 'Enter') sendQuestion();
      };
    }
  };

  global.UiPopups = UiPopups;
})(typeof window !== 'undefined' ? window : globalThis);
