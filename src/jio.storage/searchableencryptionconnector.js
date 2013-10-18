/*jslint indent:2,maxlen:80,nomen:true*/
/*global complex_queries, jIO, define, exports, require, window*/

(function (dependencies, module) {
  "use strict";
  if (typeof define === 'function' && define.amd) {
    return define(dependencies, module);
  }
  if (typeof exports === 'object') {
    return module(exports, require('jio'), require('complex_queries'));
  }
  window.searchable_encryption_storage_connector = {};
  module(window.searchable_encryption_storage_connector, jIO, complex_queries);
}([
  'exports',
  'jio',
  'complex_queries'
], function (exports, jIO, complex_queries) {
  "use strict";

  function SearchableEncryptionStorageConnector(storage_description) {
    this._password = storage_description.password; //string
    this._errorRate = storage_description.errorRate || 20; //int
    this._nbMaxKeywords = storage_description.nbMaxKeywords || 100; //int
//  this._keywords = storage_description.keywords; //string array
//  if (typeof this._password !== 'string') {
//    throw new TypeError("'value' description property is not a string");
//  }
  }

  SearchableEncryptionStorageConnector.prototype.put = function (
    command,
    metadata,
    option
  ) {
    var document_id = metadata._id;
// rajouter du code pour tenter de se stocker un document sur un serveur
  };

  SearchableEncryptionStorageConnector.prototype.post = function (command, metadata, option) {
    var document_id = metadata._id;
// rajouter du code pour tenter de se stocker si ça ne l'est pas déjà un document sur un serveur
  };

  SearchableEncryptionStorageConnector.prototype.get = function (command, param, option) {
    var document_id = param._id;
// rajouter du code pour tenter de récupérer le document du serveur
  };

  SearchableEncryptionStorageConnector.prototype.allDocs = function (command, param, option) {

    var i, row, path_re, rows, document_list, document_object, delete_id;
    rows = [];
    document_list = [];

//      complex_queries.QueryFactory.create(options.query || "").
    //  exec(document_list, options);
    var positions = functionquicalculelespositions(options.query, this_errorRate, this._nbMaxKeywords, this._password);

    jIO.util.ajax({
        "type": "GET",
        "url": this._url,
        "dataType": "application/json",
        "data": {"positions":positions,"limit":options.limit,"sort_on":options.sort_on,"select_list":options.select_list,"include_docs":options.include_docs}
//        "headers": headers
      }).then(function(e){
          var document_list = e.target.response;
           document_list = document_list.map(function (param) {
        var row = {
          "id": param.document._id,
          "value": param.value || {}
          };
          if (options.include_docs === true) {
             row.doc = param.document;
             }
        
        return row;
      });
      command.success(e.target.status,{"data": {
        "total_rows": document_list.length,
        "rows": document_list}})
      },
      function(e){
         var xhr = e.target;
         command.reject(xhr.status, xhr.statusText, "Documents retrieval from server failed");
      })      
  };

  }))
// il faut encore définir: putAttachment, getAttachment, remove, removeAttachment, check and repair