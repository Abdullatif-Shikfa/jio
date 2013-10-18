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

//Copied from the davstorage connector
  /**
   * An ajax object to do the good request according to the auth type
   */
  var ajax = {
    "none": function (method, type, url, data) {
      var headers = {};
      if (method === "PROPFIND") {
        headers.Depth = "1";
      }
      return jIO.util.ajax({
        "type": method,
        "url": url,
        "dataType": type,
        "data": data,
        "headers": headers
      });
    },
    "basic": function (method, type, url, data, login) {
      var headers = {"Authorization": "Basic " + login};
      if (method === "PROPFIND") {
        headers.Depth = "1";
      }
      return jIO.util.ajax({
        "type": method,
        "url": url,
        "dataType": type,
        "data": data,
        "headers": headers
      });
    },
    "digest": function () {
      // XXX
      throw new TypeError("DavStorage digest not implemented");
    }
  };
  
  function SearchableEncryptionStorageConnector(storage_description) {
    this._password = storage_description.password; //string
    this._errorRate = storage_description.errorRate || 20; //int
    this._nbMaxKeywords = storage_description.nbMaxKeywords || 100; //int
    this._url = storage_description.url;
//  this._keywords = storage_description.keywords; //string array
//  if (typeof this._password !== 'string') {
//    throw new TypeError("'value' description property is not a string");
//  }
  }
 
  /**
   * Removes the last character if it is a "/". "/a/b/c/" become "/a/b/c"
   *
   * @param  {String} string The string to modify
   * @return {String} The modified string
   */
  function removeLastSlashes(string) {
    return string.replace(/\/*$/, '');
  }

  /**
   * Tool to create a ready to use JIO storage description for Dav Storage
   *
   * @param  {String} url The url
   * @param  {String} [auth_type] The authentication type: 'none', 'basic' or
   *   'digest'
   * @param  {String} [realm] The realm
   * @param  {String} [username] The username
   * @param  {String} [password] The password
   * @return {Object} The dav storage description
   */
  function createDescription(url, auth_type, realm, username, password) {
    if (typeof url !== 'string') {
      throw new TypeError("dav_storage.createDescription(): URL: " +
                          "Argument 1 is not of type string");
    }

    function checkUserAndPwd(username, password) {
      if (typeof username !== 'string') {
        throw new TypeError("dav_storage.createDescription(): Username: " +
                            "Argument 4 is not of type string");
      }
      if (typeof password !== 'string') {
        throw new TypeError("dav_storage.createDescription(): Password: " +
                            "Argument 5 is not of type string");
      }
    }

    switch (auth_type) {
    case 'none':
      return {
        "type": "dav",
        "url": removeLastSlashes(url)
      };
    case 'basic':
      checkUserAndPwd(username, password);
      return {
        "type": "dav",
        "url": removeLastSlashes(url),
        "basic_login": btoa(username + ":" + password)
      };
    case 'digest':
      // XXX
      realm.toString();
      throw new Error("Not Implemented");
    default:
      throw new TypeError("dav_storage.createDescription(): " +
                          "Authentication type: " +
                          "Argument 2 is not 'none', 'basic' nor 'digest'");
    }
  }
  exports.createDescription = createDescription;

  /**
   * Changes spaces to %20, / to %2f, % to %25 and ? to %3f
   *
   * @param  {String} name The name to secure
   * @return {String} The secured name
   */
  function secureName(name) {
    return encodeURI(name).replace(/\//g, '%2F').replace(/\?/g, '%3F');
  }

  /**
   * Restores the original name from a secured name
   *
   * @param  {String} secured_name The secured name to restore
   * @return {String} The original name
   */
  function restoreName(secured_name) {
    return decodeURI(secured_name.replace(/%3F/ig, '?').replace(/%2F/ig, '/'));
  }

  /**
   * Convert document id and attachment id to a file name
   *
   * @param  {String} doc_id The document id
   * @param  {String} attachment_id The attachment id (optional)
   * @return {String} The file name
   */
  function idsToFileName(doc_id, attachment_id) {
    doc_id = secureName(doc_id).replace(/\./g, '_.');
    if (typeof attachment_id === "string") {
      attachment_id = secureName(attachment_id).replace(/\./g, '_.');
      return doc_id + "." + attachment_id;
    }
    return doc_id;
  }

  /**
   * Convert a file name to a document id (and attachment id if there)
   *
   * @param  {String} file_name The file name to convert
   * @return {Array} ["document id", "attachment id"] or ["document id"]
   */
  function fileNameToIds(file_name) {
    return file_name.replace(/.\.(?:\.)?/g, function (substr) {
      if (substr[0] === '_') {
        if (substr[2] === '.') {
          return '. ';
        }
        return '.';
      }
      return substr[0] + ' ';
    }).split(' ').map(restoreName);
  }

  function promiseSucceed(promise) {
    return new RSVP.Promise(function (resolve, reject, notify) {
      promise.then(resolve, reject, notify);
    }, function () {
      promise.cancel();
    });
  }

  
    SearchableEncryptionStorageConnector.prototype._put = function (metadata) {
    return ajax.none( //this._auth_type](
      "PUT",
      "text",
      this._url + '/' + idsToFileName(metadata._id) + "?_=" + Date.now(),
      JSON.stringify(metadata),
      this._login
    );
  };
 
//Copied from the davstorage connector
   SearchableEncryptionStorageConnector.prototype._get = function (param) {
    return ajax.none ( //[this._auth_type](
      "GET",
      "text",
      this._url + '/' + idsToFileName(param._id),
      null,
      this._login
    ).then(function (e) {
      try {
        return {"target": {
          "status": e.target.status,
          "statusText": e.target.statusText,
          "response": JSON.parse(e.target.responseText)
        }};
      } catch (err) {
        throw {"target": {
          "status": 0,
          "statusText": "Parse error"
        }};
      }
    });
  };
  
//Copied from the davstorage connector
 
  SearchableEncryptionStorageConnector.prototype.postOrPut = function (method, command, metadata) {
    metadata._id = metadata._id || jIO.util.generateUuid();
    var o = {
      error_message: "SearchableEncryptionStorageConnector, unable to get metadata.",
      notify_message: "Getting metadata",
      percentage: [0, 30],
      notifyProgress: function (e) {
        command.notify({
          "method": method,
          "message": o.notify_message,
          "loaded": e.loaded,
          "total": e.total,
          "percentage": (e.loaded / e.total) *
            (o.percentage[1] - o.percentage[0]) +
            o.percentage[0]
        });
      },
      putMetadata: function (e) {
        metadata._attachments = e.target.response._attachments;
        o.notify_message = "Updating metadata";
        o.error_message = "SearchableEncryptionStorageConnector, unable to update document.";
        o.percentage = [30, 100];
        this._put(metadata).then(o.success, o.reject, o.notifyProgress);
      }.bind(this),
      errorDocumentExists: function (e) {
        command.error(
          "conflict",
          "Document exists",
          "SearchableEncryptionStorageConnector, cannot overwrite document metadata."
        );
      },
      putMetadataIfPossible: function (e) {
        if (e.target.status !== 404) {
          return command.reject(
            e.target.status,
            e.target.statusText,
            o.error_message
          );
        }
        o.percentage = [30, 100];
        o.notify_message = "Updating metadata";
        o.error_message = "SearchableEncryptionStorageConnector, unable to create document.";
        this._put(metadata).then(o.success, o.reject, o.notifyProgress);
      }.bind(this),
      success: function (e) {
        command.success(e.target.status, {"id": metadata._id});
      },
      reject: function (e) {
        command.reject(
          e.target.status,
          e.target.statusText,
          o.error_message
        );
      }
    };

    this._get(metadata).then(
      method === 'post' ? o.errorDocumentExists : o.putMetadata,
      o.putMetadataIfPossible,
      o.notifyProgress
    );
  };

  //Copied from the davstorage connector
  /**
   * Creates a new document if not already exists
   *
   * @method post
   * @param  {Object} command The JIO command
   * @param  {Object} metadata The metadata to put
   * @param  {Object} options The command options
   */
  SearchableEncryptionStorageConnector.prototype.post = function (command, metadata) {
    this.postOrPut('post', command, metadata);
  };

//Copied from the davstorage connector
  /**
   * Creates or updates a document
   *
   * @method put
   * @param  {Object} command The JIO command
   * @param  {Object} metadata The metadata to post
   * @param  {Object} options The command options
   */
  SearchableEncryptionStorageConnector.prototype.put = function (command, metadata) {
    this.postOrPut('put', command, metadata);
  };

  //Copied from the davstorage connector
    /**
   * Retrieve metadata
   *
   * @method get
   * @param  {Object} command The JIO command
   * @param  {Object} param The command parameters
   * @param  {Object} options The command options
   */
  SearchableEncryptionStorageConnector.prototype.get = function (command, param) {
    var o = {
      notifyGetProgress: function (e) {
        command.notify({
          "method": "get",
          "message": "Getting metadata",
          "loaded": e.loaded,
          "total": e.total,
          "percentage": (e.loaded / e.total) * 100 // 0% to 100%
        });
      },
      success: function (e) {
        command.success(e.target.status, {"data": e.target.response});
      },
      reject: function (e) {
        command.reject(
          e.target.status,
          e.target.statusText,
          "DavStorage, unable to get document."
        );
      }
    };

    this._get(param).then(o.success, o.reject, o.notifyGetProgress);
  };

  SearchableEncryptionStorageConnector.prototype.allDocs = function (command, param, option) {

    var i, row, path_re, rows, document_list, document_object, delete_id;
    rows = [];
    document_list = [];

//      complex_queries.QueryFactory.create(options.query || "").
    //  exec(document_list, options);
    var positions = [1,3,4]//functionquicalculelespositions(options.query, this_errorRate, this._nbMaxKeywords, this._password);

    jIO.util.ajax({
        "type": "GET",
        "url": this._url,
        "dataType": "json",
        "data": {"positions":positions,"limit":option.limit,"sort_on":option.sort_on,"select_list":option.select_list,"include_docs":option.include_docs}
//        "headers": headers
      }).then(function(e){
          var document_list = e.target.response;
          console.log(document_list);
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

  jIO.addStorage("searchableencryptionconnector",SearchableEncryptionStorageConnector);
  }));
  
// il faut encore définir: putAttachment, getAttachment, remove, removeAttachment, check and repair