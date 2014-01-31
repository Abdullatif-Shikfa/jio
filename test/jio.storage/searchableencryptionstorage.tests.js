/*jslint indent: 2, maxlen: 80, nomen: true */
/*global module, test, stop, start, expect, ok, deepEqual, location, sinon,
  davstorage_spec, RSVP, jIO, test_util, dav_storage, btoa */

(function () {
  "use strict";

  var spec, use_fake_server = true;
  spec = {
    "url": "http://fakeserver",
    "type": "searchableencryption",  
    "password": "coincoin",
  };

  jIO.util.ajax = (function () {
    // TEST SERVER
    var baseURLRe = /^http:\/\/fakeserver(\/[^\/]+)?(\/[^\/]+)?$/;

    var dataBase = {};

  function bigModulo(arr, mod) {
    var tmp, i, result = 0, base = 1;
    for (i = 0; i < arr.length; i += 1) {
        result = result + ((sjcl.bitArray.bitSlice(arr, i * 32, (i * 32) + 16)[0]) % mod) * base;
        base = (base * Math.pow(2, 16)) % mod;
        result = result + ((sjcl.bitArray.bitSlice(arr, (i * 32) + 16, (i + 1) * 32)[0]) % mod) * base;
        base = (base * Math.pow(2, 16)) % mod;
    }
    result = result % mod; 
    return result;
  }

    function test(id, encryptedQuery) {
      var j, result = true;
      for (j = 0; j < encryptedQuery.length; j += 1) {
        result = result && (dataBase[id].encryptedIndex[bigModulo(
          sjcl.hash.sha256.hash(encryptedQuery[j] + id),
          dataBase[id].encryptedIndex.length
        )] === 1);
      }
      return result;
    }

    function onPut(id, data) {
      dataBase[id] = dataBase[id] || {};
      dataBase[id].metadata = data.metadata;
      dataBase[id].encryptedIndex = data.encryptedIndex;
    }

    //Caution: this method can throw an error if the document id does not
    //already exist
    //The attachment ID must not be metadata or encryptedIndex !
    function onPutAttachment(id, idAttachment, data) {
      dataBase[id][idAttachment] = data;
    }

    function onGet(id) {
      return dataBase[id].metadata;
    }

    function onGetAttachement(id, idAttachment) {
      return dataBase[id][idAttachment];
    }

    function onRemove(id) {
      delete dataBase[id];
    }

    function onRemoveAttachment(id, idAttachment) {
      delete dataBase[id][idAttachment];
    }

    function onAllDocs(encryptedQuery) {
      /*jslint forin: true */
      var id, result = [];
      for (id in dataBase) {
        if (test(id, encryptedQuery)) {
          result.push(dataBase[id].metadata);
        }
      }
      return result;
    }
    function FakeEvent(target) {
      this.target = target;
    }

    function ServerAjax(param) {
      return new RSVP.Promise(function (resolve, reject) {
        // param.type || "GET"
        // param.url
        // param.dataType (ignored)
        // param.headers (ignored)
        // param.beforeSend (ignored)
        // param.data
        var re_result = baseURLRe.exec(param.url), xhr = {};
        if (!re_result) {
          xhr.status = 1; // wrong url
          xhr.statusText = "Unknown";
          return reject(new FakeEvent(xhr));
        }
        if (re_result[1]) {
          re_result[1] = re_result[1].slice(1);
        }
        if (re_result[2]) {
          re_result[2] = re_result[2].slice(1);
        }
        xhr.status = 404;
        xhr.statusText = "Not Found";
        if (!param.type || param.type === "GET") {
          try {
            if (re_result[2]) {
              // jio.getAttachment
              xhr.response = new Blob([
                onGetAttachment(re_result[1], re_result[2])
              ]);
            } else {
              // jio.get
              xhr.response = onGet(re_result[1]);
              xhr.responseText = xhr.response;
            }
          } catch (e) {
            return reject(new FakeEvent(xhr));
          }
          xhr.status = 200;
          xhr.statusText = "OK";
          return resolve(new FakeEvent(xhr));
        }
        if (param.type === "DELETE") {
          try {
            if (re_result[2]) {
              // jio.removeAttachment
              onRemoveAttachment(re_result[1], re_result[2]);
            } else {
              // jio.remove
              onRemove(re_result[1]);
            }
          } catch (e2) {
            return reject(new FakeEvent(xhr));
          }
          xhr.status = 204;
          xhr.statusText = "No Content";
          return resolve(new FakeEvent(xhr));
        }
        xhr.status = 409;
        xhr.statusText = "Conflict";
        if (param.type === "POST") {
          try {
            if (re_result[1]) {
              // jio.post
            } else {
              // jio.allDocs
              xhr.response = onAllDocs(param.data.query);
            }
          } catch (e1) {
            return reject(new FakeEvent(xhr));
          }
          xhr.status = 200;
          xhr.statusText = "OK";
          return resolve(new FakeEvent(xhr));
        }
        if (param.type === "PUT") {
          try {
            if (re_result[2]) {
              // jio.putAttachment
              onPutAttachment(re_result[1], re_result[2], param.data);
            } else {
              // jio.put
              onPut(re_result[1], param.data);
            }
          } catch (e3) {
            return reject(new FakeEvent(xhr));
          }
          xhr.status = 204;
          xhr.statusText = "No Content";
          return resolve(new FakeEvent(xhr));
        }
      });
    }

    return ServerAjax;
  }());

  module("Searchable Encryption Storage");

  /**
   * Tested with local webDav server
   *
   * Used header are:
   * - Header always set Cache-Control "no-cache" # "private", "public",
   *   "<seconds>" or "no-store" ("no-cache")
   * - Header always set Access-Control-Max-Age "0"
   * - Header always set Access-Control-Allow-Credentials "true"
   * - Header always set Access-Control-Allow-Origin "*"
   * - Header always set Access-Control-Allow-Methods "OPTIONS, GET, HEAD,
   *   POST, PUT, DELETE, PROPFIND"
   * - Header always set Access-Control-Allow-Headers "Content-Type,
   *   X-Requested-With, X-HTTP-Method-Override, Accept, Authorization,
   *   Depth"
   */
  test("Scenario", 30, function () {

    var server, responses = [], shared = {}, jio = jIO.createJIO(spec, {
      "workspace": {},
      "max_retry": 2
    });

    stop();

/*     function postNewDocument() {
      return jio.post({"title": "Unique ID"});
    }

    function postNewDocumentTest(answer) {
      var uuid = answer.id;
      answer.id = "<uuid>";
      deepEqual(answer, {
        "id": "<uuid>",
        "method": "post",
        "result": "success",
        "status": 201,
        "statusText": "Created"
      }, "Post a new document");
      ok(test_util.isUuid(uuid), "New document id should look like " +
         "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx : " + uuid);
      shared.created_document_id = uuid;
    }
 */
    function getCreatedDocument() {
      return jio.get({"_id": "a"});
    }

    function getCreatedDocumentTest(answer) {
      deepEqual(answer, {
        "data": {
          "_id": "a",
          "title": "Hey",
          "keywords": ["1", "2", "3"]
        },
        "id": "a",
        "method": "get",
        "result": "success",
        "status": 200,
        "statusText": "Ok"
      }, "Get new document");
    }

    function postSpecificDocument() {
      responses.push([404, {}, '']); // GET
      responses.push([201, {}, '']); // PUT
      return jio.post({"_id": "b", "title": "Bee"});
    }

    function postSpecificDocumentTest(answer) {
      deepEqual(answer, {
        "id": "b",
        "method": "post",
        "result": "success",
        "status": 201,
        "statusText": "Created"
      }, "Post specific document");
    }

    function listDocuments() {
      return jio.allDocs({"query": "1"});
    }

    function listDocumentsTest(answer) {
      if (answer && answer.data && Array.isArray(answer.data.rows)) {
        answer.data.rows.sort(function (a) {
          return a.id === "b" ? 1 : 0;
        });
      }
      deepEqual(answer, {
        "data": {
          "total_rows": 2,
          "rows": [{
            "id": "a",
            "value": {}
          }, {
            "id": "b",
            "value": {}
          }]
        },
        "method": "allDocs",
        "result": "success",
        "status": 200,
        "statusText": "Ok"
      }, "List 2 documents");
    }

    function removeCreatedDocument() {
      return jio.remove({"_id": shared.created_document_id});
    }

    function removeCreatedDocumentTest(answer) {
      deepEqual(answer, {
        "id": shared.created_document_id,
        "method": "remove",
        "result": "success",
        "status": 204,
        "statusText": "No Content"
      }, "Remove first document.");
    }

    function removeSpecificDocument() {
      return jio.remove({"_id": "b"});
    }

    function removeSpecificDocumentTest(answer) {
      deepEqual(answer, {
        "id": "b",
        "method": "remove",
        "result": "success",
        "status": 204,
        "statusText": "No Content"
      }, "Remove second document.");
    }

    function listEmptyStorage() {
      return jio.allDocs();
    }

    function listEmptyStorageTest(answer) {
      deepEqual(answer, {
        "data": {
          "total_rows": 0,
          "rows": []
        },
        "method": "allDocs",
        "result": "success",
        "status": 200,
        "statusText": "Ok"
      }, "List empty storage");
    }

    function putNewDocument() {
      return jio.put({
        "_id": "a",
        "title": "Hey",
        "keywords": ["1", "2", "3"]
      });
    }

    function putNewDocumentTest(answer) {
      deepEqual(answer, {
        "id": "a",
        "method": "put",
        "result": "success",
        "status": 204,
        "statusText": "No Content"
      }, "Put new document");
    }

    function putNewDocument2() {
      return jio.put({
        "_id": "b",
        "title": "Hello",
        "keywords": ["1", "4", "5"]
      });
    }

    function putNewDocument2Test(answer) {
      deepEqual(answer, {
        "id": "b",
        "method": "put",
        "result": "success",
        "status": 204,
        "statusText": "No Content"
      }, "Put new document");
    }
    
    function getCreatedDocument2() {
      return jio.get({"_id": "a"});
    }

    function getCreatedDocument2Test(answer) {
      deepEqual(answer, {
        "data": {
          "_id": "a",
          "title": "Hey"
        },
        "id": "a",
        "method": "get",
        "result": "success",
        "status": 200,
        "statusText": "Ok"
      }, "Get new document");
    }

    function postSameDocument() {
      return success(jio.post({"_id": "a", "title": "Hoo"}));
    }

    function postSameDocumentTest(answer) {
      deepEqual(answer, {
        "error": "conflict",
        "id": "a",
        "message": "DavStorage, cannot overwrite document metadata.",
        "method": "post",
        "reason": "Document exists",
        "result": "error",
        "status": 409,
        "statusText": "Conflict"
      }, "Unable to post the same document (conflict)");
    }

    function createAttachment() {
      return jio.putAttachment({
        "_id": "a",
        "_attachment": "aa",
        "_data": "aaa",
        "_content_type": "text/plain"
      });
    }

    function createAttachmentTest(answer) {
      deepEqual(answer, {
        "attachment": "aa",
        "digest": "sha256-9834876dcfb05cb167a5c24953eba58c4" +
          "ac89b1adf57f28f2f9d09af107ee8f0",
        "id": "a",
        "method": "putAttachment",
        "result": "success",
        "status": 204,
        "statusText": "No Content"
      }, "Create new attachment");
    }

    function updateAttachment() {
      return jio.putAttachment({
        "_id": "a",
        "_attachment": "aa",
        "_data": "aab",
        "_content_type": "text/plain"
      });
    }

    function updateAttachmentTest(answer) {
      deepEqual(answer, {
        "attachment": "aa",
        "digest": "sha256-38760eabb666e8e61ee628a17c4090cc5" +
          "0728e095ff24218119d51bd22475363",
        "id": "a",
        "method": "putAttachment",
        "result": "success",
        "status": 204,
        "statusText": "No Content"
      }, "Update last attachment");
    }

    function createAnotherAttachment() {
      return jio.putAttachment({
        "_id": "a",
        "_attachment": "ab",
        "_data": "aba",
        "_content_type": "text/plain"
      });
    }

    function createAnotherAttachmentTest(answer) {
      deepEqual(answer, {
        "attachment": "ab",
        "digest": "sha256-e124adcce1fb2f88e1ea799c3d0820845" +
          "ed343e6c739e54131fcb3a56e4bc1bd",
        "id": "a",
        "method": "putAttachment",
        "result": "success",
        "status": 204,
        "statusText": "No Content"
      }, "Create another attachment");
    }

    function updateLastDocument() {
      return jio.put({"_id": "a", "title": "Hoo"});
    }

    function updateLastDocumentTest(answer) {
      deepEqual(answer, {
        "id": "a",
        "method": "put",
        "result": "success",
        "status": 204,
        "statusText": "No Content"
      }, "Update document metadata");
    }

    function getFirstAttachment() {
      return jio.getAttachment({"_id": "a", "_attachment": "aa"});
    }

    function getFirstAttachmentTest(answer) {
      var blob = answer.data;
      answer.data = "<blob>";
      deepEqual(answer, {
        "attachment": "aa",
        "data": "<blob>",
        "digest": "sha256-38760eabb666e8e61ee628a17c4090cc5" +
          "0728e095ff24218119d51bd22475363",
        "id": "a",
        "method": "getAttachment",
        "result": "success",
        "status": 200,
        "statusText": "Ok"
      }, "Get first attachment");
      return jIO.util.readBlobAsText(blob).then(function (e) {
        deepEqual(blob.type, "text/plain", "Check blob type");
        deepEqual(e.target.result, "aab", "Check blob text content");
      }, function (err) {
        deepEqual(err, "no error", "Check blob text content");
      });
    }

    function getSecondAttachment() {
      return jio.getAttachment({"_id": "a", "_attachment": "ab"});
    }

    function getSecondAttachmentTest(answer) {
      var blob = answer.data;
      answer.data = "<blob>";
      deepEqual(answer, {
        "attachment": "ab",
        "data": "<blob>",
        "digest": "sha256-e124adcce1fb2f88e1ea799c3d0820845" +
          "ed343e6c739e54131fcb3a56e4bc1bd",
        "id": "a",
        "method": "getAttachment",
        "result": "success",
        "status": 200,
        "statusText": "Ok"
      }, "Get first attachment");
      return jIO.util.readBlobAsText(blob).then(function (e) {
        deepEqual(blob.type, "text/plain", "Check blob type");
        deepEqual(e.target.result, "aba", "Check blob text content");
      }, function (err) {
        deepEqual(err, "no error", "Check blob text content");
      });
    }

    function getLastDocument() {
      return jio.get({"_id": "a"});
    }

    function getLastDocumentTest(answer) {
      deepEqual(answer, {
        "data": {
          "_id": "a",
          "title": "Hoo",
          "_attachments": {
            "aa": {
              "content_type": "text/plain",
              "digest": "sha256-38760eabb666e8e61ee628a17c4090cc5" +
                "0728e095ff24218119d51bd22475363",
              "length": 3
            },
            "ab": {
              "content_type": "text/plain",
              "digest": "sha256-e124adcce1fb2f88e1ea799c3d0820845" +
                "ed343e6c739e54131fcb3a56e4bc1bd",
              "length": 3
            }
          }
        },
        "id": "a",
        "method": "get",
        "result": "success",
        "status": 200,
        "statusText": "Ok"
      }, "Get last document metadata");
    }

    function removeSecondAttachment() {
      return jio.removeAttachment({"_id": "a", "_attachment": "ab"});
    }

    function removeSecondAttachmentTest(answer) {
      deepEqual(answer, {
        "attachment": "ab",
        "id": "a",
        "method": "removeAttachment",
        "result": "success",
        "status": 204,
        "statusText": "No Content"
      }, "Remove second document");
    }

    function getInexistentSecondAttachment() {
      return success(jio.getAttachment({"_id": "a", "_attachment": "ab"}));
    }

    function getInexistentSecondAttachmentTest(answer) {
      deepEqual(answer, {
        "attachment": "ab",
        "error": "not_found",
        "id": "a",
        "message": "DavStorage, unable to get attachment.",
        "method": "getAttachment",
        "reason": "missing attachment",
        "result": "error",
        "status": 404,
        "statusText": "Not Found"
      }, "Get inexistent second attachment");
    }

    function getOneAttachmentDocument() {
      return jio.get({"_id": "a"});
    }

    function getOneAttachmentDocumentTest(answer) {
      deepEqual(answer, {
        "data": {
          "_attachments": {
            "aa": {
              "content_type": "text/plain",
              "digest": "sha256-38760eabb666e8e61ee628a17c4090cc5" +
                "0728e095ff24218119d51bd22475363",
              "length": 3
            }
          },
          "_id": "a",
          "title": "Hoo"
        },
        "id": "a",
        "method": "get",
        "result": "success",
        "status": 200,
        "statusText": "Ok"
      }, "Get document metadata");
    }

    function removeSecondAttachmentAgain() {
      return success(jio.removeAttachment({"_id": "a", "_attachment": "ab"}));
    }

    function removeSecondAttachmentAgainTest(answer) {
      deepEqual(answer, {
        "attachment": "ab",
        "error": "not_found",
        "id": "a",
        "message": "DavStorage, document attachment not found.",
        "method": "removeAttachment",
        "reason": "missing attachment",
        "result": "error",
        "status": 404,
        "statusText": "Not Found"
      }, "Remove inexistent attachment");
    }

    function removeDocument() {
      return jio.remove({"_id": "a"});
    }

    function removeDocumentTest(answer) {
      deepEqual(answer, {
        "id": "a",
        "method": "remove",
        "result": "success",
        "status": 204,
        "statusText": "No Content"
      }, "Remove document and its attachments");
    }

    function getInexistentFirstAttachment() {
      return success(jio.getAttachment({"_id": "a", "_attachment": "aa"}));
    }

    function getInexistentFirstAttachmentTest(answer) {
      deepEqual(answer, {
        "attachment": "aa",
        "error": "not_found",
        "id": "a",
        "message": "DavStorage, unable to get attachment.",
        "method": "getAttachment",
        "reason": "missing document",
        "result": "error",
        "status": 404,
        "statusText": "Not Found"
      }, "Get inexistent first attachment");
    }

    function getInexistentDocument() {
      return success(jio.get({"_id": "a"}));
    }

    function getInexistentDocumentTest(answer) {
      deepEqual(answer, {
        "error": "not_found",
        "id": "a",
        "message": "DavStorage, unable to get document.",
        "method": "get",
        "reason": "Not Found",
        "result": "error",
        "status": 404,
        "statusText": "Not Found"
      }, "Get inexistent document");
    }

    function removeInexistentDocument() {
      return success(jio.remove({"_id": "a"}));
    }

    function removeInexistentDocumentTest(answer) {
      deepEqual(answer, {
        "error": "not_found",
        "id": "a",
        "message": "DavStorage, unable to get metadata.",
        "method": "remove",
        "reason": "Not Found",
        "result": "error",
        "status": 404,
        "statusText": "Not Found"
      }, "Remove already removed document");
    }

    function unexpectedError(error) {
      if (error instanceof Error) {
        deepEqual([
          error.name + ": " + error.message,
          error
        ], "UNEXPECTED ERROR", "Unexpected error");
      } else {
        deepEqual(error, "UNEXPECTED ERROR", "Unexpected error");
      }
    }

    // # Post new documents, list them and remove them
    // put a 204
    putNewDocument().then(putNewDocumentTest).
      // get 200
      then(getCreatedDocument).then(getCreatedDocumentTest).
      // put b 204
      then(putNewDocument2).then(putNewDocument2Test).
      // allD 200 2 documents
      then(listDocuments).then(listDocumentsTest).
      /*      // post b 201
      then(postSpecificDocument).then(postSpecificDocumentTest).
      // allD 200 2 documents
      then(listDocuments).then(list2DocumentsTest).
      // remove a 204
//      then(removeCreatedDocument).then(removeCreatedDocumentTest).
      // remove b 204
//      then(removeSpecificDocument).then(removeSpecificDocumentTest).
      // allD 200 empty storage
      then(listEmptyStorage).then(listEmptyStorageTest).
      // # Create and update documents, and some attachment and remove them
      // put 201
      then(putNewDocument).then(putNewDocumentTest).
      // get 200
      then(getCreatedDocument2).then(getCreatedDocument2Test).
      // post 409
      then(postSameDocument).then(postSameDocumentTest).
      // putA a 204
//      then(createAttachment).then(createAttachmentTest).
      // putA a 204
//      then(updateAttachment).then(updateAttachmentTest).
      // putA b 204
//      then(createAnotherAttachment).then(createAnotherAttachmentTest).
      // put 204
      then(updateLastDocument).then(updateLastDocumentTest).
      // getA a 200
//      then(getFirstAttachment).then(getFirstAttachmentTest).
      // getA b 200
//      then(getSecondAttachment).then(getSecondAttachmentTest).
      // get 200
      then(getLastDocument).then(getLastDocumentTest).
      // removeA b 204
//      then(removeSecondAttachment).then(removeSecondAttachmentTest).
      // getA b 404
//      then(getInexistentSecondAttachment).
//      then(getInexistentSecondAttachmentTest).
      // get 200
//      then(getOneAttachmentDocument).then(getOneAttachmentDocumentTest).
      // removeA b 404
//      then(removeSecondAttachmentAgain).then(removeSecondAttachmentAgainTest).
      // remove 204
//      then(removeDocument).then(removeDocumentTest).
      // getA a 404
//      then(getInexistentFirstAttachment).then(getInexistentFirstAttachmentTest).
      // get 404
//      then(getInexistentDocument).then(getInexistentDocumentTest).
      // remove 404
//      then(removeInexistentDocument).then(removeInexistentDocumentTest).
      // check 204
      //then(checkDocument).done(checkDocumentTest).
      //then(checkStorage).done(checkStorageTest).*/
      fail(unexpectedError).
      always(start);
//      always(server.restore.bind(server));
  });

}());
