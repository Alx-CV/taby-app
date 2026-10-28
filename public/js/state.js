/**
 * State Management for TABY Application
 * Implements browser localStorage persistence as specified in Section 1.1 & Section 6 of Build Brief:
 * - setup_done (boolean)
 * - profile (firstName, email, gender, ageRange)
 * - consents (keyboard, voice)
 * - theme ('dark' | 'light')
 * - chat_main (message objects)
 * - pillars (Identity, Values, Clarity, Essential Needs, Meaning of Emotions, Boundaries)
 * - history (accomplishment rows)
 */

(function (global) {
  'use strict';

  var DEFAULT_PROFILE = {
    firstName: 'Alex',
    email: 'alex.chavez@sovereigntylab.com',
    gender: 'Female',
    ageRange: '25–34'
  };

  var DEFAULT_CONSENTS = {
    keyboard: true,
    voice: true
  };

  var DEFAULT_PILLARS = {
    identity: {
      id: 'identity',
      name: 'Identity',
      color: 'indigo',
      hex: '#6E8CF0',
      description: 'Find beliefs that hold you back and rewrite them with kindness.',
      furthestStep: 3,
      completed: true,
      practiceChat: [],
      savedCard: { label: 'NEW THOUGHT', text: 'Steady effort matters more than impossible perfection.' },
      journal: 'My past experiences taught me resilience, even when things did not go as planned.'
    },
    values: {
      id: 'values',
      name: 'Values',
      color: 'amber',
      hex: '#F2A65A',
      description: 'Clarify what you truly stand for so decisions feel aligned and light.',
      furthestStep: 2,
      completed: false,
      practiceChat: [],
      savedCard: { label: 'YOUR CORE VALUE', text: 'Calm: feeling steady inside even when the schedule is fast.' },
      journal: ''
    },
    clarity: {
      id: 'clarity',
      name: 'Clarity',
      color: 'lime',
      hex: '#CBE870',
      description: 'Anchor yourself before high-pressure meetings or social situations.',
      furthestStep: 1,
      completed: false,
      practiceChat: [],
      savedCard: null,
      journal: ''
    },
    needs: {
      id: 'needs',
      name: 'Essential Needs',
      color: 'sage',
      hex: '#7FD9A8',
      description: 'Recognize neglected somatic and emotional needs before exhaustion sets in.',
      furthestStep: 1,
      completed: false,
      practiceChat: [],
      savedCard: null,
      journal: ''
    },
    emotions: {
      id: 'emotions',
      name: 'Meaning of Emotions',
      color: 'orchid',
      hex: '#B36FC3',
      description: 'Decode anger, anxiety, or guilt to uncover the vital need underneath.',
      furthestStep: 1,
      completed: false,
      practiceChat: [],
      savedCard: null,
      journal: ''
    },
    boundaries: {
      id: 'boundaries',
      name: 'Boundaries',
      color: 'teal',
      hex: '#4AC9C0',
      description: 'Master the graceful no with warmth, gratitude, and zero guilt.',
      furthestStep: 1,
      completed: false,
      practiceChat: [],
      savedCard: null,
      journal: ''
    }
  };

  var DEFAULT_HISTORY = [
    {
      id: 'hist-1',
      title: '6-Second Recalibration Pulse',
      time: 'Today 17:21',
      delta: '-18%',
      strainBefore: 71,
      strainAfter: 58,
      deliveredBy: 'DEXTER'
    },
    {
      id: 'hist-2',
      title: 'Cyclic Sighing Pause',
      time: 'Today 11:05',
      delta: '-22%',
      strainBefore: 68,
      strainAfter: 53,
      deliveredBy: 'DEXTER'
    },
    {
      id: 'hist-3',
      title: 'Identity Reflection',
      time: 'Yesterday 14:15',
      delta: '-14%',
      strainBefore: 59,
      strainAfter: 51,
      deliveredBy: 'TABY'
    },
    {
      id: 'hist-4',
      title: 'Squeeze & Release',
      time: 'Monday 09:30',
      delta: '-19%',
      strainBefore: 76,
      strainAfter: 62,
      deliveredBy: 'DEXTER'
    }
  ];

  var DEFAULT_CHAT_MAIN = [
    {
      id: 'msg-1',
      sender: 'taby',
      text: `Welcome back, ${state.profile.firstName || 'friend'}. I'm here to support your nervous system today. How are you feeling in your body right now?`,
      time: '17:15',
      chips: ["Feeling a bit overwhelmed", "A little tense", "Doing fine"]
    },
    {
      id: 'msg-2',
      sender: 'user',
      text: "Feeling a bit overwhelmed with back-to-back meetings.",
      time: '17:18'
    },
    {
      id: 'msg-3',
      sender: 'system',
      type: 'pulse-offer',
      title: '6-Second Recalibration Pulse offered at 17:21',
      actionText: 'Start pulse',
      time: '17:21'
    }
  ];

  var TabyState = {
    isSetupDone: function () {
      return localStorage.getItem('taby_setup_done') === 'true';
    },

    setSetupDone: function (done) {
      localStorage.setItem('taby_setup_done', done ? 'true' : 'false');
    },

    getProfile: function () {
      try {
        var raw = localStorage.getItem('taby_profile');
        return raw ? JSON.parse(raw) : DEFAULT_PROFILE;
      } catch (e) {
        return DEFAULT_PROFILE;
      }
    },

    saveProfile: function (profile) {
      localStorage.setItem('taby_profile', JSON.stringify(profile));
    },

    getConsents: function () {
      try {
        var raw = localStorage.getItem('taby_consents');
        return raw ? JSON.parse(raw) : DEFAULT_CONSENTS;
      } catch (e) {
        return DEFAULT_CONSENTS;
      }
    },

    saveConsents: function (consents) {
      localStorage.setItem('taby_consents', JSON.stringify(consents));
    },

    getTheme: function () {
      return localStorage.getItem('taby_theme') || 'dark';
    },

    setTheme: function (theme) {
      localStorage.setItem('taby_theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    },

    getCapacity: function () {
      var val = parseInt(localStorage.getItem('taby_capacity'), 10);
      return isNaN(val) ? 82 : val;
    },

    setCapacity: function (cap) {
      localStorage.setItem('taby_capacity', String(clamp(cap, 20, 98)));
    },

    getPillars: function () {
      try {
        var raw = localStorage.getItem('taby_pillars');
        return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_PILLARS));
      } catch (e) {
        return JSON.parse(JSON.stringify(DEFAULT_PILLARS));
      }
    },

    savePillars: function (pillars) {
      localStorage.setItem('taby_pillars', JSON.stringify(pillars));
    },

    updatePillar: function (id, updates) {
      var p = this.getPillars();
      if (p[id]) {
        Object.assign(p[id], updates);
        this.savePillars(p);
      }
      return p[id];
    },

    getHistory: function () {
      try {
        var raw = localStorage.getItem('taby_history');
        return raw ? JSON.parse(raw) : DEFAULT_HISTORY;
      } catch (e) {
        return DEFAULT_HISTORY;
      }
    },

    addHistoryRow: function (row) {
      var hist = this.getHistory();
      row.id = 'hist-' + Date.now();
      hist.unshift(row);
      localStorage.setItem('taby_history', JSON.stringify(hist));
      return hist;
    },

    getChatMain: function () {
      try {
        var raw = localStorage.getItem('taby_chat_main');
        return raw ? JSON.parse(raw) : DEFAULT_CHAT_MAIN;
      } catch (e) {
        return DEFAULT_CHAT_MAIN;
      }
    },

    saveChatMain: function (messages) {
      localStorage.setItem('taby_chat_main', JSON.stringify(messages));
    },

    addChatMessage: function (msg) {
      var chat = this.getChatMain();
      msg.id = 'msg-' + Date.now();
      chat.push(msg);
      this.saveChatMain(chat);
      return chat;
    },

    getBaselineDonut: function () {
      try {
        var raw = localStorage.getItem('taby_baseline_donut');
        return raw ? JSON.parse(raw) : { joy: 45, calm: 35, stress: 15, anger: 5 };
      } catch (e) {
        return { joy: 45, calm: 35, stress: 15, anger: 5 };
      }
    },

    saveBaselineDonut: function (donut) {
      localStorage.setItem('taby_baseline_donut', JSON.stringify(donut));
    },

    resetAllData: function () {
      localStorage.removeItem('taby_setup_done');
      localStorage.removeItem('taby_profile');
      localStorage.removeItem('taby_consents');
      localStorage.removeItem('taby_theme');
      localStorage.removeItem('taby_capacity');
      localStorage.removeItem('taby_pillars');
      localStorage.removeItem('taby_history');
      localStorage.removeItem('taby_chat_main');
      localStorage.removeItem('taby_baseline_donut');
      localStorage.removeItem('taby_typing_baseline');
      this.setTheme('dark');
    }
  };

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  global.TabyState = TabyState;
})(typeof window !== 'undefined' ? window : globalThis);
