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
  matadata.encryptedIndex = //fonction de searchable encryption creation de Bloom Filter
  command.storage(this._sub_storage).put(metadata).then(command.success, command.error,command.notify);
};

SearchableEncryptionStorageHandler.prototype.post = function (command, metadata, option) {
  matadata.encryptedIndex = //fonction de searchable encryption creation de Bloom Filter
  command.storage(this._sub_storage).post(metadata).then(command.success, command.error,command.notify);
};

SearchableEncryptionStorageHandler.prototype.get = function (command, param, option) {
  command.storage(this._sub_storage).get(param).then(command.success, command.error,command.notify);
};

SearchableEncryptionStorageHandler.prototype.allDocs = function (command, param, option) {
     command.storage(this._sub_storage).allDocs(option).then(command.success, command.error,command.notify);
}

// il faut encore définir: putAttachment, getAttachment, remove, removeAttachment, check and repair