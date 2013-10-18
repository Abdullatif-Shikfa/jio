/*jslint indent:2,maxlen:80,nomen:true*/
/*global complex_queries, jIO, define, exports, require, window*/

(function (dependencies, module) {
  "use strict";
  if (typeof define === 'function' && define.amd) {
    return define(dependencies, module);
  }
  if (typeof exports === 'object') {
    return module(exports, require('jio'), require('complex_queries'), require('crypto'), require('sjcl'));
  }
  window.searchable_encryption_storage_connector = {};
  module(window.searchable_encryption_storage_connector, jIO, complex_queries, crypto, sjcl);
}([
  'exports',
  'jio',
  'complex_queries',
  'crypto',
  'sjcl'
], function (exports, jIO, complex_queries, crypto, sjcl) {
  "use strict";

  function SearchableEncryptionStorageHandler(storage_description) {
    this._password = storage_description.password; //string
    this._errorRate = storage_description.errorRate || 20; //int
    this._nbMaxKeywords = storage_description.nbMaxKeywords || 100; //int
    this._keywords = storage_description.keywords; //string array
    this._sub_storage = storage_description.sub_storage; //child node
//  if (typeof this._password !== 'string') {
//    throw new TypeError("'value' description property is not a string");
//  }
  }

SearchableEncryptionStorageHandler.prototype.put = function (command, metadata, option) {
  metadata.encryptedIndex = [0,1,0,0,0,1];//fonction de searchable encryption creation de Bloom Filter
  command.storage(this._sub_storage).put(metadata).then(command.success, command.error,command.notify);
};

SearchableEncryptionStorageHandler.prototype.post = function (command, metadata, option) {
  metadata.encryptedIndex = [0,1,0,0,0,1];//fonction de searchable encryption creation de Bloom Filter
  command.storage(this._sub_storage).post(metadata).then(command.success, command.error,command.notify);
};

SearchableEncryptionStorageHandler.prototype.get = function (command, param, option) {
  command.storage(this._sub_storage).get(param).then(command.success, command.error,command.notify);
};

SearchableEncryptionStorageHandler.prototype.allDocs = function (command, param, option) {
     command.storage(this._sub_storage).allDocs(option).then(command.success, command.error,command.notify);
}

  jIO.addStorage("searchableencryptionhandler",SearchableEncryptionStorageHandler);
  
}));
// il faut encore définir: putAttachment, getAttachment, remove, removeAttachment, check and repair