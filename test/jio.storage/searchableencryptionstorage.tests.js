/***********************************************************************
**   Written by Abdullatif Shikfa, Alcatel Lucent Bell-Labs France    **
**      With the invaluable help of Tristan Cavelier, Nexedi          **
**                        31/01/2014                                  **
***********************************************************************/

/*jslint indent: 2, maxlen: 80, nomen: true */
/*global module, test, stop, start, expect, ok, deepEqual, location, sinon,
  davstorage_spec, RSVP, jIO, test_util, sjcl, Blob */

(function () {
  "use strict";

  var spec = {
    "url": "http://fakeserver",
    "type": "searchableencryption",
    "password": "coincoin"
  };

  function reverse(promise) {
    return new RSVP.Promise(function (resolve, reject, notify) {
      promise.then(reject, resolve, notify);
    }, function () {
      promise.cancel();
    });
  }

  jIO.util.ajax = (function () {
    // TEST SERVER
    /*jslint regexp: true */
    var baseURLRe = /^http:\/\/fakeserver(\/[^\/]+)?(\/[^\/]+)?$/,
      dataBase = {};

  /**
  * bigModulo is a helper function that computes the remainder of a large
  * integer divided by an operand. The large integer is represented as several
  * regular integers (of 32 bits) in big endian in an array.
  * The function leverages the modulo operation on integers implemented in
  * javascript to perform the modulo on the large integer : it computes the
  * modulo of each integer of the array multiplied by the modulo of the
  * base (2 to the power 32) to the power of the position in the array.
  * However, since javascript encodes integers on 32 bits we have to add another
  * trick: we do the computations on half words and we use the function
  * sjcl.bitArray.bitSlice which extracts some bits out of a bit array, and we
  * and we thus mutliply by half of the base.
  */

    function bigModulo(arr, mod) {
      var i, result = 0, base = 1, maxIter = (2 * arr.length);
      for (i = 0; i < maxIter; i += 1) {
        result = result + (
          (sjcl.bitArray.bitSlice(arr, i * 16, (i + 1) * 16)[0]) % mod
        ) * base;
        base = (base * Math.pow(2, 16)) % mod;
      }
      result = result % mod;
      return result;
    }

  /**
  * test is the function that verifies whether a file matches a query in the
  * searchable encryption framework. This function is only executed at server
  * side. It takes as input an encrypted query (an array of errorRate base64-
  * encoded words) and the id of a document stored in the server dataBase.
  * The function then applies a hash function on each word of the encrypted
  * query concatenated with the id, takes the result modulo the length of bloom
  * filters and checks whether the encryptedIndex of the document with this id
  * has value one at the computed position. If the value is one for all words,
  * it means that the encryptedQuery is matched by this document (with a false
  * positive probability of 2 to the power -errorRate), if there is at least one
  * 0, the encryptedQuery is not matched and the return value is false.
  * Note that this function does not require knowledge of the password, and does
  * not reveal anything the content of the encryptedQuery nor the content of
  * encryptedIndex of the document.
  */

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

//This function emulates the answer of the server to a Put instruction.
//It adds the document received in the parameter data in the dataBase.
    function onPut(id, data) {
      dataBase[id] = dataBase[id] || {};
      dataBase[id].metadata = data.metadata;
      dataBase[id].encryptedIndex = data.encryptedIndex;
    }

//This function emulates the answer of the server to a Post instruction.
//It adds the document received in the parameter data in the dataBase if it does
//not already exist.
    function onPost(id, data) {
      if (dataBase[id]) {
        throw new Error("Document already exists");
      }
      dataBase[id] = {};
      dataBase[id].metadata = data.metadata;
      dataBase[id].encryptedIndex = data.encryptedIndex;
    }

//This function emulates the answer of the server to a PutAttachment
//instruction.
//It adds the attachment received in the parameters to the document in the
//dataBase.
//Caution: this method can throw an error if the document id does not
//already exist.
//Also the attachment ID must not be metadata or encryptedIndex !
    function onPutAttachment(id, idAttachment, data) {
      dataBase[id][idAttachment] = data;
    }

//This function emulates the answer of the server to a Get instruction.
//It returns the metadata associated to the document specified in the input.
    function onGet(id) {
      return dataBase[id].metadata;
    }

//This function emulates the answer of the server to a GetAttachment
//instruction.
//It returns the attachment associated to the document specified in the input.
    function onGetAttachment(id, idAttachment) {
      return dataBase[id][idAttachment];
    }

//This function emulates the answer of the server to a remove instruction.
//It removes the document corresponding to the id received from the dataBase.
    function onRemove(id) {
      delete dataBase[id];
    }

//This function emulates the answer of the server to a removeAttachment
//instruction.
//It removes the attachment from the document id from the dataBase.
    function onRemoveAttachment(id, idAttachment) {
      delete dataBase[id][idAttachment];
    }

//This function emulates the answer of the server to an allDocs instruction.
//It verifies for each document in the dataBase whether it matches the
//encryptedQuery or not. It then returns the metadata of all matching documents.
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

//Function emulating the server
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
              onPost(re_result[1], param.data);
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

//Here we implemented basic test function emulating a scenario and the expected
//answer from the answer.

  test("Scenario", function () {

    var jio = jIO.createJIO(spec, {
      "workspace": {},
      "max_retry": 2
    });

    stop();

//function that puts a new document "a"
    function putNewDocument() {
      return jio.put({
        "_id": "a",
        "title": "Hey",
        "keywords": ["1", "2", "3"]
      });
    }

//function that specifies the expected output of the previous function (success)
    function putNewDocumentTest(answer) {
      deepEqual(answer, {
        "id": "a",
        "method": "put",
        "result": "success",
        "status": 204,
        "statusText": "No Content"
      }, "Put new document");
    }

//function that posts a new document "b"
    function postNewDocument() {
      return jio.post({
        "_id": "b",
        "title": "Hello",
        "keywords": ["1", "4", "5"]
      });
    }

//function that specifies the expected output of the previous function (success)
    function postNewDocumentTest(answer) {
      deepEqual(answer, {
        "id": "b",
        "method": "post",
        "result": "success",
        "status": 200,
        "statusText": "Ok"
      }, "Post new document");
    }

//function that posts the already existing document "b"
    function postCreatedDocument() {
      return reverse(jio.post({
        "_id": "b",
        "title": "Hello",
        "keywords": ["1", "4", "5"]
      }));
    }

//function that specifies the expected output of the previous function (error)
    function postCreatedDocumentTest(answer) {
      deepEqual(answer, {
        "error": "conflict",
        "id": "b",
        "message": "Document update from server failed",
        "method": "post",
        "reason": "Conflict",
        "result": "error",
        "status": 409,
        "statusText": "Conflict"
      }, "Post new document failed -> conflict 409");
    }

//function that gets the already existing document "a"
    function getCreatedDocument() {
      return jio.get({"_id": "a"});
    }

//function that specifies the expected output of the previous function (success)
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

//function that puts (updates) the already existing document "b"
    function putNewDocument2() {
      return jio.put({
        "_id": "b",
        "title": "Hello",
        "keywords": ["1", "4", "5"]
      });
    }

//function that specifies the expected output of the previous function (success)
    function putNewDocument2Test(answer) {
      deepEqual(answer, {
        "id": "b",
        "method": "put",
        "result": "success",
        "status": 204,
        "statusText": "No Content"
      }, "Put new document");
    }

//function that tests the searchable encryption query
    function listDocuments() {
      return jio.allDocs({"query": "1"});
    }

//function that specifies the expected output of the previous function (success)
//and returns two documents
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

//second function that tests the searchable encryption query with a different
//query
    function listOneDocument() {
      return jio.allDocs({"query": "2"});
    }

//function that specifies the expected output of the previous function (success)
//and returns only one document
    function listOneDocumentTest(answer) {
      if (answer && answer.data && Array.isArray(answer.data.rows)) {
        answer.data.rows.sort(function (a) {
          return a.id === "b" ? 1 : 0;
        });
      }
      deepEqual(answer, {
        "data": {
          "total_rows": 1,
          "rows": [{
            "id": "a",
            "value": {}
          }]
        },
        "method": "allDocs",
        "result": "success",
        "status": 200,
        "statusText": "Ok"
      }, "List 1 document");
    }

//function that removes the existing document "a"
    function removeCreatedDocument() {
      return jio.remove({"_id": "a"});
    }

//function that specifies the expected output of the previous function (success)
    function removeCreatedDocumentTest(answer) {
      deepEqual(answer, {
        "id": "a",
        "method": "remove",
        "result": "success",
        "status": 204,
        "statusText": "No Content"
      }, "Remove first document.");
    }

//function that specifies the expected output of the function listDocumentsTest
//after the removal of document "a" (success) and returns only one document
    function listDocumentsTest2(answer) {
      if (answer && answer.data && Array.isArray(answer.data.rows)) {
        answer.data.rows.sort(function (a) {
          return a.id === "b" ? 1 : 0;
        });
      }
      deepEqual(answer, {
        "data": {
          "total_rows": 1,
          "rows": [{
            "id": "b",
            "value": {}
          }]
        },
        "method": "allDocs",
        "result": "success",
        "status": 200,
        "statusText": "Ok"
      }, "List 1 document");
    }

//function that specifies the expected output of the function
//listOneDocumentTest after the removal of document "a" (success) and returns no
//document
    function listOneDocumentTest2(answer) {
      if (answer && answer.data && Array.isArray(answer.data.rows)) {
        answer.data.rows.sort(function (a) {
          return a.id === "b" ? 1 : 0;
        });
      }
      deepEqual(answer, {
        "data": {
          "total_rows": 0,
          "rows": []
        },
        "method": "allDocs",
        "result": "success",
        "status": 200,
        "statusText": "Ok"
      }, "List 0 document");
    }

//function that adds an attachment to the already existing document "a"
    function createAttachment() {
      return jio.putAttachment({
        "_id": "a",
        "_attachment": "aa",
        "_data": "aaa",
        "_content_type": "text/plain"
      });
    }

//function that specifies the expected output of the previous function (success)
    function createAttachmentTest(answer) {
      deepEqual(answer, {
        "attachment": "aa",
        "id": "a",
        "method": "putAttachment",
        "result": "success",
        "status": 204,
        "statusText": "No Content"
      }, "Create new attachment");
    }

//function that updates an already existing attachment
    function updateAttachment() {
      return jio.putAttachment({
        "_id": "a",
        "_attachment": "aa",
        "_data": "aab",
        "_content_type": "text/plain"
      });
    }

//function that specifies the expected output of the previous function (success)
    function updateAttachmentTest(answer) {
      deepEqual(answer, {
        "attachment": "aa",
        "id": "a",
        "method": "putAttachment",
        "result": "success",
        "status": 204,
        "statusText": "No Content"
      }, "Update last attachment");
    }

//function that adds another attachment to the already existing document "a"
    function createAnotherAttachment() {
      return jio.putAttachment({
        "_id": "a",
        "_attachment": "ab",
        "_data": "aba",
        "_content_type": "text/plain"
      });
    }

//function that specifies the expected output of the previous function (success)
    function createAnotherAttachmentTest(answer) {
      deepEqual(answer, {
        "attachment": "ab",
        "id": "a",
        "method": "putAttachment",
        "result": "success",
        "status": 204,
        "statusText": "No Content"
      }, "Create another attachment");
    }

//function that retrieves an already existing document "a"
    function getCreatedDocument2() {
      return jio.get({"_id": "a"});
    }

//function that specifies the expected output of the previous function (success)
    function getCreatedDocument2Test(answer) {
      deepEqual(answer, {
        "data": {
          "_id": "a",
          "keywords": [
            "1",
            "2",
            "3"
          ],
          "title": "Hey"
        },
        "id": "a",
        "method": "get",
        "result": "success",
        "status": 200,
        "statusText": "Ok"
      }, "Get new document");
    }

//function that updates the already existing document "a"
    function updateLastDocument() {
      return jio.put({"_id": "a", "title": "Hoo", "keywords": ["1", "2", "3"]});
    }

//function that specifies the expected output of the previous function (success)
    function updateLastDocumentTest(answer) {
      deepEqual(answer, {
        "id": "a",
        "method": "put",
        "result": "success",
        "status": 204,
        "statusText": "No Content"
      }, "Update document metadata");
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
    putNewDocument().then(putNewDocumentTest).
    // put a 204
      // post b 204
      then(postNewDocument).then(postNewDocumentTest).
      // post a 409
      then(postCreatedDocument).then(postCreatedDocumentTest).
      // get a 200
      then(getCreatedDocument).then(getCreatedDocumentTest).
      // put b 204
      then(putNewDocument2).then(putNewDocument2Test).
      // allD 200 2 documents
      then(listDocuments).then(listDocumentsTest).
      // allD 200 1 document
      then(listOneDocument).then(listOneDocumentTest).
      // remove a 204
      then(removeCreatedDocument).then(removeCreatedDocumentTest).
      // allD 200 1 document
      then(listDocuments).then(listDocumentsTest2).
      // allD 200 0 document
      then(listOneDocument).then(listOneDocumentTest2).
      // put a 204
      then(putNewDocument).then(putNewDocumentTest).
      // putA a 204
      then(createAttachment).then(createAttachmentTest).
      // putA a 204
      then(updateAttachment).then(updateAttachmentTest).
      // putA b 204
      then(createAnotherAttachment).then(createAnotherAttachmentTest).
      // get 200
      then(getCreatedDocument2).then(getCreatedDocument2Test).
      // put 204
      then(updateLastDocument).then(updateLastDocumentTest).
      fail(unexpectedError).
      always(start);
//      always(server.restore.bind(server));
  });

}());
