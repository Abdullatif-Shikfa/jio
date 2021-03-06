/*jslint indent: 2, maxlen: 80, nomen : true */
/*global require */

(function () {
  "use strict";

  require.config({
    "paths": {
      "rsvp":       "../lib/rsvp/rsvp-custom.amd",
      "sha256":      "../src/sha256.amd",
      "jio":         "../jio",
      "jio_tests":   "jio/tests",

      "test_util":   "jio/util",
      "fakestorage": "jio/fakestorage",

      "complex_queries":    "../complex_queries",
      "complex_queries_tests": "queries/tests",

      "localstorage":       "../src/jio.storage/localstorage",
      "localstorage_tests": "jio.storage/localstorage.tests",

      "qunit":       "../lib/qunit/qunit",
      "sinon":       "../lib/sinon/sinon",
      "sinon_qunit": "../lib/sinon/sinon-qunit"
    },
    "shim": {
      "sinon":       ["qunit"],
      "sinon_qunit": ["sinon"]
    }
  });

  require([
    "sinon_qunit",
    "jio_tests",
    "complex_queries_tests",
    "localstorage_tests"
  ]);
}());
