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
JsonSchemaGenerator.prototype.generate = function (schema) {
   var definition = {};
   definition.properties = this.generateProperties(schema);
   definition.required = this.generateRequired(schema);
   return definition;
}

JsonSchemaGenerator.prototype.generateProperty = function (path, schema) {
   var property = {};
   var method = "generate" + this.swaggerTypeFor(path.options.type).type;
   if (typeof this[method] === "function") {
      property = this[method](path, schema);
   } else {
      // if no properties then it is Mixed or Buffered,
      property.type = "object";
      property.properties = {};
   }
   return property;
};

JsonSchemaGenerator.prototype.generateProperties = function (schema) {
   var properties = {};
   Object.keys(schema.paths).forEach(function (name) {
      if (!this.getEmbeddedName(name) && this.isIncluded(name, schema.paths[name].options)) {
         // ignore 'private' fields
         if (name.indexOf('_') != 0) {
            var property = this.generateProperty(schema.paths[name], schema);
            properties[name] = property;
         }
      }
   }, this);

   var embeddeds = this.findEmbeddeds(schema);
   for (var key in embeddeds) {
      var property = this.generateEmbedded(embeddeds[key]);
      if (property) {
         properties[key] = property;
      }
   }

   return properties;
};

JsonSchemaGenerator.prototype.generateRequired = function (schema) {
   var required = [];
   Object.keys(schema.paths).forEach(function (name) {
      // only add required for non-embedded paths
      if (!this.getEmbeddedName(name)) {
         if (schema.paths[name].isRequired === true) {
            required.push(schema.paths[name].path);
         }
      }
   }, this);
   return required.length == 0 ? undefined : required;
}

JsonSchemaGenerator.prototype.generateString = function (path, schema) {
   var property = {};
   property.type = "string";
   if (path.options.enum) {
      property.enum = path.options.enum;
   }
   return property;
}

JsonSchemaGenerator.prototype.generateDate = function (path, schema) {
   var property = {};
   property.type = "string";
   return property;
}

JsonSchemaGenerator.prototype.generateBoolean = function (path, schema) {
   var property = {};
   property.type = "boolean";
   return property;
}

JsonSchemaGenerator.prototype.generateNumber = function (path, schema) {
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

JsonSchemaGenerator.prototype.generateArray = function (path, schema) {
   var property = {};
   property.type = "array";
   var method = "generateType" + this.swaggerTypeFor(path.options.type[0]).type;
   if (typeof this[method] === "function") {
      property.items = this[method](path);
   }
   return property;
}

JsonSchemaGenerator.prototype.generateEmbedded = function (embedded) {
   var property = {};
   var schema = {paths: {}};
   if (Array.isArray(embedded)) {
      embedded.forEach(function (path) {
         schema.paths[path.path] = path;
      });
   }
   property.type = "object";
   property.required = this.generateRequired(schema);
   property.properties = this.generateProperties(schema);
   return property;
}

JsonSchemaGenerator.prototype.generateObjectId = function (path, schema) {
   var property = {};
   if (path.options && path.options.ref) {
      property.$ref = "#/definitions/" + path.options.ref;
   } else {
      // this is the _id field and can be ignored
   }
   return property;
}

JsonSchemaGenerator.prototype.generateTypeObjectId = function (path) {
   return {'$ref': "#/definitions/" + path.options.type[0].ref};
}

JsonSchemaGenerator.prototype.generateTypeString = function (path) {
   return {type: "string"};
}

JsonSchemaGenerator.prototype.generateTypeEmbedded = function (path) {
   var schema = this.generate(path.schema);
   schema.type = "object";
   schema.required = this.generateRequired(path.schema);
   return schema;
}