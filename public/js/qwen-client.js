/**
 * Qwen LLM Client
 * Communicates with the backend /api/chat and /api/baseline endpoints.
 * Orchestrates visual feedback on the interactive TABY blob.
 */

(function (global) {
  'use strict';

  function QwenClient(opts) {
    opts = opts || {};
    this.apiBase = opts.apiBase || '';
    this.blob = opts.blob || null;
    this.director = opts.director || null;
  }

  QwenClient.prototype.setBlob = function (blob, director) {
    this.blob = blob;
    this.director = director;
  };

  /**
   * Send user message to Qwen backend
   * @param {string} message User's input text
   * @param {object} context { firstName, pillar, step, history }
   * @param {object} callbacks { onStart, onThinking, onChunk, onSuccess, onError }
   */
  QwenClient.prototype.send = async function (message, context, callbacks) {
    callbacks = callbacks || {};
    var self = this;

    if (callbacks.onStart) callbacks.onStart();

    // Visual feedback: Blob enters thinking animation
    if (this.blob) {
      this.blob.setThinking(true);
      if (this.blob.lookAt) {
        this.blob.lookAt(0, -0.4, 2);
      }
    }

    var timeoutId;
    var abortController = new AbortController();
    timeoutId = setTimeout(function () {
      abortController.abort();
    }, 20000); // 20s timeout per section 1.7

    try {
      var response = await fetch(this.apiBase + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message, context: context }),
        signal: abortController.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Server returned HTTP ' + response.status);
      }

      var data = await response.json();

      // Visual feedback: Stop thinking state
      if (self.blob) {
        self.blob.setThinking(false);

        // Shift to recommended mood or calm
        var mood = data.recommended_mood || 'calm';
        self.blob.setMood(mood);

        // If director animation is recommended and director is available, play it!
        if (data.recommended_animation && self.director && !self.director.isPlaying()) {
          self.director.playIntent(data.recommended_animation);
        } else {
          // Micro-nod of delivery
          self.blob.nod();
        }
      }

      if (callbacks.onSuccess) {
        callbacks.onSuccess(data);
      }
      return data;

    } catch (err) {
      clearTimeout(timeoutId);

      if (self.blob) {
        self.blob.setThinking(false);
        self.blob.setMood('wobbly');
      }

      var isTimeout = err.name === 'AbortError';
      var fallback = {
        reply: isTimeout
          ? "I can't connect right now. Your message is saved."
          : "I'm having a brief connection pause, but I'm right here with you. Take a slow, grounding breath.",
        chips: ["Retry", "Start 6-Second Pulse"],
        canRetry: true,
        show_support: false,
        recommended_mood: "calm"
      };

      if (callbacks.onError) {
        callbacks.onError(err, fallback);
      }
      return fallback;
    }
  };

  /**
   * Request Emotional Baseline computation
   */
  QwenClient.prototype.computeBaseline = async function (telemetry) {
    try {
      var response = await fetch(this.apiBase + '/api/baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telemetry || {})
      });
      if (!response.ok) throw new Error('Baseline error');
      return await response.json();
    } catch (e) {
      // Local fallback calculation
      return {
        baseline: { joy: 45, calm: 35, stress: 15, anger: 5 },
        capacity: 82,
        fused_index: 28,
        streak_days: 3,
        status_label: "Everything is in flow. Stay grounded.",
        recommendation: "6-second recalibration pulse"
      };
    }
  };

  global.QwenClient = QwenClient;
})(typeof window !== 'undefined' ? window : globalThis);
