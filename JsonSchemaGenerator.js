// This is a Controller mixin to add methods for generating Swagger data.

// __Dependencies__
var mongoose = require('mongoose');
var AbstractSchemaGenerator = require('./AbstractSchemaGenerator');

// __Private Members__

// __Module Definition__
var JsonSchemaGenerator = module.exports = function () {
};

JsonSchemaGenerator.prototype = new AbstractSchemaGenerator();

// A method used to generate a Swagger model definition for a Mongoose Schema
JsonSchemaGenerator.prototype.generate = function (schema, id, objectRefs) {
    var definition = {};
    definition.id = id;
    definition.properties = this._generateProperties(schema, id, objectRefs);
    definition.required = this._generateRequired(schema, objectRefs ? true : false);
    return definition;
};

JsonSchemaGenerator.prototype._generateProperty = function (path, schema, prefix, objectRefs) {
    var property = {};
    var method = "_generate" + this._swaggerTypeFor(path.options.type).type;
    if (typeof this[method] === "function") {
        property = this[method](path, schema, prefix, objectRefs);
    } else {
        // if no properties then it is Mixed or Buffered,
        property.type = "object";
        property.properties = {};
    }
    return property;
};

JsonSchemaGenerator.prototype._generateProperties = function (schema, prefix, objectRefs) {
    var properties = {};
    Object.keys(schema.paths).forEach(function (name) {
        if (!this._getEmbeddedName(name) && this._isIncluded(name, schema.paths[name].options)) {
            // ignore 'private' fields
            if (name.indexOf('_') != 0) {
                var property = this._generateProperty(schema.paths[name], schema, prefix, objectRefs);
                properties[name] = property;
            }
        }
    }, this);

    var embeddeds = this._findEmbeddeds(schema);
    for (var key in embeddeds) {
        var _prefix = (prefix || '') + '_' + key;
        if (!objectRefs) {
            var property = this._generateEmbedded(embeddeds[key]);
            if (property) {
                properties[key] = property;
            }
        } else {
            var _objectRefs = {};
            var embeddedName = _prefix;
            var embeddedSchema = this._generateEmbedded(embeddeds[key], embeddedName, _objectRefs);
            objectRefs[embeddedName] = embeddedSchema;
            properties[key] = {'$ref': embeddedName};

            for (var _key in _objectRefs) {
                objectRefs[_key] = _objectRefs[_key];
            }
        }
    }

    return properties;
};

// To avoid adding lodash, we add Array.find directly
if (!Array.prototype.find) {
    Array.prototype.find = function (predicate) {
        if (this === null) {
            throw new TypeError('Array.prototype.find called on null or undefined');
        }
        if (typeof predicate !== 'function') {
            throw new TypeError('predicate must be a function');
        }
        var list = Object(this);
        var length = list.length >>> 0;
        var thisArg = arguments[1];
        var value;

        for (var i = 0; i < length; i++) {
            value = list[i];
            if (predicate.call(thisArg, value, i, list)) {
                return value;
            }
        }
        return undefined;
    };
}

JsonSchemaGenerator.prototype._generateRequired = function (schema, bRequireEmbedded) {
    var required = [];
    Object.keys(schema.paths).forEach(function (name) {
        if (schema.paths[name].isRequired === true) {
            if (!this._getEmbeddedName(name)) {
                required.push(schema.paths[name].path);
            } else if (bRequireEmbedded) {
                //When requiring embedded, we only add the rquire for the top level once
                var embeddedName = this._getEmbeddedName(name);
                if (!required.find(function (_required) {
                    return (_required === embeddedName);
                })) {
                    required.push(embeddedName);
                }
            }
        }
    }, this);
    return required.length == 0 ? undefined : required;
}

JsonSchemaGenerator.prototype._generateString = function (path, schema) {
    var property = {};
    property.type = "string";
    if (path.options.enum) {
        property.enum = path.options.enum;
    }
    return property;
}

JsonSchemaGenerator.prototype._generateDate = function (path, schema) {
    var property = {};
    property.type = "string";
    return property;
}

JsonSchemaGenerator.prototype._generateBoolean = function (path, schema) {
    var property = {};
    property.type = "boolean";
    return property;
}

JsonSchemaGenerator.prototype._generateNumber = function (path, schema) {
    var property = {};
    property.type = "number";
    if (path.options.min) {
        property.min = path.options.min;
    }
    if (path.options.max) {
        property.min = path.options.max;
    }
    return property;
}

JsonSchemaGenerator.prototype._generateArray = function (path, schema, prefix, objectRefs) {
    var property = {};
    property.type = "array";
    var method = "_generateType" + this._swaggerTypeFor(path.options.type[0]).type;
    if (typeof this[method] === "function") {
        property.items = this[method](path, schema, prefix, objectRefs);
    }
    return property;
}

JsonSchemaGenerator.prototype._generateEmbedded = function (embedded, id, objectRefs) {
    var property = {};
    var schema = {paths: {}};
    if (Array.isArray(embedded)) {
        embedded.forEach(function (path) {
            schema.paths[path.path] = path;
        });
    }
    //When using object as refs, we don't embed them as 'object'
    if (!objectRefs) {
        property.type = "object";
    }
    if (id) {
        property.id = id;
    }
    property.required = this._generateRequired(schema, objectRefs ? true : false);
    property.properties = this._generateProperties(schema, id, objectRefs);
    return property;
}

JsonSchemaGenerator.prototype._generateObjectId = function (path, schema) {
    var property = {};
    if (path.options && path.options.ref) {
        property.$ref = "#/definitions/" + path.options.ref;
    } else {
        // this is the _id field and can be ignored
    }
    return property;
}

JsonSchemaGenerator.prototype._generateTypeObjectId = function (path) {
    return {'$ref': "#/definitions/" + path.options.type[0].ref};
}

JsonSchemaGenerator.prototype._generateTypeString = function (path) {
    return {type: "string"};
}

JsonSchemaGenerator.prototype._generateTypeEmbedded = function (path, schema, prefix, objectRefs) {
    var _key = (prefix || '') + '_' + path.path;
    var _schema = this.generate(path.schema, _key, objectRefs);
    if (!objectRefs) {
        _schema.type = "object";
    }
    _schema.required = this._generateRequired(path.schema);
    if (!objectRefs) {
        return _schema;
    } else {
        objectRefs[_key] = _schema;
        return {'$ref': _key};
    }
}