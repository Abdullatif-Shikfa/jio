/*jslint indent:2,maxlen:80,nomen:true*/
/*global complex_queries, jIO, define, exports, require, window*/

(function (dependencies, module) {
  "use strict";
  if (typeof define === 'function' && define.amd) {
    return define(dependencies, module);
  }
  if (typeof exports === 'object') {
    return module(exports, require('jio'), require('complex_queries'), require('sjcl'));
  }
  window.searchable_encryption_storage_connector = {};
  module(window.searchable_encryption_storage_connector, jIO, complex_queries, sjcl);
}([
  'exports',
  'jio',
  'complex_queries',
  'sjcl'
], function (exports, jIO, complex_queries, sjcl) {
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

function computeBFLength (errorRate, nbMaxKeywords){
  return Math.ceil((errorRate*nbMaxKeywords)/Math.log(2))
}

function intArrayToString (arr){
  var result =""
  for (var i = 0; i < arr.length; i++) {
    result=result + arr[i].toString();
  }
  return result;
}

function bigModulo(arr, mod){
  var result = 0;
  var base = 1;
  for (var i = 0; i < arr.length; i++) {
    result = result + arr[i] * base % mod;
	base = base * Math.pow(2,32) % mod;
  }
  return result;
}

function constructBloomFiler (password, errorRate, nbMaxKeywords, keywords){
  var bFLength = computeBFLength(errorRate,nbMaxKeywords);
  var result = [];
  for (var i = 0; i < bFLength; i++) {
    result[i]=0;
  }
  for (var i = 0; i< keywords.length, i++){
    for (var j = 0; j< errorRate, j++){
	  result[bigModulo(sjcl.hash.sha256.hash(intArrayToString(sjcl.hash.sha256.hash(keywords[i] + this._password + j)) + this._id), bFLength)]=1;  
	}
  }
  return result;
}

 SearchableEncryptionStorageHandler.prototype.put = function (command, metadata, option) {
  metadata.encryptedIndex = constructBloomFilter(this._password, this._errorRate, this._nbMaxKeywords, this._keywords);// [0,1,0,0,0,1];//fonction de searchable encryption creation de Bloom Filter
  command.storage(this._sub_storage).put(metadata).then(command.success, command.error,command.notify);
};

SearchableEncryptionStorageHandler.prototype.post = function (command, metadata, option) {
  metadata.encryptedIndex = constructBloomFilter(this._password, this._errorRate, this._nbMaxKeywords, this._keywords);// [0,1,0,0,0,1];//fonction de searchable encryption creation de Bloom Filter
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